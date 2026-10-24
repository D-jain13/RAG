import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from .bm25 import bm25_search
from .hnsw import hnsw_search
from .schema import Hit

W_BM25 = 0.35
W_VECTOR = 0.65
RRF_K = 60


def rrf(
    rankings: list[tuple[list[Hit], float]], k: int = RRF_K, limit: int = 30
) -> list[Hit]:
    """Weighted Reciprocal Rank Fusion: score = sum(weight / (k + rank))."""
    scores: dict[uuid.UUID, float] = {}
    by_id: dict[uuid.UUID, Hit] = {}
    for hits, weight in rankings:
        for rank, h in enumerate(hits, start=1):
            scores[h.chunk_id] = scores.get(h.chunk_id, 0.0) + weight / (k + rank)
            by_id.setdefault(h.chunk_id, h)
    fused = sorted(by_id.values(), key=lambda h: scores[h.chunk_id], reverse=True)
    fused = fused[:limit]
    for h in fused:
        h.score = scores[h.chunk_id]
    return fused


async def hybrid_search(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    question: str,
    qvec,
    per_source: int = 30,
    limit: int = 30,
) -> list[Hit]:
    # Sequential on purpose: one AsyncSession can't run two queries at once.
    vec = await hnsw_search(db, tenant_id, qvec, per_source)
    kw = await bm25_search(db, tenant_id, question, per_source)
    return rrf([(kw, W_BM25), (vec, W_VECTOR)], limit=limit)


__all__ = ["bm25_search", "hnsw_search", "hybrid_search", "rrf"]
