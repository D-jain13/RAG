from fastapi import FastAPI, HTTPException
from sqlalchemy import text

from backend.core.config import get_settings
from backend.db.session import engine

app = FastAPI(title="Backend for RAG", version=0.1)


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
