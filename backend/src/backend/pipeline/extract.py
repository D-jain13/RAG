import asyncio
import io
import logging
import uuid

from sqlalchemy import select, update

from backend.db.session import AsyncSessionLocal
from backend.enum.document_status import DocumentStatus
from backend.storage.storage import LocalStorage, get_storage
from backend.models.document import Document
from backend.parser import parse_file_async
from backend.parser.parsing_errors import EmptyDocument, ParseError
from backend.pipeline.common import _ACTIVE, artifact_key
from backend.pipeline.duplicates import finish_as_duplicate
from backend.pipeline.failure import fail_document
from backend.utils.hashing import text_sha256 as compute_text_sha256
from backend.utils.minhash import (
    MINHASH_VERSION,
    band_hashes,
    compute_minhash,
    find_near_duplicate,
    minhash_to_bytes,
)
from backend.utils.normalise import normalize_text

log = logging.getLogger(__name__)


async def extract_stage(
    document_id: uuid.UUID, storage: LocalStorage | None = None
) -> bool:
    """Returns True if the document should continue to chunking."""
    storage = storage or get_storage()

    async with AsyncSessionLocal() as db:
        # Claim from `pending`; `processing` is allowed so a retried job can re-run.
        claimed = (
            await db.execute(
                update(Document)
                .where(Document.id == document_id, Document.status.in_(_ACTIVE))
                .values(status=DocumentStatus.PROCESSING.value)
                .returning(Document.id)
            )
        ).scalar_one_or_none()
        await db.commit()
        if claimed is None:
            log.info(
                "document %s not pending/processing, skipping extract", document_id
            )
            return False
        doc = await db.get(Document, document_id)

    try:
        return await _extract(doc, storage)
    except ParseError as exc:  # permanent: retrying the same bytes won't help
        await fail_document(document_id, str(exc))
        return False


async def _extract(doc: Document, storage: LocalStorage) -> bool:
    f = storage.open(doc.storage_key)
    try:
        raw_text = await parse_file_async(f, doc.filename)
    finally:
        f.close()

    normalized = normalize_text(raw_text)
    if not normalized:
        raise EmptyDocument("no text left after normalization")
    text_hash = compute_text_sha256(normalized)
    await storage.put(artifact_key(doc), io.BytesIO(normalized.encode("utf-8")))

    async with AsyncSessionLocal() as db:
        exact_id = (
            await db.execute(
                select(Document.id).where(
                    Document.tenant_id == doc.tenant_id,
                    Document.text_sha256 == text_hash,
                    Document.status == DocumentStatus.INDEXED.value,
                    Document.id != doc.id,
                )
            )
        ).scalar_one_or_none()

        if exact_id is not None:
            await finish_as_duplicate(
                db,
                doc.id,
                DocumentStatus.DUPLICATE,
                exact_id,
                1.0,
                text_sha256=text_hash,
            )
            return False

        try:
            m = await asyncio.to_thread(compute_minhash, normalized)
        except ValueError as exc:  # no shingles
            raise EmptyDocument(str(exc)) from exc
        bands = band_hashes(m)
        minhash_fields = {
            "text_sha256": text_hash,
            "minhash": minhash_to_bytes(m),
            "minhash_version": MINHASH_VERSION,
        }

        # Policy for now: a near-duplicate is recorded and stops here (no chunks,
        # no embeddings). Revisit once versioning exists.
        match = await find_near_duplicate(db, doc.tenant_id, m, bands)
        if match is not None:
            await finish_as_duplicate(
                db,
                doc.id,
                DocumentStatus.NEAR_DUPLICATE,
                match[0].id,
                round(match[1], 4),
                **minhash_fields,
            )
            return False

        await db.execute(
            update(Document).where(Document.id == doc.id).values(**minhash_fields)
        )
        await db.commit()
    return True
