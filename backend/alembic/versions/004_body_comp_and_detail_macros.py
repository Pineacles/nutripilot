"""Add muscle_mass_pct to weight_logs and detail macro targets to users

Revision ID: 004
Revises: 003
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add muscle mass to weight logs
    op.add_column("weight_logs", sa.Column("muscle_mass_pct", sa.Float, nullable=True))

    # Add detail macro targets to users
    op.add_column("users", sa.Column("target_fiber_g", sa.Float, server_default="30", nullable=False))
    op.add_column("users", sa.Column("target_sugar_g", sa.Float, server_default="50", nullable=False))
    op.add_column("users", sa.Column("target_sodium_mg", sa.Float, server_default="2300", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "target_sodium_mg")
    op.drop_column("users", "target_sugar_g")
    op.drop_column("users", "target_fiber_g")
    op.drop_column("weight_logs", "muscle_mass_pct")
