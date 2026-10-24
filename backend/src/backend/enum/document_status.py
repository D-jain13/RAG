import enum


class DocumentStatus(enum.Enum):
    PENDING = "pending"
    INDEXED = "indexed"
    DUPLICATE = "duplicate"
    NEAR_DUPLICATE = "near_duplicate"
    PROCESSING = "processing"
    FAILED = "failed"
