import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.enum.document_status import DocumentStatus
from backend.models.chunk import Chunk
from backend.models.document import Document

from .common import row_to_hit
from .schema import Hit

EF_SEARCH = 100


async def hnsw_search(
    db: AsyncSession, tenant_id: uuid.UUID, qvec, k: int
) -> list[Hit]:
    # Applies to this transaction only. The filters below run after the index
    # scan, so a higher ef_search keeps enough candidates after filtering.
    await db.execute(text(f"SET LOCAL hnsw.ef_search = {int(EF_SEARCH)}"))

    stmt = (
        select(
            Chunk.id.label("chunk_id"),
            Chunk.document_id,
            Chunk.heading_path,
            Chunk.chunk_index,
            Chunk.text,
            Document.filename,
        )
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.tenant_id == tenant_id,
            Chunk.embedding.is_not(None),
            Document.status == DocumentStatus.INDEXED.value,
        )
        .order_by(Chunk.embedding.cosine_distance(qvec))
        .limit(k)
    )
    return [row_to_hit(r) for r in (await db.execute(stmt)).all()]
