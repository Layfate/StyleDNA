import asyncio
import secrets
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Query, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import Field, ValidationError
from starlette.concurrency import run_in_threadpool

from .assets import AssetStore, ImageError
from .compiler import compile_skill, slug
from .config import MAX_IMAGE_BYTES, MAX_PACKAGE_BYTES, MAX_REFERENCES, MAX_UPLOAD_BYTES
from .database import ConflictError, Library, NotFoundError
from .jobs import TaskManager
from .models import AssetId, StrictModel, StyleProfile
from .ollama import OllamaProvider, ProviderError
from .packages import export_package, import_package

ORIGINS = {
    "http://127.0.0.1:1420",
    "http://localhost:1420",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
}


class SaveRequest(StrictModel):
    profile: StyleProfile
    expected_revision: int = Field(ge=0)


class JobRequest(StrictModel):
    reference_ids: list[AssetId] = Field(min_length=1, max_length=20)
    mode: Literal["measurements", "ollama"]
    model: str | None = Field(default=None, max_length=200)


class RestoreRequest(StrictModel):
    revision: int = Field(ge=1)
    expected_revision: int = Field(ge=1)


class SettingsRequest(StrictModel):
    theme: Literal["dark", "light"] | None = None
    ollama_url: str | None = Field(default=None, max_length=100)
    ollama_model: str | None = Field(default=None, max_length=200)


class BodyLimitError(Exception):
    pass


class LocalBoundary:
    """ASGI boundary: reject untrusted browser origins/hosts before reading a body."""

    def __init__(self, app, token, hosts):
        self.app, self.token, self.hosts = app, token, hosts

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
        host = headers.get("host", "").split(":", 1)[0]
        origin = headers.get("origin")
        code, error = None, None
        if host not in self.hosts or (origin and origin not in ORIGINS):
            code, error = 403, "Request origin or host is not allowed"
        elif (
            scope["path"] != "/health"
            and scope["method"] != "OPTIONS"
            and not secrets.compare_digest(headers.get("authorization", ""), "Bearer " + self.token)
        ):
            code, error = 401, "Local session authorization required; restart the app"
        elif scope["method"] in ("POST", "PUT") and not any(
            headers.get("content-type", "").startswith(t)
            for t in ("application/json", "multipart/form-data")
        ):
            code, error = 415, "Expected JSON or a multipart file upload"
        try:
            if int(headers.get("content-length", "0")) > MAX_PACKAGE_BYTES + 1024**2:
                code, error = 413, "Request exceeds the upload limit"
        except ValueError:
            code, error = 400, "Invalid content length"
        cors = (
            {"Access-Control-Allow-Origin": origin, "Vary": "Origin"} if origin in ORIGINS else {}
        )
        if scope["method"] == "OPTIONS" and code is None:
            return await Response(
                status_code=204,
                headers={
                    **cors,
                    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
                    "Access-Control-Allow-Headers": "Authorization,Content-Type",
                },
            )(scope, receive, send)
        if code:
            return await JSONResponse({"error": error}, status_code=code, headers=cors)(
                scope, receive, send
            )
        consumed = 0

        async def limited_receive():
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > MAX_PACKAGE_BYTES + 1024**2:
                    raise BodyLimitError()
            return message

        async def safe_send(message):
            if message["type"] == "http.response.start":
                message["headers"] += [
                    (k.lower().encode(), v.encode())
                    for k, v in {
                        **cors,
                        "X-Content-Type-Options": "nosniff",
                        "Cache-Control": "no-store",
                    }.items()
                ]
            await send(message)

        await self.app(scope, limited_receive, safe_send)


def create_app(data_dir: Path, token: str, allowed_hosts=None) -> FastAPI:
    assets = AssetStore(data_dir)
    library = Library(data_dir, assets)
    tasks = TaskManager(library)

    @asynccontextmanager
    async def lifespan(app):
        library.interrupt_jobs()
        for path in assets.staging.iterdir():
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
        # Preserve recent unsaved drafts; only remove orphan imports older than a day.
        with library.connect() as db:
            used = {r[0] for r in db.execute("SELECT DISTINCT asset_id FROM revision_assets")}
        for path in assets.root.iterdir():
            if path.name not in used and path.stat().st_mtime < time.time() - 86400:
                assets.remove(path.name)
        yield
        await tasks.close()

    app = FastAPI(
        title="StyleDNA local service",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.library = library
    app.add_middleware(
        LocalBoundary, token=token, hosts=allowed_hosts or {"127.0.0.1", "localhost"}
    )

    async def error_handler(request, exc):
        if isinstance(exc, NotFoundError):
            code = 404
        elif isinstance(exc, ConflictError):
            code = 409
        elif isinstance(exc, BodyLimitError):
            return JSONResponse({"error": "Request exceeds the upload limit"}, status_code=413)
        else:
            code = 422
        if isinstance(exc, (RequestValidationError, ValidationError)):
            message = "Invalid data: " + "; ".join(
                f"{'.'.join(str(p) for p in e['loc'][:5])}: {e['msg']}" for e in exc.errors()[:4]
            )
        else:
            message = str(exc)
        return JSONResponse({"error": message}, status_code=code)

    for error_type in (ValueError, RequestValidationError, ValidationError, BodyLimitError):
        app.add_exception_handler(error_type, error_handler)

    @app.get("/health")
    def health():
        return {"status": "ready", "version": "0.1.0"}

    @app.post("/api/assets")
    async def upload(files: list[UploadFile] = File()):
        if not files or len(files) > MAX_REFERENCES:
            raise ImageError("Import between 1 and 20 reference images")
        imported, total = [], 0
        try:
            for file in files:
                data = await file.read(MAX_IMAGE_BYTES + 1)
                total += len(data)
                if total > MAX_UPLOAD_BYTES:
                    raise ImageError("Combined upload exceeds 200 MiB")
                ref = await run_in_threadpool(assets.import_image, data, file.filename or "image")
                imported.append(ref)
            return [ref.model_dump() for ref in imported]
        except BaseException:
            for ref in imported:
                assets.remove(ref.id)
            raise
        finally:
            for file in files:
                await file.close()

    @app.get("/api/assets/{asset_id}/metadata")
    def asset_metadata(asset_id: str):
        return assets.get(asset_id)

    @app.get("/api/assets/{asset_id}/{variant}")
    def image(asset_id: str, variant: Literal["reference", "preview", "thumbnail"]):
        assets.get(asset_id)
        return FileResponse(
            assets.path(asset_id, variant),
            media_type="image/webp" if variant == "thumbnail" else "image/png",
        )

    @app.get("/api/skills")
    def skills(
        q: str = Query(default="", max_length=200),
        category: str = "",
        tag: str = "",
        favorite: bool = False,
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=24, ge=1, le=48),
    ):
        return library.list(q, category, tag, favorite, offset, limit)

    @app.post("/api/skills")
    def save(body: SaveRequest):
        return library.save(body.profile, body.expected_revision)

    @app.post("/api/preview")
    def preview(profile: StyleProfile):
        return {"markdown": compile_skill(profile)}

    @app.get("/api/skills/{skill_id}")
    def get(skill_id: str, revision: int | None = Query(default=None, ge=1)):
        return library.get(skill_id, revision)

    @app.delete("/api/skills/{skill_id}")
    def delete(skill_id: str):
        library.delete(skill_id)
        return {"deleted": True}

    @app.post("/api/skills/{skill_id}/duplicate")
    def duplicate(skill_id: str):
        return library.duplicate(skill_id)

    @app.get("/api/skills/{skill_id}/revisions")
    def revisions(skill_id: str):
        return library.revisions(skill_id)

    @app.post("/api/skills/{skill_id}/restore")
    def restore(skill_id: str, body: RestoreRequest):
        return library.restore(skill_id, body.revision, body.expected_revision)

    @app.get("/api/skills/{skill_id}/export")
    def export(
        skill_id: str,
        format: Literal["zip", "json", "markdown"] = "zip",
        revision: int | None = Query(default=None, ge=1),
    ):
        saved = library.get(skill_id, revision)
        name = slug(saved["profile"]["name"])
        if format == "zip":
            data, mime, filename = (
                export_package(library, assets, skill_id, revision),
                "application/zip",
                name + ".zip",
            )
        elif format == "json":
            data, mime, filename = (
                StyleProfile.model_validate(saved["profile"]).model_dump_json(indent=2),
                "application/json",
                "style.json",
            )
        else:
            data, mime, filename = saved["markdown"], "text/markdown", "SKILL.md"
        return Response(
            data,
            media_type=mime,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @app.post("/api/import")
    async def import_skill(file: UploadFile = File()):
        try:
            data = await file.read(MAX_PACKAGE_BYTES + 1)
            return await run_in_threadpool(import_package, library, assets, data)
        finally:
            await file.close()

    @app.post("/api/jobs")
    async def start_job(body: JobRequest):
        return tasks.start(list(dict.fromkeys(body.reference_ids)), body.mode, body.model)

    @app.get("/api/jobs/{job_id}")
    def get_job(job_id: str):
        return library.get_job(job_id)

    @app.delete("/api/jobs/{job_id}")
    async def cancel_job(job_id: str):
        return tasks.cancel(job_id)

    @app.get("/api/settings")
    def settings():
        return {
            "theme": "dark",
            "ollama_url": "http://127.0.0.1:11434",
            "ollama_model": "",
            **library.settings(),
            "data_directory": str(data_dir),
        }

    @app.put("/api/settings")
    def update_settings(body: SettingsRequest):
        values = body.model_dump(exclude_none=True)
        if "ollama_url" in values:
            values["ollama_url"] = OllamaProvider(values["ollama_url"]).url
        library.update_settings(values)
        return settings()

    @app.get("/api/providers/ollama")
    async def provider():
        try:
            url = library.settings().get("ollama_url", "http://127.0.0.1:11434")
            models = await asyncio.wait_for(OllamaProvider(url).models(), timeout=30)
            return {"available": True, "models": models, "error": None}
        except (ProviderError, TimeoutError) as exc:
            return {
                "available": False,
                "models": [],
                "error": str(exc) or "Ollama discovery timed out",
            }

    return app
