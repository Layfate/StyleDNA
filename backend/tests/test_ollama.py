import asyncio
import json

import httpx
import pytest
from test_core import image_bytes


def test_ollama_rejects_non_loopback_and_redirects():
    from styledna.ollama import OllamaProvider, ProviderError

    for url in (
        "https://evil.example",
        "http://127.0.0.1.evil.example",
        "http://user:pass@localhost",
        "http://localhost/path",
        "http://0.0.0.0:11434",
    ):
        with pytest.raises(ProviderError):
            OllamaProvider(url)


def test_ollama_uses_vision_capability_and_validates_result(tmp_path):
    from styledna.assets import AssetStore
    from styledna.ollama import OllamaProvider, ProviderError

    store = AssetStore(tmp_path)
    ref = store.import_image(image_bytes(), "red.png")
    seen = []

    def handler(request):
        seen.append(request.url.path)
        if request.url.path == "/api/show":
            return httpx.Response(200, json={"capabilities": ["completion", "vision"]})
        assert request.url.path == "/api/chat"
        payload = json.loads(request.content)
        assert payload["format"]["type"] == "object"
        assert payload["messages"][0]["images"]
        return httpx.Response(
            200,
            json={
                "message": {
                    "content": json.dumps(
                        {
                            "traits": {"lighting": "Soft diffused light"},
                            "positive_rules": ["Keep soft edges"],
                            "negative_constraints": [],
                            "subject_exclusions": ["Do not copy the subject"],
                        }
                    )
                }
            },
        )

    p = OllamaProvider(transport=httpx.MockTransport(handler))
    result = asyncio.run(p.analyze(store, [ref.id], "vision-model"))
    assert result.mode == "ollama"
    assert result.traits["lighting"].value == "Soft diffused light"
    assert result.traits["lighting"].source == "ollama"
    assert len(result.observations) == 1
    assert seen.count("/api/chat") == 1

    def malformed(request):
        if request.url.path == "/api/show":
            return httpx.Response(200, json={"capabilities": ["vision"]})
        return httpx.Response(200, json={"message": {"content": '{"run_command":"unsafe"}'}})

    with pytest.raises(ProviderError, match="valid|schema"):
        asyncio.run(
            OllamaProvider(transport=httpx.MockTransport(malformed)).analyze(store, [ref.id], "m")
        )


def test_text_model_is_not_accepted_as_vision(tmp_path):
    from styledna.assets import AssetStore
    from styledna.ollama import OllamaProvider, ProviderError

    def handler(request):
        return httpx.Response(200, json={"capabilities": ["completion"]})

    with pytest.raises(ProviderError, match="vision"):
        asyncio.run(
            OllamaProvider(transport=httpx.MockTransport(handler)).analyze(
                AssetStore(tmp_path), [], "text"
            )
        )
