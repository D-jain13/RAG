import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.enum.document_status import DocumentStatus

from .common import row_to_hit
from .schema import Hit

# The ORDER BY expression must match the indexed expression exactly
# (see the ix_chunks_bm25 migration), or Postgres won't use the index.
# Scores are negative: lower = better match, so ascending order is correct.
_SQL = text("""
    SELECT
        c.id AS chunk_id,
        c.document_id,
        c.heading_path,
        c.chunk_index,
        c.text,
        d.filename
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.tenant_id = :tenant_id
      AND d.status = :status
    ORDER BY (coalesce(c.heading_path, '') || ' ' || c.text)
             <@> to_bm25query(CAST(:q AS text), 'ix_chunks_bm25')
    LIMIT :k
""")

async def bm25_search(
    db: AsyncSession, tenant_id: uuid.UUID, question: str, k: int
) -> list[Hit]:
    rows = (
        await db.execute(
            _SQL,
            {
                "tenant_id": tenant_id,
                "status": DocumentStatus.INDEXED.value,
                "q": question,
                "k": k,
            },
        )
    ).all()
    return [row_to_hit(r) for r in rows]
