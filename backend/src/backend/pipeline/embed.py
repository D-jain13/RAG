import logging
import uuid

log = logging.getLogger(__name__)
from sqlalchemy import select, update

from backend.db.session import AsyncSessionLocal
from backend.enum.document_status import DocumentStatus
from backend.models.chunk import EMBED_DIM, Chunk
from backend.models.document import Document
from backend.pipeline.common import EMBED_BATCH, now
from backend.pipeline.finalise import finalize


async def embed_stage(document_id: uuid.UUID) -> bool:
    """Embeds chunks that have no vector yet, then indexes the document.

    Resumable: a retry only picks up chunks whose embedding is still NULL.
    Returns True if the document ended up `indexed`.
    """
    
    from backend.embeddings import embedding

    async with AsyncSessionLocal() as db:
        status = (
            await db.execute(select(Document.status).where(Document.id == document_id))
        ).scalar_one_or_none()
    if status != DocumentStatus.PROCESSING.value:
        log.info("document %s not processing, skipping embed", document_id)
        return False

    while True:
        async with AsyncSessionLocal() as db:
            rows = (
                await db.execute(
                    select(Chunk.id, Chunk.heading_path, Chunk.text)
                    .where(Chunk.document_id == document_id, Chunk.embedding.is_(None))
                    .order_by(Chunk.chunk_index)
                    .limit(EMBED_BATCH)
                )
            ).all()
        if not rows:
            break

        # No DB transaction is held open across the network call.
        vectors = await embedding.aembed_texts(
            [
                f"{r.heading_path}\n\n{r.text}" if r.heading_path else r.text
                for r in rows
            ]
        )
        if vectors.shape != (len(rows), EMBED_DIM):
            raise RuntimeError(f"unexpected embedding shape {vectors.shape}")

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Chunk),
                [
                    {"id": r.id, "embedding": v, "indexed_at": now()}
                    for r, v in zip(rows, vectors, strict=True)
                ],
            )
            await db.commit()

    return await finalize(document_id)
