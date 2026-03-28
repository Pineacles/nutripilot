"""Add supplement_definitions and micronutrient_targets tables

Revision ID: 003
Revises: 002
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplement_definitions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("dose_amount", sa.Float, nullable=False),
        sa.Column("dose_unit", sa.String(10), nullable=False, server_default="mg"),
        sa.Column("time_of_day", sa.String(20)),
        sa.Column("active", sa.Boolean, server_default="true"),
        sa.Column("micronutrients", JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "micronutrient_targets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("nutrient", sa.String(50), nullable=False),
        sa.Column("target_value", sa.Float, nullable=False),
        sa.Column("unit", sa.String(10), nullable=False),
        sa.UniqueConstraint("user_id", "nutrient", name="uq_user_nutrient"),
    )


def downgrade() -> None:
    op.drop_table("micronutrient_targets")
    op.drop_table("supplement_definitions")
