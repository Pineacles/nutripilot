"""Add alcohol water caffeine tracking

Revision ID: d7059f91fb5a
Revises: 88732e6b395b
Create Date: 2026-03-30 19:57:00.154547

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd7059f91fb5a'
down_revision: Union[str, None] = '88732e6b395b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('caffeine_logs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('amount_mg', sa.Float(), nullable=False),
    sa.Column('source_name', sa.String(length=100), nullable=True),
    sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_caffeine_logs_user_date', 'caffeine_logs', ['user_id', 'date'], unique=False)
    op.create_table('water_logs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('amount_ml', sa.Float(), nullable=False),
    sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_water_logs_user_date', 'water_logs', ['user_id', 'date'], unique=False)
    op.add_column('nutrients', sa.Column('alcohol', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('target_alcohol_g', sa.Float(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('target_water_ml', sa.Float(), server_default='2500', nullable=False))
    op.add_column('users', sa.Column('target_caffeine_mg', sa.Float(), server_default='400', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'target_caffeine_mg')
    op.drop_column('users', 'target_water_ml')
    op.drop_column('users', 'target_alcohol_g')
    op.drop_column('nutrients', 'alcohol')
    op.drop_index('idx_water_logs_user_date', table_name='water_logs')
    op.drop_table('water_logs')
    op.drop_index('idx_caffeine_logs_user_date', table_name='caffeine_logs')
    op.drop_table('caffeine_logs')
