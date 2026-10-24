import asyncio
import os
import shutil
import uuid
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO

from backend.core.config import get_settings


class LocalStorage:
    def __init__(self, root: str | Path):
        settings = get_settings()
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.copy_chunk_size = settings.copy_chunk_size

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if not p.is_relative_to(self.root):
            raise ValueError("invalid storage key")
        return p

    def _put_sync(self, key: str, fileobj: BinaryIO) -> None:
        dest = self._path(key)
        if dest.exists():
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(f".{dest.name}.{uuid.uuid4().hex}.tmp")
        try:
            with open(tmp, "wb") as out:
                fileobj.seek(0)
                shutil.copyfileobj(fileobj, out, self.copy_chunk_size)
                out.flush()
                os.fsync(out.fileno())
            os.replace(tmp, dest)
        finally:
            tmp.unlink(missing_ok=True)

    async def put(
        self,
        key: str,
        fileobj: BinaryIO,
    ) -> None:
        await asyncio.to_thread(self._put_sync, key, fileobj)

    async def exists(self, key: str) -> bool:
        return await asyncio.to_thread(self._path(key).exists)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._path(key).unlink, True)

    def open(self, key: str) -> BinaryIO:
        return open(self._path(key), "rb")


def build_storage_key(tenant_id, sha256: bytes) -> str:
    h = sha256.hex()
    return f"tenants/{tenant_id}/{h[:2]}/{h}"


@lru_cache
def get_storage() -> LocalStorage:
    return LocalStorage(get_settings().upload_root)
