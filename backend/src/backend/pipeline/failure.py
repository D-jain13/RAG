import logging
import uuid

from sqlalchemy import delete, update

from backend.db.session import AsyncSessionLocal
from backend.enum.document_status import DocumentStatus
from backend.models.chunk import Chunk
from backend.models.document import Document
from backend.pipeline.common import _ACTIVE, now

log = logging.getLogger(__name__)


async def fail_document(document_id: uuid.UUID, reason: str) -> None:
    """Mark an in-flight document failed and drop its partial chunks."""
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Chunk).where(Chunk.document_id == document_id))
        await db.execute(
            update(Document)
            .where(Document.id == document_id, Document.status.in_(_ACTIVE))
            .values(
                status=DocumentStatus.FAILED.value,
                failure_reason=reason[:255],
                indexed_at=now(),
            )
        )
        await db.commit()
    log.warning("document %s failed: %s", document_id, reason)
