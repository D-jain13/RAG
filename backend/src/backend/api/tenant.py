import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import get_db
from backend.storage.storage import get_storage
from backend.models.chunk import Chunk
from backend.models.document import Document
from backend.models.lsh_band import LshBand
from backend.models.tenant import Tenant

router = APIRouter(prefix="/tenants", tags=["tenants"])


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class TenantOut(BaseModel):
    tenant_id: str
    name: str


class TenantListResponse(BaseModel):
    items: list[TenantOut]
    total: int
    page: int
    page_size: int
    total_pages: int


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


@router.get("", response_model=TenantListResponse)
async def list_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(
        10, ge=1, le=100, description="Items per page"
    ),
):
    total = await db.scalar(
        select(func.count()).select_from(Tenant)
    ) or 0

    rows = (
        (
            await db.execute(
                select(Tenant)
                .order_by(Tenant.created_at, Tenant.id)
                .limit(page_size)
                .offset((page - 1) * page_size)
            )
        )
        .scalars()
        .all()
    )

    return TenantListResponse(
        items=[
            TenantOut(tenant_id=str(t.id), name=t.name)
            for t in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/all", response_model=list[TenantOut])
async def list_all_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Every tenant, unpaginated. Backs the workspace selector."""
    rows = (
        (
            await db.execute(
                select(Tenant).order_by(Tenant.created_at, Tenant.id)
            )
        )
        .scalars()
        .all()
    )

    return [
        TenantOut(tenant_id=str(t.id), name=t.name)
        for t in rows
    ]


@router.delete("/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant = await db.get(Tenant, tenant_id)

    if not tenant:
        raise HTTPException(404, "Tenant not found")

    await db.execute(
        delete(Chunk).where(Chunk.tenant_id == tenant_id)
    )
    await db.execute(
        delete(LshBand).where(LshBand.tenant_id == tenant_id)
    )
    await db.execute(
        delete(Document).where(Document.tenant_id == tenant_id)
    )
    await db.execute(
        delete(Tenant).where(Tenant.id == tenant_id)
    )

    await db.commit()

    await get_storage().delete_tenant(tenant_id)