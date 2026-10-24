"""add search indexes

Revision ID: 86f4b67aec9f
Revises: 39ca22bf3ade
Create Date: 2026-10-24 16:28:04.525800

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "86f4b67aec9f"
down_revision: str | Sequence[str] | None = "39ca22bf3ade"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_textsearch")
    op.execute("""
        CREATE INDEX ix_chunks_bm25 ON chunks
        USING bm25 ((coalesce(heading_path, '') || ' ' || text))
        WITH (text_config='english')
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_chunks_embedding_hnsw
        ON chunks USING hnsw (embedding vector_cosine_ops)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_chunks_bm25")
