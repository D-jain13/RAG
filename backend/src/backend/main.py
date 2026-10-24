from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from sqlalchemy import text

from backend.api.document import router as document_router
from backend.api.tenant import router as tenant_router
from backend.api.chat import router as chat_router
from backend.core.config import get_settings
from backend.db.session import engine
from backend.worker.queue import app as procrastinate_app
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(
        asyncio.WindowsSelectorEventLoopPolicy()
    )

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Opens the pool used to defer jobs; the worker runs as a separate process.
    async with procrastinate_app.open_async():
        yield
    await engine.dispose()


app = FastAPI(title="Backend for RAG", version="0.1", lifespan=lifespan)
API_PREFIX = "/api/v1"

app.include_router(document_router, prefix=API_PREFIX)
app.include_router(tenant_router, prefix=API_PREFIX)
app.include_router(chat_router, prefix=API_PREFIX)

settings = get_settings()


@app.get("/health")
def get_health():
    return {"status": "healthy"}


@app.get("/ready")
async def readiness_check():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:
        print(exc)
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    return {"status": "ready", "database": "connected"}
