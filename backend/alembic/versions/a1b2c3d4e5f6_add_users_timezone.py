"""Add users.timezone for per-user day boundaries

Revision ID: a1b2c3d4e5f6
Revises: f3a1c8e92d47
Create Date: 2026-07-11 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f3a1c8e92d47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('timezone', sa.String(length=64), nullable=False, server_default='Europe/Zurich'),
    )


def downgrade() -> None:
    op.drop_column('users', 'timezone')
