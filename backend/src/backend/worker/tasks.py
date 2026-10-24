import logging
import uuid
from datetime import timedelta

from procrastinate import JobContext, RetryStrategy
from procrastinate.exceptions import AlreadyEnqueued
from sqlalchemy import func, select

from backend.core.config import get_settings
from backend.db.session import AsyncSessionLocal
from backend.enum.document_status import DocumentStatus
from backend.pipeline import (
    chunk_stage,
    embed_stage,
    extract_stage,
    fail_document,
)
from backend.models.document import Document
from backend.worker.queue import app

log = logging.getLogger(__name__)


async def enqueue_process_document(document_id: uuid.UUID) -> bool:
    """Defer processing. Returns False if a job for this document is already queued.

    `queueing_lock` makes a second enqueue a no-op while the first is still waiting.
    """
    try:
        await process_document.configure(queueing_lock=str(document_id)).defer_async(
            document_id=str(document_id)
        )
    except AlreadyEnqueued:
        return False
    return True


MAX_ATTEMPTS = 4
RETRY = RetryStrategy(max_attempts=MAX_ATTEMPTS, exponential_wait=3)


async def _run_stage(context: JobContext, document_id: str, stage) -> bool:
    """Run a stage; on the last failed attempt mark the document failed."""
    try:
        return await stage(uuid.UUID(document_id))
    except Exception as exc:
        # `attempts` counts earlier runs, so the final retry sees MAX_ATTEMPTS.
        if context.job.attempts >= MAX_ATTEMPTS:
            await fail_document(uuid.UUID(document_id), f"{type(exc).__name__}: {exc}")
        raise


async def _defer_next(task, document_id: str) -> None:
    try:
        await task.configure(queueing_lock=f"{task.name}:{document_id}").defer_async(
            document_id=document_id
        )
    except AlreadyEnqueued:
        pass


@app.task(name="process_document", retry=RETRY, pass_context=True)
async def process_document(context: JobContext, document_id: str) -> None:
    """Stage 1: parse, normalize, exact + near-duplicate checks."""
    if await _run_stage(context, document_id, extract_stage):
        await _defer_next(chunk_document, document_id)


@app.task(name="chunk_document", retry=RETRY, pass_context=True)
async def chunk_document(context: JobContext, document_id: str) -> None:
    """Stage 2: split the normalized text into chunk rows."""
    if await _run_stage(context, document_id, chunk_stage):
        await _defer_next(embed_document, document_id)


@app.task(name="embed_document", queue="embed", retry=RETRY, pass_context=True)
async def embed_document(context: JobContext, document_id: str) -> None:
    """Stage 3: embed chunks, then index the document."""
    await _run_stage(context, document_id, embed_stage)


@app.periodic(cron="*/5 * * * *")
@app.task(name="requeue_stale_pending", queueing_lock="requeue_stale_pending")
async def requeue_stale_pending(timestamp: int) -> None:
    """Safety net for the commit -> enqueue gap: re-defer rows stuck in `pending`."""
    cutoff = func.now() - timedelta(seconds=get_settings().pending_sweep_after_seconds)
    async with AsyncSessionLocal() as db:
        ids = (
            (
                await db.execute(
                    select(Document.id).where(
                        Document.status == DocumentStatus.PENDING.value,
                        Document.created_at < cutoff,
                    )
                )
            )
            .scalars()
            .all()
        )
    for doc_id in ids:
        await enqueue_process_document(doc_id)
    if ids:
        log.info("requeued %d stale pending documents", len(ids))
