from backend.models.chunk import Chunk
from backend.models.document import Document

from .schema import Hit

HIT_COLUMNS = (
    Chunk.id.label("chunk_id"),
    Chunk.document_id,
    Chunk.heading_path,
    Chunk.chunk_index,
    Chunk.text,
    Document.filename,
)


def row_to_hit(row) -> Hit:
    return Hit.model_validate(row._mapping)
