from app.services.vector_service import search_chunks
from app.services.ollama_service import generate_response
from app.services.model_router import route_model


def retrieve_context(
    query: str,
    document_id: str | None = None,
    limit: int = 5
) -> str:
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


async def classify_question(query: str) -> str:
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
  coding help, mathematics, science, or any topic unrelated
  to the document.

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


async def rag_query(
    query: str,
    document_id: str | None = None
) -> str:

    print("🔥 RAG QUERY RECEIVED:", query)
    print("📄 DOCUMENT ID:", document_id)

    # --------------------------------------------------
    # NO DOCUMENT
    # --------------------------------------------------

    if not document_id:
        model_route = route_model(query)

        print("🧠 MODEL ROUTE:", model_route)

        response = await generate_response(
            query,
            model=model_route["model"]
        )

        return response

    # --------------------------------------------------
    # DOCUMENT PRESENT
    # --------------------------------------------------

    question_type = await classify_question(query)

    # --------------------------------------------------
    # GENERAL QUESTION WITH DOCUMENT ATTACHED
    # --------------------------------------------------

    if question_type == "GENERAL":

        model_route = route_model(query)

        print("🧠 MODEL ROUTE:", model_route)

        response = await generate_response(
            query,
            model=model_route["model"]
        )

        return response

    # --------------------------------------------------
    # DOCUMENT QUESTION
    # --------------------------------------------------

    print("🟢 DOCUMENT QUESTION → RAG")

    model_route = route_model(
        query,
        document_id=document_id
    )

    print("🧠 MODEL ROUTE:", model_route)

    context = retrieve_context(
        query,
        document_id=document_id
    )

    print("🔥 RETRIEVED CONTEXT:")
    print(context[:2000])

    if not context:
        return (
            "I could not find relevant information "
            "in the provided document."
        )

    prompt = f"""
You are a helpful AI assistant.

Answer the user's question using ONLY the provided document context.

If the answer is not present in the document context, clearly say:

"I could not find this information in the provided document."

Do not invent information.
Do not use outside knowledge.

Document Context:
{context}

User Question:
{query}

Answer:
"""

    response = await generate_response(
        prompt,
        model=model_route["model"]
    )

    return response