import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Literal

from backend.core.tenancy import get_tenant_id
from backend.db.session import get_db
from backend.embeddings.embedding import aembed_texts
from backend.core.config import get_settings
from backend.llm.llm import NO_ANSWER, build_messages, condense_question, get_llm
from backend.reranker.rerank import rerank
from backend.retrieval import hybrid_search
from backend.retrieval.schema import Hit
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

settings = get_settings()


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    # Earlier turns, oldest first; the server only uses the most recent few.
    history: list[HistoryMessage] = Field(default_factory=list, max_length=50)

    def history_dicts(self) -> list[dict]:
        return [m.model_dump() for m in self.history]


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
    return await answer(
        db, tenant_id, body.question, body.history_dicts()
    )


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    # Retrieval finishes before streaming starts, so the DB session isn't
    # needed once the response begins and failures here are plain HTTP errors.
    messages, sources = await retrieve(
        db, tenant_id, body.question, body.history_dicts()
    )

    # Release the connection before the LLM call
    await db.commit()

    return StreamingResponse(
        _event_stream(messages, sources),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _event_stream(
    messages, sources: list[Source]
) -> AsyncIterator[str]:
    if messages is None:
        yield _sse("token", NO_ANSWER)
        yield _sse("done", {})
        return

    yield _sse(
        "sources",
        [s.model_dump(mode="json") for s in sources],
    )

    try:
        async for chunk in get_llm().astream(messages):
            text = chunk.content
            if isinstance(text, str) and text:
                yield _sse("token", text)
    except Exception:
        log.exception("chat stream failed")
        yield _sse(
            "error",
            "The answer could not be completed. Please try again.",
        )
        return

    yield _sse("done", {})


async def retrieve(
    db,
    tenant_id,
    question: str,
    history: list[dict] | None = None,
):
    """Run retrieval + rerank. Returns (llm messages | None, sources)."""

    # Retrieval needs a standalone query; the answer step still gets the original.
    search_query = await condense_question(question, history or [])
    qvec = (await aembed_texts([search_query]))[0]

    candidates = await hybrid_search(
        db, tenant_id, search_query, qvec
    )

    if not candidates:
        return None, []

    top, scored = await rerank(
        search_query, candidates, top_n=6
    )

    if top:
        log.info(
            "rerank top score=%.4f scored=%s",
            top[0].score,
            scored,
        )

    # Unscored (rerank failed / single hit): fail open, the prompt handles refusal.
    if scored and top[0].score < settings.rerank_min_score:
        return None, []

    context, used = build_context(top)

    sources = [
        Source(
            ref=i,
            document_id=h.document_id,
            filename=h.filename,
            heading_path=h.heading_path,
            chunk_index=h.chunk_index,
        )
        for i, h in enumerate(used, 1)
    ]

    return build_messages(
        question, context, history
    ), sources


async def answer(
    db,
    tenant_id,
    question: str,
    history: list[dict] | None = None,
) -> ChatResponse:
    messages, sources = await retrieve(
        db, tenant_id, question, history
    )

    # Release the connection before the LLM call
    await db.commit()

    if messages is None:
        return ChatResponse(answer=NO_ANSWER, sources=[])

    resp = await get_llm().ainvoke(messages)

    return ChatResponse(
        answer=resp.content,
        sources=sources,
    )


MAX_CONTEXT_CHARS = 12_000  # roughly 3k tokens; tune to your model


def _escape_tags(text: str) -> str:
    """Stops document text from forming tags such as </context> inside the prompt."""
    return text.replace("<", "&lt;")


def build_context(hits: list[Hit]) -> tuple[str, list[Hit]]:
    parts, used, total = [], [], 0

    for h in hits:
        header = f"[{len(used) + 1}] {_escape_tags(h.filename)}" + (
            f" > {_escape_tags(h.heading_path)}"
            if h.heading_path
            else ""
        )

        block = f"{header}\n{_escape_tags(h.text)}"

        if total + len(block) > MAX_CONTEXT_CHARS and used:
            break

        parts.append(block)
        used.append(h)
        total += len(block)

    return "\n\n---\n\n".join(parts), used
