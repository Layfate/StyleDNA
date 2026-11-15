import asyncio
from uuid import uuid4

from .analysis import analyze_measurements
from .database import Library
from .models import now
from .ollama import OllamaProvider


class TaskManager:
    def __init__(self, library: Library):
        self.library = library
        self.tasks: dict[str, asyncio.Task] = {}
        self.semaphore = asyncio.Semaphore(1)

    def start(self, reference_ids: list[str], mode: str, model: str | None):
        if len(self.tasks) >= 4:
            raise ValueError("Analysis queue is full. Wait for a job or cancel one first.")
        for ref in reference_ids:
            self.library.assets.get(ref)
        if mode == "ollama" and not model:
            raise ValueError("Select a local vision model in Settings first")
        job = {
            "id": uuid4().hex,
            "state": "queued",
            "stage": "Waiting for analysis",
            "progress": 0,
            "mode": mode,
            "model": model,
            "reference_ids": reference_ids,
            "result": None,
            "error": None,
            "created_at": now(),
        }
        self.library.put_job(job)
        task = asyncio.create_task(self.run(job))
        self.tasks[job["id"]] = task
        task.add_done_callback(lambda _: self.tasks.pop(job["id"], None))
        return job

    async def run(self, job):
        try:
            async with self.semaphore:
                job.update(state="running", stage="Measuring reference images", progress=15)
                self.library.put_job(job)
                if job["mode"] == "ollama":
                    job.update(stage="Interpreting visual traits with local Ollama", progress=30)
                    self.library.put_job(job)
                    url = self.library.settings().get("ollama_url", "http://127.0.0.1:11434")
                    result = await OllamaProvider(url).analyze(
                        self.library.assets, job["reference_ids"], job["model"]
                    )
                else:
                    result = await asyncio.to_thread(
                        analyze_measurements, self.library.assets, job["reference_ids"]
                    )
                # A job never writes a skill. Applying its result is an explicit editor action.
                job.update(
                    state="completed",
                    stage="Ready to review",
                    progress=100,
                    result=result.model_dump(),
                )
                self.library.put_job(job)
        except asyncio.CancelledError:
            job.update(state="cancelled", stage="Analysis cancelled", result=None)
            self.library.put_job(job)
            raise
        except Exception as exc:
            from .assets import ImageError
            from .ollama import ProviderError

            error = (
                str(exc)
                if isinstance(exc, (ProviderError, ImageError, ValueError))
                else ("Analysis failed. Check your images and provider, then retry.")
            )
            job.update(state="failed", stage="Analysis failed", error=error, result=None)
            self.library.put_job(job)

    def cancel(self, job_id):
        job = self.library.get_job(job_id)
        if job["state"] in ("queued", "running"):
            job.update(state="cancelled", stage="Analysis cancelled", result=None)
            self.library.put_job(job)
            if task := self.tasks.get(job_id):
                task.cancel()
        return job

    async def close(self):
        tasks = list(self.tasks.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
