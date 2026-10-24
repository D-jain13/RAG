import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import get_db
from backend.storage.storage import get_storage
from backend.models.tenant import Tenant

router = APIRouter(prefix="/tenants", tags=["tenants"])


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


@router.post("", status_code=201)
async def create_tenant(
    body: TenantCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant = Tenant(name=body.name.strip())
    db.add(tenant)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Tenant name already exists")
    return {"tenant_id": str(tenant.id), "name": tenant.name}


@router.get("")
async def list_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rows = (
        (await db.execute(select(Tenant).order_by(Tenant.created_at))).scalars().all()
    )
    return [{"tenant_id": str(t.id), "name": t.name} for t in rows]


@router.delete("/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    await db.delete(tenant)  # the database cascades to documents, chunks, bands
    await db.commit()
    await get_storage().delete_tenant(tenant_id)
