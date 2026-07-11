"""Add foods.created_by ownership (NULL = official/curated)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-11 00:00:02.000000

Backfill: existing source='manual' foods are attributed to the earliest-created
real user (email != demo@nutripilot.dev). All other rows (Swiss-DB imports,
OpenFoodFacts, USDA, barcode imports, and demo-only manual foods) stay NULL and
are treated as official/curated read-only catalog entries.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'foods',
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_foods_created_by_users',
        'foods', 'users',
        ['created_by'], ['id'],
        ondelete='SET NULL',
    )

    # Backfill: attribute existing manual foods to the earliest real user.
    conn = op.get_bind()
    row = conn.execute(
        sa.text(
            "SELECT id FROM users "
            "WHERE email != 'demo@nutripilot.dev' "
            "ORDER BY created_at ASC LIMIT 1"
        )
    ).first()
    if row is not None:
        conn.execute(
            sa.text("UPDATE foods SET created_by = :uid WHERE source = 'manual'"),
            {"uid": row[0]},
        )


def downgrade() -> None:
    op.drop_constraint('fk_foods_created_by_users', 'foods', type_='foreignkey')
    op.drop_column('foods', 'created_by')
