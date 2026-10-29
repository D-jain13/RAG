"""add unique constraint to tenant name

Revision ID: 586a898ca52e
Revises: 86f4b67aec9f
Create Date: 2026-10-29 19:26:04.234818

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '586a898ca52e'
down_revision: Union[str, Sequence[str], None] = '86f4b67aec9f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint(
        "uq_tenants_name",
        "tenants",
        ["name"],
    )
    pass


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "uq_tenants_name",
        "tenants",
        type_="unique",
    )
    pass
