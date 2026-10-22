"""Named servings per user and food, and the serving name on each log

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-10-22 14:00:00.000000

food_servings holds extra portions a user added ("slice" = 30 g) on top of the
food's own serving size. food_logs.unit_label keeps the name used, so a log
reads "2 × slice" even if that serving is later removed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'food_servings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('food_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('label', sa.String(length=40), nullable=False),
        sa.Column('grams', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'food_id', 'label', name='uq_food_servings_user_food_label'),
    )
    op.add_column('food_logs', sa.Column('unit_label', sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column('food_logs', 'unit_label')
    op.drop_table('food_servings')
