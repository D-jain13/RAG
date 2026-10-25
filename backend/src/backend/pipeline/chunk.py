import asyncio
import hashlib
import logging
import uuid

from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.db.session import AsyncSessionLocal
from backend.enum.document_status import DocumentStatus
from backend.storage.storage import LocalStorage, get_storage
from backend.models.chunk import Chunk
from backend.models.document import Document
from backend.pipeline.common import CHUNK_INSERT_BATCH, artifact_key
from backend.pipeline.failure import fail_document
from backend.utils.chunking import chunk_document

log = logging.getLogger(__name__)


async def chunk_stage(
    document_id: uuid.UUID, storage: LocalStorage | None = None
) -> bool:
    """Returns True if the document should continue to embedding."""
    storage = storage or get_storage()

    async with AsyncSessionLocal() as db:
        doc = await db.get(Document, document_id)
    if doc is None or doc.status != DocumentStatus.PROCESSING.value:
        log.info("document %s not processing, skipping chunk", document_id)
        return False

    f = storage.open(artifact_key(doc))
    try:
        normalized = f.read().decode("utf-8")
    finally:
        f.close()

    chunks = await asyncio.to_thread(
        chunk_document,
        normalized,
        doc.filename,
    )
    
    if not chunks:
        await fail_document(document_id, "no chunks produced")
        return False

    rows = [
        {
            # Deterministic id: a retried stage hits ON CONFLICT instead of duplicating.
            "id": uuid.uuid5(doc.id, str(c.index)),
            "document_id": doc.id,
            "tenant_id": doc.tenant_id,
            "chunk_index": c.index,
            "text": c.text,
            "heading_path": c.heading_path,
            "content_hash": hashlib.sha256(c.text.encode("utf-8")).digest(),
            "chunk_metadata": c.metadata,
        }
        for c in chunks
    ]
    async with AsyncSessionLocal() as db:
        for i in range(0, len(rows), CHUNK_INSERT_BATCH):
            await db.execute(
                pg_insert(Chunk)
                .values(rows[i : i + CHUNK_INSERT_BATCH])
                .on_conflict_do_nothing(index_elements=["id"])
            )
        await db.commit()
    log.info("document %s: %d chunks", document_id, len(rows))
    return True
