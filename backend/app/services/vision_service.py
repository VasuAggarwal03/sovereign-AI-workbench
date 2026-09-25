import base64

import httpx

from app.services.model_registry import get_model


OLLAMA_CHAT_URL = "http://127.0.0.1:11434/api/chat"


async def analyze_image(
    image_bytes: bytes,
    prompt: str = (
        "Analyze this image carefully. "
        "Describe the important visual information, "
        "including objects, text, diagrams, labels, "
        "and relationships between elements."
    ),
) -> str:
    """
    Analyze an image using the local vision model through Ollama.
    """

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    model = get_model("vision")

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [image_base64],
            }
        ],
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OLLAMA_CHAT_URL,
            json=payload,
        )

        response.raise_for_status()

        data = response.json()

    return data["message"]["content"]