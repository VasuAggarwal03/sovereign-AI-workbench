import pytest

from app.services.rag_service import rag_query


@pytest.mark.asyncio
async def test_rag_query():
    result = await rag_query("What is machine learning?")

    assert result is not None
    assert isinstance(result, str)
    assert len(result) > 0