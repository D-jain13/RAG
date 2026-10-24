from datetime import UTC, datetime

from backend.enum.document_status import DocumentStatus
from backend.models.document import Document


def now() -> datetime:
    return datetime.now(UTC)


_ACTIVE = (DocumentStatus.PENDING.value, DocumentStatus.PROCESSING.value)
EMBED_BATCH = 64  # chunks per embed round; the embedder splits further for the API
CHUNK_INSERT_BATCH = 500  # keeps each INSERT under the driver's bind-parameter limit


def artifact_key(doc: Document) -> str:
    """Normalized markdown, saved by extract so chunking never re-parses the file."""
    return f"{doc.storage_key}.normalized.md"
