# dedup/minhash_utils.py
import hashlib

import numpy as np
from datasketch import MinHash
from sqlalchemy import desc, func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from backend.enum.document_status import DocumentStatus
from backend.models.document import Document
from backend.models.lsh_band import LshBand

NUM_PERM = 128
BANDS = 16
ROWS = NUM_PERM // BANDS  # 8 rows/band -> LSH kicks in around J ~ 0.7
SHINGLE_SIZE = 5  # word 5-grams
SEED = 1
SCHEME = "affine64"  # uint64 hash values, matches the <u8 serialization
MINHASH_VERSION = 2  # bump if ANY param above changes (v2: explicit affine64 scheme)
NEAR_DUP_THRESHOLD = 0.85  # verified Jaccard cutoff
MAX_CANDIDATES = 20


def _shingles(text: str, k: int = SHINGLE_SIZE) -> set[str]:
    words = text.split()
    if not words:
        return set()
    if len(words) < k:
        return {" ".join(words)}
    return {" ".join(words[i : i + k]) for i in range(len(words) - k + 1)}


def compute_minhash(normalized_text: str) -> MinHash:
    shingles = _shingles(normalized_text)
    if not shingles:
        raise ValueError("no shingles")
    m = MinHash(num_perm=NUM_PERM, seed=SEED, scheme=SCHEME)
    m.update_batch([s.encode("utf-8") for s in shingles])
    return m


def minhash_to_bytes(m: MinHash) -> bytes:
    return m.hashvalues.astype("<u8").tobytes()  # 1024 bytes


def minhash_from_bytes(b: bytes) -> MinHash:
    arr = np.frombuffer(b, dtype="<u8").copy()
    return MinHash(num_perm=NUM_PERM, seed=SEED, hashvalues=arr, scheme=SCHEME)


def band_hashes(m: MinHash) -> list[int]:
    """16 signed-64-bit hashes, one per band (fits your BigInteger column)."""
    out = []
    for i in range(BANDS):
        chunk = m.hashvalues[i * ROWS : (i + 1) * ROWS].astype("<u8").tobytes()
        digest = hashlib.blake2b(chunk, digest_size=8).digest()
        out.append(int.from_bytes(digest, "big", signed=True))
    return out


async def find_near_duplicate(
    db: AsyncSession,
    tenant_id,
    m: MinHash,
    bands: list[int],
) -> tuple[Document, float] | None:
    # 1) candidates: docs sharing >=1 band, ranked by number of shared bands
    stmt = (
        select(LshBand.document_id, func.count().label("hits"))
        .where(
            LshBand.tenant_id == tenant_id,
            LshBand.version == MINHASH_VERSION,
            tuple_(LshBand.band_idx, LshBand.band_hash).in_(list(enumerate(bands))),
        )
        .group_by(LshBand.document_id)
        .order_by(desc("hits"))
        .limit(MAX_CANDIDATES)
    )
    cand_ids = [r.document_id for r in (await db.execute(stmt)).all()]
    if not cand_ids:
        return None

    # 2) verify with estimated Jaccard from stored signatures
    docs = (
        (
            await db.execute(
                select(Document)
                .options(undefer(Document.minhash))  # it's deferred in your model
                .where(
                    Document.id.in_(cand_ids),
                    Document.status == DocumentStatus.INDEXED.value,
                    Document.minhash_version == MINHASH_VERSION,
                    Document.minhash.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )

    best: tuple[Document, float] | None = None
    for d in docs:
        j = m.jaccard(minhash_from_bytes(d.minhash))
        if j >= NEAR_DUP_THRESHOLD and (best is None or j > best[1]):
            best = (d, j)
    return best
