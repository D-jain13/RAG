import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.tenancy import get_tenant_id
from backend.db.session import get_db
from backend.embeddings.embedding import aembed_texts
from backend.llm.llm import build_messages, get_llm
from backend.reranker.rerank import rerank
from backend.retrieval import hybrid_search
from backend.retrieval.schema import Hit

router = APIRouter(prefix="/chat", tags=["chat"])

NO_ANSWER = "I couldn't find anything relevant in your documents."


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class Source(BaseModel):
    ref: int
    document_id: uuid.UUID
    filename: str
    heading_path: str | None
    chunk_index: int


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await answer(db, tenant_id, body.question)


async def answer(db, tenant_id, question: str) -> ChatResponse:
    qvec = (await aembed_texts([question]))[0]
    candidates = await hybrid_search(db, tenant_id, question, qvec)
    if not candidates:
        return ChatResponse(answer=NO_ANSWER, sources=[])

    top = await rerank(question, candidates, top_n=6)
    context, used = build_context(top)

    resp = await get_llm().ainvoke(build_messages(question, context))
    return ChatResponse(
        answer=resp.content,
        sources=[
            Source(
                ref=i,
                document_id=h.document_id,
                filename=h.filename,
                heading_path=h.heading_path,
                chunk_index=h.chunk_index,
            )
            for i, h in enumerate(used, 1)
        ],
    )


MAX_CONTEXT_CHARS = 12_000  # roughly 3k tokens; tune to your model


def build_context(hits: list[Hit]) -> tuple[str, list[Hit]]:
    parts, used, total = [], [], 0
    for h in hits:
        header = f"[{len(used) + 1}] {h.filename}" + (
            f" > {h.heading_path}" if h.heading_path else ""
        )
        block = f"{header}\n{h.text}"
        if total + len(block) > MAX_CONTEXT_CHARS and used:
            break
        parts.append(block)
        used.append(h)
        total += len(block)
    return "\n\n---\n\n".join(parts), used
