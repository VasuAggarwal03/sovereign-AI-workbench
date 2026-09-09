from pathlib import Path

from pypdf import PdfReader
from docx import Document


SUPPORTED_EXTENSIONS = {".pdf", ".docx"}


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF document."""

    reader = PdfReader(file_path)

    pages = []

    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)

    return "\n".join(pages).strip()


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX document."""

    document = Document(file_path)

    paragraphs = [
        paragraph.text
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    ]

    return "\n".join(paragraphs).strip()


def extract_text(file_path: str) -> str:
    """Extract text from a supported PDF or DOCX file."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    extension = path.suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type: {extension}. "
            "Only PDF and DOCX files are supported."
        )

    if extension == ".pdf":
        return extract_text_from_pdf(str(path))

    if extension == ".docx":
        return extract_text_from_docx(str(path))

    raise ValueError("Unsupported document type.")
def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split extracted text into overlapping chunks."""

    if not text.strip():
        return []

    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start += chunk_size - overlap

    return chunks


def test_chunk_text_empty():
    from app.services.document_service import chunk_text

    chunks = chunk_text("")

    assert chunks == []