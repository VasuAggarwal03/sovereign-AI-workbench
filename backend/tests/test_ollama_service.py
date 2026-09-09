import pytest

from app.services.ollama_service import generate_response


@pytest.mark.anyio
async def test_ollama_response():
    response = await generate_response(
        "What is machine learning? Answer in one short sentence."
    )

    assert isinstance(response, str)
    assert len(response.strip()) > 0