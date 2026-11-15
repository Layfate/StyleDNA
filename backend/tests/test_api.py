import time

from fastapi.testclient import TestClient
from test_core import image_bytes


def client_for(tmp_path):
    from styledna.app import create_app

    return TestClient(
        create_app(tmp_path, "test-secret", allowed_hosts={"testserver"}),
        headers={"Authorization": "Bearer test-secret"},
    )


def wait_job(client, job_id):
    for _ in range(100):
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["state"] not in ("queued", "running"):
            return job
        time.sleep(0.01)
    raise AssertionError("Job did not finish")


def test_api_requires_auth_and_rejects_origins_hosts(tmp_path):
    with client_for(tmp_path) as c:
        assert c.get("/health").status_code == 200
        assert c.get("/api/skills", headers={"Authorization": ""}).status_code == 401
        assert c.get("/api/skills", headers={"Origin": "https://evil.example"}).status_code == 403
        assert c.get("/api/skills", headers={"Host": "evil.example"}).status_code == 403
        assert c.get("/api/skills", headers={"Origin": "http://127.0.0.1:1420"}).status_code == 200
        assert (
            c.post("/api/skills", content="{}", headers={"Content-Type": "text/plain"}).status_code
            == 415
        )


def test_real_workflow_and_restart(tmp_path):
    from styledna.models import StyleProfile

    with client_for(tmp_path) as c:
        upload = c.post("/api/assets", files=[("files", ("red.png", image_bytes(), "image/png"))])
        assert upload.status_code == 200, upload.text
        ref = upload.json()[0]
        assert c.get(f"/api/assets/{ref['id']}/thumbnail").status_code == 200
        started = c.post("/api/jobs", json={"reference_ids": [ref["id"]], "mode": "measurements"})
        assert started.status_code == 200, started.text
        job = wait_job(c, started.json()["id"])
        assert job["state"] == "completed"
        assert job["result"]["palette"][0]["hex"] == "#FF0000"
        p = StyleProfile(
            name="Red paper",
            reference_ids=[ref["id"]],
            palette=job["result"]["palette"],
            analysis=job["result"],
        )
        saved = c.post("/api/skills", json={"profile": p.model_dump(), "expected_revision": 0})
        assert saved.status_code == 200, saved.text
        package = c.get(f"/api/skills/{p.id}/export?format=zip")
        imported = c.post(
            "/api/import", files={"file": ("skill.zip", package.content, "application/zip")}
        )
        assert imported.status_code == 200, imported.text
        assert imported.json()["profile"]["id"] != p.id
        assert c.get("/api/skills").json()["total"] == 2
        assert c.get(f"/api/skills/{p.id}/export?format=markdown").text.startswith("---")
        assert (
            c.post(
                "/api/skills", json={"profile": p.model_dump(), "expected_revision": 0}
            ).status_code
            == 409
        )
    with client_for(tmp_path) as c:
        assert c.get(f"/api/skills/{p.id}").json()["profile"]["name"] == "Red paper"


def test_partial_upload_failure_is_atomic(tmp_path):
    with client_for(tmp_path) as c:
        response = c.post(
            "/api/assets",
            files=[
                ("files", ("ok.png", image_bytes(), "image/png")),
                ("files", ("bad.png", b"not an image", "image/png")),
            ],
        )
        assert response.status_code == 422
        assert list((tmp_path / "assets").iterdir()) == []


def test_unavailable_ollama_is_explicit_failure(tmp_path, monkeypatch):
    import styledna.ollama as ollama

    async def fail(*args, **kwargs):
        raise ollama.ProviderError("Ollama unavailable; start it and retry")

    monkeypatch.setattr(ollama.OllamaProvider, "analyze", fail)
    with client_for(tmp_path) as c:
        ref = c.post("/api/assets", files={"files": ("r.png", image_bytes())}).json()[0]
        job = c.post(
            "/api/jobs", json={"reference_ids": [ref["id"]], "mode": "ollama", "model": "vision"}
        ).json()
        result = wait_job(c, job["id"])
        assert result["state"] == "failed"
        assert "unavailable" in result["error"]
        assert result["result"] is None
        assert c.get("/api/skills").json()["total"] == 0


def test_settings_reject_remote_ollama_and_unknown_keys(tmp_path):
    with client_for(tmp_path) as c:
        assert c.put("/api/settings", json={"ollama_url": "https://example.com"}).status_code == 422
        assert c.put("/api/settings", json={"api_key": "no"}).status_code == 422
        assert c.put("/api/settings", json={"theme": "light"}).json()["theme"] == "light"


def test_cancelled_job_never_produces_result(tmp_path, monkeypatch):
    import asyncio

    import styledna.ollama as ollama

    async def slow(*args, **kwargs):
        await asyncio.sleep(5)
        raise AssertionError("Cancelled work should not complete")

    monkeypatch.setattr(ollama.OllamaProvider, "analyze", slow)
    with client_for(tmp_path) as c:
        ref = c.post("/api/assets", files={"files": ("r.png", image_bytes())}).json()[0]
        job = c.post(
            "/api/jobs", json={"reference_ids": [ref["id"]], "mode": "ollama", "model": "v"}
        ).json()
        cancelled = c.delete(f"/api/jobs/{job['id']}").json()
        assert cancelled["state"] == "cancelled"
        time.sleep(0.03)
        assert c.get(f"/api/jobs/{job['id']}").json()["result"] is None


def test_startup_marks_unfinished_work_interrupted(tmp_path):
    from styledna.assets import AssetStore
    from styledna.database import Library

    lib = Library(tmp_path, AssetStore(tmp_path))
    lib.put_job({"id": "a" * 32, "state": "running", "result": None})
    with client_for(tmp_path) as c:
        assert c.get("/api/jobs/" + "a" * 32).json()["state"] == "interrupted"


def test_limits_and_empty_jobs_are_actionable(tmp_path):
    with client_for(tmp_path) as c:
        assert (
            c.post("/api/jobs", json={"reference_ids": [], "mode": "measurements"}).status_code
            == 422
        )
        assert (
            c.post(
                "/api/jobs", json={"reference_ids": ["../x"], "mode": "measurements"}
            ).status_code
            == 422
        )
        response = c.post(
            "/api/assets",
            content=b"x",
            headers={"Content-Length": str(300 * 1024**2), "Content-Type": "multipart/form-data"},
        )
        assert response.status_code == 413
