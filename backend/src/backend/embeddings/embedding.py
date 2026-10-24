# embedding/bge_m3.py  (Cloudflare Workers AI version)
import asyncio
import os

import httpx
import numpy as np
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "@cf/baai/bge-m3"
EMBED_DIM = 1024
BATCH_SIZE = 32  
MAX_RETRIES = 4

_ACCOUNT = os.environ["CLOUDFLARE_ACCOUNT_ID"]
_URL = f"https://api.cloudflare.com/client/v4/accounts/{_ACCOUNT}/ai/run/{MODEL_NAME}"
_HEADERS = {"Authorization": f"Bearer {os.environ['CLOUDFLARE_API_TOKEN']}"}

_client = httpx.AsyncClient(timeout=60, headers=_HEADERS)
_sem = asyncio.Semaphore(4)  # concurrent requests


async def _embed_batch(texts: list[str]) -> np.ndarray:
    payload = {"text": texts, "truncate_inputs": True}
    for attempt in range(MAX_RETRIES):
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
        return np.empty((0, EMBED_DIM), dtype=np.float32)
    parts = await asyncio.gather(
        *(
            _embed_batch(texts[i : i + BATCH_SIZE])
            for i in range(0, len(texts), BATCH_SIZE)
        )
    )
    v = np.vstack(parts)
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    return v / np.where(norms == 0, 1.0, norms)  # unit vectors: cosine == inner product


async def aembed_query(query: str) -> np.ndarray:
    return (await aembed_texts([query]))[0]


async def aclose() -> None:
    await _client.aclose()
