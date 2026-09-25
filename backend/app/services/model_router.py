"""
Intelligent local model router.

The router determines which specialized model should
handle a user request.
"""

from app.services.model_registry import get_model_info


CODING_KEYWORDS = {
    "code",
    "coding",
    "program",
    "programming",
    "python",
    "java",
    "javascript",
    "typescript",
    "c++",
    "cpp",
    "bug",
    "debug",
    "debugging",
    "function",
    "class",
    "algorithm",
    "leetcode",
    "sql",
    "query",
    "error",
    "exception",
    "compile",
    "compiler",
    "api",
}


def route_model(
    query: str,
    document_id: str | None = None,
) -> dict:
    """
    Determine the appropriate local model for a request.

    Priority:
    1. Document context → document model
    2. Coding-related query → coding model
    3. Everything else → general model
    """

    query_lower = query.lower()

    # Document-aware request
    if document_id:
        model_info = get_model_info("document")

        return {
            "task": "document",
            "model": model_info["name"],
            "reason": "Document context is active.",
        }

    # Coding request
    words = set(query_lower.replace(",", " ").split())

    if words.intersection(CODING_KEYWORDS):
        model_info = get_model_info("coding")

        return {
            "task": "coding",
            "model": model_info["name"],
            "reason": "Coding-related keywords detected.",
        }

    # General request
    model_info = get_model_info("general")

    return {
        "task": "general",
        "model": model_info["name"],
        "reason": "General-purpose request.",
    }