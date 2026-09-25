import httpx

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"

DEFAULT_MODEL = "qwen3:4b"


async def generate_response(
    prompt: str,
    model: str = DEFAULT_MODEL,
) -> str:
    """
    Generate a response using a local Ollama model.
    """

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json=payload,
        )

        response.raise_for_status()

        data = response.json()

    return data["response"]