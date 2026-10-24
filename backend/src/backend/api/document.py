import asyncio
import logging
import uuid
from pathlib import PurePath

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.tenancy import get_tenant_id
from backend.db.session import get_db
from backend.pipeline.upload import ingest_upload
from backend.storage.storage import LocalStorage, get_storage
from backend.parser import parse_file_async
from backend.parser.parsing_errors import EmptyDocument, UnsupportedFileType
from backend.utils.chunking import chunk_markdown
from backend.utils.hashing import spool_and_hash, text_sha256
from backend.utils.minhash import (
    MINHASH_VERSION,
    band_hashes,
    compute_minhash,
    find_near_duplicate,
    minhash_to_bytes,
)
from backend.utils.normalise import normalize_text
from backend.worker.tasks import enqueue_process_document

log = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    filename: str
    size_bytes: int
    status: str
    duplicate_of: uuid.UUID | None = None


class UploadResponse(BaseModel):
    document: DocumentOut
    already_exists: bool


@router.post("", response_model=UploadResponse, status_code=201)
async def upload_document(
    response: Response,
    file: UploadFile = File(...),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
    storage: LocalStorage = Depends(get_storage),
):
    settings = get_settings()
    filename = PurePath(file.filename or "unnamed").name
    if PurePath(filename).suffix.lower() not in settings.allowed_extensions:
        raise HTTPException(415, "Unsupported file type")

    spooled, digest, size = await spool_and_hash(file, settings.max_upload_bytes)

    try:
        result = await ingest_upload(
            db,
            storage,
            tenant_id=tenant_id,
            spooled=spooled,
            sha256=digest,
            size_bytes=size,
            filename=filename,
            content_type=file.content_type,
        )
    finally:
        spooled.close()

    if result.should_enqueue:
        try:
            await enqueue_process_document(result.document.id)
        except Exception:
            # Row is committed as `pending`; the periodic sweeper will re-enqueue it.
            log.exception("enqueue failed for %s", result.document.id)
    if not result.created:
        response.status_code = 200

    return UploadResponse(document=result.document, already_exists=not result.created)


@router.post("/test-parser")
async def upload_document_test(
    file: UploadFile = File(...),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    filename = PurePath(file.filename or "unnamed").name

    if PurePath(filename).suffix.lower() not in settings.allowed_extensions:
        raise HTTPException(415, "Unsupported file type")

    spooled, digest, size = await spool_and_hash(file, settings.max_upload_bytes)

    try:
        # Step 1: Parse the uploaded file
        raw_text = await parse_file_async(spooled, filename)

        print("\n========== RAW PARSED TEXT ==========")
        print(raw_text)

        # Step 2: Normalize the extracted text
        normalized = normalize_text(raw_text)

        # Step 3: Print the normalized result in your server terminal
        print("\n========== NORMALIZED TEXT ==========")
        print(normalized)
        print("\n========== END ==========\n")

        text_sha256_value = text_sha256(normalized)

        m = await asyncio.to_thread(compute_minhash, normalized)
        bands = band_hashes(m)
        match = await find_near_duplicate(db, tenant_id, m, bands)
        doc_id = uuid.uuid4()

        chunks = chunk_markdown(
            normalized,
            base_metadata={
                "filename": filename,
                "document_id": str(doc_id),
                "tenant_id": str(tenant_id),
            },
        )
        # chunk_texts = [chunk.text for chunk in chunks]
        # embeddings = await aembed_texts(chunk_texts)
        return {
            "filename": filename,
            "size_bytes": size,
            "sha256": digest.hex(),
            "normalized_text": normalized,
            "text_256": text_sha256_value.hex(),
            "minhash_version": MINHASH_VERSION,
            "minhash_bytes": len(minhash_to_bytes(m)),
            "num_bands": len(bands),
            "near_duplicate_of": str(match[0].id) if match else None,
            "similarity": round(match[1], 4) if match else None,
            "num_chunks": len(chunks),
            "chunks": [
                {
                    "index": chunk.index,
                    "heading_path": chunk.heading_path,
                    "metadata": chunk.metadata,
                    "text": chunk.text,
                    # "embedding": embeddings[i].tolist(),
                }
                for i, chunk in enumerate(chunks)
            ],
        }

    except (EmptyDocument, UnsupportedFileType) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    finally:
        spooled.close()
        await file.close()
