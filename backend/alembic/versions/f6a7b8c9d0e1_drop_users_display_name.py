"""Drop unused users.display_name column

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-12 00:00:00.000000

display_name was write-only: set at seed time but never read anywhere in
the application. Dropping it to match the ORM model.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('users', 'display_name')


def downgrade() -> None:
    op.add_column('users', sa.Column('display_name', sa.String(100), nullable=True))
