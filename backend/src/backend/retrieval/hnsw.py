import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.enum.document_status import DocumentStatus
from backend.models.chunk import Chunk
from backend.models.document import Document

from .common import HIT_COLUMNS, row_to_hit
from .schema import Hit

setting = get_settings()

# SET doesn't accept bind parameters (asyncpg sends $1), so use set_config().
# The third argument makes it transaction-local, like SET LOCAL. One statement
# sets all three, so it costs a single round trip.
_SET_CONFIG = text("""
    SELECT
        set_config('hnsw.ef_search', :ef_search, true),
        set_config('hnsw.iterative_scan', 'strict_order', true),
        set_config('hnsw.max_scan_tuples', :max_scan_tuples, true)
""").bindparams(
    ef_search=str(setting.hnsw_ef_search),
    max_scan_tuples=str(setting.hnsw_max_scan_tuples),
)


async def hnsw_search(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    qvec,
    k: int,
) -> list[Hit]:
    # The tenant and status filters run after the index scan. Iterative scan
    # keeps walking the graph until k rows survive them (up to max_scan_tuples).
    # strict_order keeps ranks exact, which the RRF fusion depends on.
    await db.execute(_SET_CONFIG)

    stmt = (
        select(*HIT_COLUMNS)
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.tenant_id == tenant_id,
            Chunk.embedding.is_not(None),
            Document.status == DocumentStatus.INDEXED.value,
        )
        .order_by(Chunk.embedding.cosine_distance(qvec))
        .limit(k)
    )

    return [
        row_to_hit(r)
        for r in (await db.execute(stmt)).all()
    ]