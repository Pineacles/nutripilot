"""Add correction tracking columns to foods

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-08-18 00:20:00.000000

Tracks when and by whom a food's values were corrected via the
sanctioned correction endpoint.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('foods', sa.Column('corrected_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('foods', sa.Column('corrected_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_foods_corrected_by_users', 'foods', 'users', ['corrected_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_foods_corrected_by_users', 'foods', type_='foreignkey')
    op.drop_column('foods', 'corrected_by')
    op.drop_column('foods', 'corrected_at')
