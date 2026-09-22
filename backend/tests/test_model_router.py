from app.services.model_router import route_model


def test_general_question():
    result = route_model(
        "What is machine learning?"
    )

    assert result["task"] == "general"
    assert result["model"] == "qwen3:4b"


def test_coding_question():
    result = route_model(
        "Write a Python function to reverse a string."
    )

    assert result["task"] == "coding"
    assert result["model"] == "qwen2.5-coder:3b"


def test_document_question():
    result = route_model(
        "What does section 4 of the document say?",
        document_id="test-document-123",
    )

    assert result["task"] == "document"
    assert result["model"] == "qwen3:4b"