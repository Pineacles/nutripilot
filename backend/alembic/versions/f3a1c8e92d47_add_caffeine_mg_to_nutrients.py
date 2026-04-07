"""Add caffeine_mg to nutrients

Revision ID: f3a1c8e92d47
Revises: ed8d66664c1e
Create Date: 2026-04-02 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3a1c8e92d47'
down_revision: Union[str, None] = 'd7059f91fb5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('nutrients', sa.Column('caffeine_mg', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('nutrients', 'caffeine_mg')
