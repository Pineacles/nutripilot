"""Body profile on users, private foods, and dishes built from components

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-11-02 12:00:00.000000

users gets height_cm, birth_year, sex and activity_level (all NULL until set) for the
agent's BMR and maintenance estimates. foods.private hides a food from everyone but its
creator. food_components lists the parts of a dish (a food with source 'dish'); a food
used as a component cannot be deleted (RESTRICT), a dish takes its parts with it (CASCADE).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('height_cm', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('birth_year', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('sex', sa.String(10), nullable=True))
    op.add_column('users', sa.Column('activity_level', sa.String(20), nullable=True))

    op.add_column('foods', sa.Column('private', sa.Boolean(), nullable=False, server_default='false'))

    op.create_table(
        'food_components',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('food_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False),
        sa.Column('component_food_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('foods.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('quantity_g', sa.Float(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
    )
    op.create_index('idx_food_components_food', 'food_components', ['food_id'])
    op.create_index('idx_food_components_component', 'food_components', ['component_food_id'])


def downgrade() -> None:
    op.drop_index('idx_food_components_component', table_name='food_components')
    op.drop_index('idx_food_components_food', table_name='food_components')
    op.drop_table('food_components')
    op.drop_column('foods', 'private')
    op.drop_column('users', 'activity_level')
    op.drop_column('users', 'sex')
    op.drop_column('users', 'birth_year')
    op.drop_column('users', 'height_cm')
