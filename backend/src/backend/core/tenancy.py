import uuid

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import get_db
from backend.models.tenant import Tenant


async def get_tenant_id(
    x_tenant_id: uuid.UUID = Header(...),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    if await db.get(Tenant, x_tenant_id) is None:
        raise HTTPException(404, "Unknown tenant")
    return x_tenant_id
