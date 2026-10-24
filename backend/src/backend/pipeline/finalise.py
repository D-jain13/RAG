import logging
import uuid

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import undefer

from backend.db.session import AsyncSessionLocal
from backend.enum.document_status import DocumentStatus
from backend.models.chunk import Chunk
from backend.models.document import Document
from backend.models.lsh_band import LshBand
from backend.pipeline.common import now
from backend.pipeline.duplicates import finish_as_duplicate
from backend.pipeline.failure import fail_document
from backend.utils.minhash import (
    MINHASH_VERSION,
    band_hashes,
    minhash_from_bytes,
)

log = logging.getLogger(__name__)


async def finalize(document_id: uuid.UUID) -> bool:
    """LSH bands and `indexed` commit together, so a half-processed document is never
    a near-duplicate match target."""
    async with AsyncSessionLocal() as db:
        doc = (
            await db.execute(
                select(Document)
                .options(undefer(Document.minhash))
                .where(Document.id == document_id)
            )
        ).scalar_one()
        if doc.status != DocumentStatus.PROCESSING.value:
            return False

        total, unembedded = (
            await db.execute(
                select(
                    func.count(),
                    func.count().filter(Chunk.embedding.is_(None)),
                ).where(Chunk.document_id == document_id)
            )
        ).one()
        tenant_id, text_hash, minhash = doc.tenant_id, doc.text_sha256, doc.minhash

    if total == 0:
        await fail_document(document_id, "no chunks to index")
        return False
    if unembedded:
        raise RuntimeError(f"{unembedded} chunks still unembedded")  # retried

    bands = band_hashes(minhash_from_bytes(minhash))
    async with AsyncSessionLocal() as db:
        await db.execute(
            pg_insert(LshBand)
            .values(
                [
                    {
                        "document_id": document_id,
                        "band_idx": i,
                        "tenant_id": tenant_id,
                        "version": MINHASH_VERSION,
                        "band_hash": h,
                    }
                    for i, h in enumerate(bands)
                ]
            )
            .on_conflict_do_nothing()
        )
        await db.execute(
            update(Document)
            .where(Document.id == document_id)
            .values(status=DocumentStatus.INDEXED.value, indexed_at=now())
        )
        try:
            await db.commit()
        except IntegrityError:
            # A concurrent upload with identical text got `indexed` first
            # (partial unique index on tenant + text_sha256).
            await db.rollback()
            winner = (
                await db.execute(
                    select(Document.id).where(
                        Document.tenant_id == tenant_id,
                        Document.text_sha256 == text_hash,
                        Document.status == DocumentStatus.INDEXED.value,
                    )
                )
            ).scalar_one()
            await db.execute(delete(Chunk).where(Chunk.document_id == document_id))
            await finish_as_duplicate(
                db, document_id, DocumentStatus.DUPLICATE, winner, 1.0
            )
            return False
    log.info("document %s indexed", document_id)
    return True
