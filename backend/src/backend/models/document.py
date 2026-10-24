import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.enum.document_status import DocumentStatus
from backend.models import Base

if TYPE_CHECKING:
    from backend.models.lsh_band import LshBand


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    sha256: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)

    text_sha256: Mapped[bytes | None] = mapped_column(LargeBinary)
    minhash: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    minhash_version: Mapped[int | None] = mapped_column(SmallInteger)

    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=DocumentStatus.PENDING.value
    )

    duplicate_of: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL")
    )

    similarity: Mapped[float | None] = mapped_column()
    failure_reason: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    version: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        default=1,
        server_default=text("1"),
    )

    supersedes_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    bands: Mapped[list["LshBand"]] = relationship(
        "LshBand",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "sha256", name="uq_documents_tenant_sha256"),
        Index(
            "uq_documents_tenant_text_sha256_indexed",
            "tenant_id",
            "text_sha256",
            unique=True,
            postgresql_where=text("status = 'indexed'"),
        ),
        # Lookup of "what duplicates point at this doc?"
        Index("ix_documents_duplicate_of", "duplicate_of"),
        # Sweeper: find stuck pending rows cheaply
        Index(
            "ix_documents_pending_created",
            "created_at",
            postgresql_where=text("status = 'pending'"),
        ),
        CheckConstraint("length(sha256) = 32", name="ck_documents_sha256_len"),
        CheckConstraint(
            "text_sha256 IS NULL OR length(text_sha256) = 32",
            name="ck_documents_text_sha256_len",
        ),
        CheckConstraint(
            "status IN ('pending','indexed','duplicate','near_duplicate','failed','processing')",
            name="ck_documents_status",
        ),
        CheckConstraint("version >= 1", name="ck_documents_version_positive"),
        CheckConstraint(
            "similarity IS NULL OR (similarity >= 0 AND similarity <= 1)",
            name="ck_documents_similarity_range",
        ),
        CheckConstraint(
            "status NOT IN ('duplicate','near_duplicate') "
            "OR duplicate_of IS NOT NULL OR similarity IS NOT NULL",
            name="ck_documents_duplicate_has_target",
        ),
    )
