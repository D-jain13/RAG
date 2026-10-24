import uuid
from dataclasses import dataclass
from typing import BinaryIO

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.enum.document_status import DocumentStatus
from backend.storage.storage import LocalStorage, build_storage_key
from backend.models.document import Document


async def _get_existing(db: AsyncSession, tenant_id: uuid.UUID, sha256: bytes):
    return (
        await db.execute(
            select(Document).where(
                Document.tenant_id == tenant_id, Document.sha256 == sha256
            )
        )
    ).scalar_one_or_none()


async def _retry_failed(db: AsyncSession, doc: Document) -> bool:
    """Atomically flip failed -> pending so a re-upload retries processing."""
    res = await db.execute(
        update(Document)
        .where(Document.id == doc.id, Document.status == DocumentStatus.FAILED.value)
        .values(status=DocumentStatus.PENDING.value, failure_reason=None)
        .returning(Document.id)
    )
    if res.scalar_one_or_none() is None:
        return False
    await db.refresh(doc)
    return True


@dataclass(frozen=True)
class IngestResult:
    document: Document
    created: bool  # a brand-new row was inserted
    should_enqueue: bool  # new row, or a previously failed one reset to pending


async def ingest_upload(
    db: AsyncSession,
    storage: LocalStorage,
    *,
    tenant_id: uuid.UUID,
    spooled: BinaryIO,
    sha256: bytes,
    size_bytes: int,
    filename: str,
    content_type: str | None,
) -> IngestResult:
    """Exact-bytes dedup scoped to the tenant, then a `pending` row for the worker.

    Order matters: blob first (idempotent, content-addressed), then the row
    (decided by the DB unique constraint, so concurrent uploads can't both win),
    then commit. The caller enqueues only after this returns, so a worker can
    never see a job whose row isn't committed yet.
    """
    existing = await _get_existing(db, tenant_id, sha256)
    if existing is not None:
        requeue = await _retry_failed(db, existing)
        await db.commit()
        return IngestResult(existing, created=False, should_enqueue=requeue)

    key = build_storage_key(tenant_id, sha256)
    await storage.put(key, spooled)

    inserted = (
        await db.execute(
            pg_insert(Document)
            .values(
                tenant_id=tenant_id,
                sha256=sha256,
                filename=filename,
                size_bytes=size_bytes,
                content_type=content_type,
                storage_key=key,
            )
            .on_conflict_do_nothing(constraint="uq_documents_tenant_sha256")
            .returning(Document)
        )
    ).scalar_one_or_none()

    if inserted is not None:
        await db.commit()
        return IngestResult(inserted, created=True, should_enqueue=True)

    # Lost the race to a concurrent identical upload: return the winner's row.
    existing = await _get_existing(db, tenant_id, sha256)
    await db.commit()
    assert existing is not None
    return IngestResult(existing, created=False, should_enqueue=False)
