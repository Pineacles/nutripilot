"""Add body_fat_kg and muscle_mass_kg to weight_logs

Revision ID: 88732e6b395b
Revises: 7c68d01ab6d7
Create Date: 2026-03-30 00:12:38.446391

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '88732e6b395b'
down_revision: Union[str, None] = '7c68d01ab6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('weight_logs', sa.Column('body_fat_kg', sa.Float(), nullable=True))
    op.add_column('weight_logs', sa.Column('muscle_mass_kg', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('weight_logs', 'muscle_mass_kg')
    op.drop_column('weight_logs', 'body_fat_kg')
