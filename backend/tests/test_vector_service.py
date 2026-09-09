from app.services.vector_service import add_chunks, search_chunks


def test_vector_search():
    chunks = [
        "Machine learning is a branch of artificial intelligence.",
        "Python is a popular programming language.",
        "Qdrant is a vector database used for similarity search."
    ]

    add_chunks(chunks)

    results = search_chunks("What is machine learning?", limit=2)

    assert len(results) > 0
    assert "machine learning" in results[0]["text"].lower()