from app.services.vector_service import search_chunks
from app.services.ollama_service import generate_response


# ============================================================
# RETRIEVE DOCUMENT CONTEXT
# ============================================================

def retrieve_context(
    query: str,
    document_id: str | None = None,
    limit: int = 5
) -> str:
    """
    Retrieve relevant chunks from the uploaded document.
    """

    results = search_chunks(
        query,
        document_id=document_id,
        limit=limit
    )

    if not results:
        return ""

    context_parts = []

    for result in results:
        text = result.get("text", "")

        if text:
            context_parts.append(text)

    return "\n\n".join(context_parts)


# ============================================================
# QUESTION ROUTER
# ============================================================

async def classify_question(query: str) -> str:
    """
    Decide whether the user's question is related to
    the uploaded document or is a general question.

    Returns:
        DOCUMENT
        GENERAL
    """

    router_prompt = f"""
You are a question router.

Classify the user's question into exactly ONE of these categories:

DOCUMENT
GENERAL

DOCUMENT means:
- The user is asking about the uploaded document.
- The user refers to the assignment, PDF, document, file,
  questions, sections, data, instructions, or content
  that may be inside the uploaded document.
- The user uses phrases such as:
  "in the document"
  "in the PDF"
  "in the assignment"
  "question 1"
  "what does the file say"
  "explain this assignment"

GENERAL means:
- The question does not depend on the uploaded document.
- The user is asking for general knowledge, explanation,
  casual information, coding help, mathematics, science,
  current knowledge, or any topic unrelated to the document.

User Question:
{query}

Return ONLY:
DOCUMENT
or
GENERAL

Classification:
"""

    result = await generate_response(router_prompt)

    result = result.strip().upper()

    print("🔥 QUESTION ROUTER RESULT:", result)

    if "DOCUMENT" in result:
        return "DOCUMENT"

    return "GENERAL"


# ============================================================
# MAIN RAG QUERY
# ============================================================

async def rag_query(
    query: str,
    document_id: str | None = None
) -> str:

    print("🔥 RAG QUERY RECEIVED:", query)
    print("📄 DOCUMENT ID:", document_id)

    # --------------------------------------------------------
    # NO DOCUMENT UPLOADED
    # --------------------------------------------------------

    if not document_id:

        print("🟡 NO DOCUMENT → DIRECT OLLAMA")

        response = await generate_response(query)

        return response

    # --------------------------------------------------------
    # CLASSIFY QUESTION
    # --------------------------------------------------------

    question_type = await classify_question(query)

    # --------------------------------------------------------
    # GENERAL QUESTION
    # --------------------------------------------------------

    if question_type == "GENERAL":

        print("🟡 GENERAL QUESTION → DIRECT OLLAMA")

        response = await generate_response(query)

        return response

    # --------------------------------------------------------
    # DOCUMENT QUESTION
    # --------------------------------------------------------

    print("🟢 DOCUMENT QUESTION → RAG")

    context = retrieve_context(
        query,
        document_id=document_id
    )

    print("🔥 RETRIEVED CONTEXT:")
    print(context[:2000])

    # --------------------------------------------------------
    # NO RELEVANT DOCUMENT CONTENT
    # --------------------------------------------------------

    if not context:

        return (
            "I could not find relevant information "
            "in the provided document."
        )

    # --------------------------------------------------------
    # DOCUMENT ANSWERING PROMPT
    # --------------------------------------------------------

    prompt = f"""
You are a helpful AI assistant.

Answer the user's question using ONLY the provided
document context.

If the answer is not present in the document context,
clearly say:

"I could not find this information in the provided document."

Do not invent information.
Do not use outside knowledge.

Document Context:
{context}

User Question:
{query}
 
Answer:
"""

    response = await generate_response(prompt)

    return response