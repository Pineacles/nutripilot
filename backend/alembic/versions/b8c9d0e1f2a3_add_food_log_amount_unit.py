"""Remember the amount and unit each food was logged in

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-10-22 10:00:00.000000

quantity_g stays the source of truth for nutrients. amount + unit record what
the user typed ("1.5" + "serving" or "120" + "g") so the app can show it back
and prefill the same amount next time. NULL on older rows means grams.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('food_logs', sa.Column('amount', sa.Float(), nullable=True))
    op.add_column('food_logs', sa.Column('unit', sa.String(length=10), nullable=True))
    # Recent foods are read per user, newest first.
    op.create_index('idx_food_logs_user_logged_at', 'food_logs', ['user_id', 'logged_at'])


def downgrade() -> None:
    op.drop_index('idx_food_logs_user_logged_at', table_name='food_logs')
    op.drop_column('food_logs', 'unit')
    op.drop_column('food_logs', 'amount')
