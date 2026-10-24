import uuid

from sqlalchemy import (
    BigInteger,
    ForeignKey,
    Index,
    SmallInteger,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models import Base
from backend.models.document import Document


class LshBand(Base):
    """One row per (document, band). Only INDEXED documents get bands."""

    __tablename__ = "lsh_bands"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    )
    band_idx: Mapped[int] = mapped_column(SmallInteger, primary_key=True)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    band_hash: Mapped[int] = mapped_column(BigInteger, nullable=False)  # signed 64-bit

    document: Mapped[Document] = relationship(back_populates="bands")

    __table_args__ = (
        Index("ix_lsh_bands_lookup", "tenant_id", "version", "band_idx", "band_hash"),
    )
