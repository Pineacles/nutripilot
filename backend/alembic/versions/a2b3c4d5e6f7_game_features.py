"""Game features: prints, weekly quests, game settings

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-10-26 12:00:00.000000

Achievements ("prints") and weekly quests get their own tables; the user's game
settings, chosen day goals and internal bookkeeping are JSON columns on users.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('game_settings', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('day_goals', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('game_state', sa.JSON(), nullable=True))

    op.create_table(
        'achievements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('key', sa.String(40), nullable=False),
        sa.Column('run', sa.Integer(), nullable=False),
        sa.Column('earned_at', sa.Date(), nullable=False),
        sa.Column('seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('context', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'key', 'run', name='uq_achievements_user_key_run'),
    )
    op.create_index('idx_achievements_user', 'achievements', ['user_id'])

    op.create_table(
        'weekly_quests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('key', sa.String(40), nullable=False),
        sa.Column('target', sa.Integer(), nullable=False),
        sa.Column('done_at', sa.Date(), nullable=True),
        sa.Column('seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('swapped', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'week_start', 'key', name='uq_weekly_quests_user_week_key'),
    )
    op.create_index('idx_weekly_quests_user_week', 'weekly_quests', ['user_id', 'week_start'])


def downgrade() -> None:
    op.drop_index('idx_weekly_quests_user_week', table_name='weekly_quests')
    op.drop_table('weekly_quests')
    op.drop_index('idx_achievements_user', table_name='achievements')
    op.drop_table('achievements')
    op.drop_column('users', 'game_state')
    op.drop_column('users', 'day_goals')
    op.drop_column('users', 'game_settings')
