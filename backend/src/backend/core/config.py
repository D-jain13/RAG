from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str
    db_pool_size: int = Field(default=10, ge=1)
    db_max_overflow: int = Field(default=10, ge=0)
    db_echo: bool = False

    openrouter_api_key: str
    chat_model: str = "openrouter/free"

    upload_root: Path = Path("data/uploads")
    max_upload_bytes: int = Field(default=50 * 1024 * 1024, gt=0)
    read_chunk_size: int = Field(default=1024 * 1024, gt=0)
    copy_chunk_size: int = Field(default=1024 * 1024, gt=0)
    pdf_max_pages: int = Field(default=2000, gt=0)
    pending_sweep_after_seconds: int = Field(default=300, gt=0)
    allowed_extensions: frozenset[str] = frozenset(
        {".pdf", ".docx", ".txt", ".csv", ".xlsx", ".md", ".markdown"}
    )

    # Embedding
    embed_model_name: str = Field(default="@cf/baai/bge-m3")
    embed_dim: int = Field(default=1024, gt=0)
    batch_size: int = Field(default=32, gt=0)
    max_retries: int = Field(default=4, gt=0)

    cloudflare_account_id: str
    cloudflare_api_token: str

    # HNSW search params
    hnsw_ef_search: int = Field(default=100, ge=0)
    hnsw_max_scan_tuples: int = Field(default=50000, ge=0)

    # Reranking
    rerank_model_name: str = Field(
        default="@cf/baai/bge-reranker-base"
    )
    # Best reranker score below this means "nothing relevant"; calibrate per model.
    rerank_min_score: float = Field(default=0.1)

    # @property
    # def procrastinate_dsn(self) -> str:
    #     """libpq DSN for Procrastinate (psycopg): same DB, no SQLAlchemy driver suffix."""
    #     return self.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    @property
    def procrastinate_dsn(self) -> str:
        """libpq DSN for Procrastinate (psycopg)."""
        dsn = self.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        return dsn.replace("@localhost:", "@127.0.0.1:", 1)


@lru_cache
def get_settings() -> Settings:
    return Settings()