import uuid

from pydantic import BaseModel, ConfigDict


class Hit(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    heading_path: str | None = None
    chunk_index: int
    text: str
    score: float = 0.0  # set later by RRF and the reranker
