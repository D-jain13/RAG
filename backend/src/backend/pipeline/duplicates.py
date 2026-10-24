import uuid

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.enum.document_status import DocumentStatus
from backend.models.document import Document
from backend.pipeline.common import now


async def finish_as_duplicate(
    db: AsyncSession,
    document_id: uuid.UUID,
    status: DocumentStatus,
    duplicate_of: uuid.UUID,
    similarity: float,
    **fields,
) -> None:
    await db.execute(
        update(Document)
        .where(Document.id == document_id)
        .values(
            status=status.value,
            duplicate_of=duplicate_of,
            similarity=similarity,
            indexed_at=now(),
            **fields,
        )
    )
    await db.commit()
