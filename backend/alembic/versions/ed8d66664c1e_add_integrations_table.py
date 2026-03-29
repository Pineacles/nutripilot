"""Add integrations table

Revision ID: ed8d66664c1e
Revises: 004
Create Date: 2026-03-29 23:08:17.638916

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ed8d66664c1e'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('integrations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('source_url', sa.String(length=500), nullable=False),
    sa.Column('auth_header', sa.String(length=1000), nullable=True),
    sa.Column('schedule', sa.String(length=50), nullable=False),
    sa.Column('field_mapping', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_integrations_user', 'integrations', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_integrations_user', table_name='integrations')
    op.drop_table('integrations')
