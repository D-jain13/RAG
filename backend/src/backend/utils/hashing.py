import hashlib
import tempfile
from typing import BinaryIO

from fastapi import HTTPException, UploadFile

CHUNK_SIZE = 1024 * 1024
SPOOL_MEMORY_LIMIT = 8 * 1024 * 1024


async def spool_and_hash(
    upload: UploadFile,
    max_bytes: int,
    chunk_size: int = CHUNK_SIZE,
) -> tuple[BinaryIO, bytes, int]:
    """
    Single pass over an upload: copy to a temp file while computing SHA-256.
    Returns (spooled_file_at_position_0, raw_32_byte_digest, size_bytes).
    Caller must close the returned file.
    """
    spool = tempfile.SpooledTemporaryFile(max_size=SPOOL_MEMORY_LIMIT)
    digest = hashlib.sha256()
    total = 0
    try:
        while chunk := await upload.read(chunk_size):
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(413, f"File exceeds {max_bytes} bytes")
            digest.update(chunk)
            spool.write(chunk)
        if total == 0:
            raise HTTPException(400, "Empty file")
        spool.seek(0)
        return spool, digest.digest(), total
    except BaseException:
        spool.close()
        raise


def text_sha256(normalized: str) -> bytes:
    """Raw 32-byte digest, matches the text_sha256 column and its check constraint."""
    return hashlib.sha256(normalized.encode("utf-8")).digest()
