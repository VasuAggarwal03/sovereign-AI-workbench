from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)

from sentence_transformers import SentenceTransformer


# ============================================================
# CONFIGURATION
# ============================================================

COLLECTION_NAME = "documents"
VECTOR_SIZE = 384

client = QdrantClient(path="./qdrant_data")

model = SentenceTransformer("all-MiniLM-L6-v2")


# ============================================================
# CREATE COLLECTION
# ============================================================

def create_collection():
    """
    Create the Qdrant collection if it does not already exist.
    """

    collections = client.get_collections().collections

    existing_names = [collection.name for collection in collections]

    if COLLECTION_NAME not in existing_names:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE,
            ),
        )


# ============================================================
# ADD DOCUMENT CHUNKS
# ============================================================

def add_chunks(
    chunks: list[str],
    document_id: str | None = None,
    filename: str | None = None,
):
    """
    Convert document chunks into embeddings and store them in Qdrant.

    document_id:
        ID used to identify which document the chunks belong to.

    filename:
        Original uploaded filename.
    """

    create_collection()

    # If no document_id is provided, create one.
    if document_id is None:
        document_id = str(uuid4())

    points = []

    for chunk in chunks:

        if not chunk.strip():
            continue

        embedding = model.encode(chunk).tolist()

        point = PointStruct(
            id=str(uuid4()),
            vector=embedding,
            payload={
                "text": chunk,
                "document_id": document_id,
                "filename": filename,
            },
        )

        points.append(point)

    if points:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points,
        )

    return document_id


# ============================================================
# SEARCH DOCUMENT CHUNKS
# ============================================================

def search_chunks(
    query: str,
    document_id: str | None = None,
    limit: int = 5,
):
    """
    Search for the most relevant document chunks.

    If document_id is provided:
        Search only inside that document.

    If document_id is None:
        Search across all uploaded documents.
    """

    create_collection()

    query_embedding = model.encode(query).tolist()

    search_filter = None

    # --------------------------------------------------------
    # Filter by document_id when provided
    # --------------------------------------------------------

    if document_id:

        search_filter = Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(
                        value=document_id
                    ),
                )
            ]
        )

    # --------------------------------------------------------
    # Qdrant similarity search
    # --------------------------------------------------------

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_embedding,
        query_filter=search_filter,
        limit=limit,
    ).points

    # --------------------------------------------------------
    # Return clean results
    # --------------------------------------------------------

    return [
        {
            "text": result.payload.get("text", ""),
            "score": result.score,
            "document_id": result.payload.get("document_id"),
            "filename": result.payload.get("filename"),
        }
        for result in results
    ]