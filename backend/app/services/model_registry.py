"""
Central registry for all locally available AI models.

Keeping model definitions in one place makes the system
model-agnostic and allows new models to be added without
changing the rest of the application.
"""

MODELS = {
    "general": {
        "name": "qwen3:4b",
        "description": "General-purpose local reasoning model",
    },

    "coding": {
        "name": "qwen2.5-coder:3b",
        "description": "Local model specialized for programming tasks",
    },

    "document": {
        "name": "qwen3:4b",
        "description": "Local model used for document-grounded RAG",
    },

    "vision": {
        "name": "qwen2.5vl:3b",
        "description": "Local vision-language model",
    },
}


def get_model(task: str) -> str:
    """
    Return the Ollama model assigned to a task.
    """

    task = task.lower().strip()

    if task not in MODELS:
        task = "general"

    return MODELS[task]["name"]


def get_model_info(task: str) -> dict:
    """
    Return complete model information for a task.
    """

    task = task.lower().strip()

    if task not in MODELS:
        task = "general"

    return MODELS[task]