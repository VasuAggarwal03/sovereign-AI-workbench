from app.services.document_service import extract_text, chunk_text
from app.services.vector_service import add_chunks


def ingest_document(
    file_path: str,
    document_id: str,
    filename: str
) -> int:
    """
    Extract text from a PDF/DOCX, split it into chunks,
    and store the chunks in Qdrant.
    """

    text = extract_text(file_path)

    chunks = chunk_text(
        text,
        chunk_size=500,
        overlap=50
    )

    add_chunks(
        chunks,
        document_id=document_id,
        filename=filename
    )

    return len(chunks)