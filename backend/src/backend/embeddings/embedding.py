# embedding/bge_m3.py  (Cloudflare Workers AI version)
import asyncio
import os

import httpx
import numpy as np
from backend.core.config import get_settings

setting = get_settings()


_URL = f"https://api.cloudflare.com/client/v4/accounts/{setting.cloudflare_account_id}/ai/run/{setting.embed_model_name}"
_HEADERS = {"Authorization": f"Bearer {setting.cloudflare_api_token}"}

_client = httpx.AsyncClient(timeout=60, headers=_HEADERS)
_sem = asyncio.Semaphore(4)  # concurrent requests


async def _embed_batch(texts: list[str]) -> np.ndarray:
    payload = {"text": texts, "truncate_inputs": True}
    for attempt in range(setting.max_retries):
        async with _sem:
            r = await _client.post(_URL, json=payload)
        if r.status_code == 429 or r.status_code >= 500:
            await asyncio.sleep(2**attempt)  # back off, then retry
            continue
        r.raise_for_status()
        body = r.json()
        if not body.get("success", False):
            raise RuntimeError(f"Cloudflare embedding failed: {body.get('errors')}")
        return np.asarray(body["result"]["data"], dtype=np.float32)
    raise RuntimeError("Cloudflare embedding: retries exhausted")


async def aembed_texts(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.empty((0, setting.embed_dim), dtype=np.float32)
    parts = await asyncio.gather(
        *(
            _embed_batch(texts[i : i + setting.batch_size])
            for i in range(0, len(texts), setting.batch_size)
        )
    )
    v = np.vstack(parts)
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    return v / np.where(norms == 0, 1.0, norms)  # unit vectors: cosine == inner product


async def aembed_query(query: str) -> np.ndarray:
    return (await aembed_texts([query]))[0]


async def aclose() -> None:
    await _client.aclose()
