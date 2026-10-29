import logging
import os

import httpx
from backend.core.config import get_settings

from backend.retrieval.schema import Hit  # fix the folder spelling when you rename it

settings = get_settings()

log = logging.getLogger(__name__)


MAX_CHARS = 2000  # trim long chunks before sending

_URL = f"https://api.cloudflare.com/client/v4/accounts/{settings.cloudflare_account_id}/ai/run/{settings.rerank_model_name}"
_HEADERS = {"Authorization": f"Bearer {settings.cloudflare_api_token}"}

_client = httpx.AsyncClient(
    timeout=20,
    headers=_HEADERS
)


async def _score(question: str, texts: list[str]) -> list[float]:
    """Returns one relevance score per text, in the same order as `texts`."""
    r = await _client.post(
        _URL,
        json={
            "query": question,
            "contexts": [{"text": t[:MAX_CHARS]} for t in texts],
        },
    )
    r.raise_for_status()
    body = r.json()
    if not body.get("success", False):
        raise RuntimeError(f"Cloudflare rerank failed: {body.get('errors')}")

    scores = [float("-inf")] * len(texts)
    for item in body["result"]["response"]:
        scores[item["id"]] = item["score"]  # id = index in the request
    return scores


async def rerank(question: str, hits: list[Hit], top_n: int = 6) -> tuple[list[Hit],bool]:
    if len(hits) <= 1:
        return hits[:top_n],False
    try:
        scores = await _score(
            question, 
            [
                f"{h.heading_path}\n\n{h.text}" if h.heading_path else h.text 
                for h in hits
            ]
        )
    except Exception:
        log.exception("rerank failed, falling back to RRF order")
        return hits[:top_n], False
    ranked = sorted(zip(hits, scores), key=lambda p: p[1], reverse=True)
    for h, s in ranked:
        h.score = s
    return [h for h, _ in ranked[:top_n]], True


async def aclose() -> None:
    await _client.aclose()
