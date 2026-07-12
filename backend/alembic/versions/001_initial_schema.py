"""Initial schema: all 6 tables

Revision ID: 001
Revises:
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("api_key", sa.String(64), unique=True, nullable=False),
        sa.Column("display_name", sa.String(100)),
        sa.Column("target_kcal", sa.Integer, server_default="2000"),
        sa.Column("target_protein_g", sa.Float, server_default="150"),
        sa.Column("target_carbs_g", sa.Float, server_default="250"),
        sa.Column("target_fat_g", sa.Float, server_default="70"),
        sa.Column("target_weight_kg", sa.Float),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "foods",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("barcode", sa.String(50), unique=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "nutrients",
        sa.Column("food_id", UUID(as_uuid=True), sa.ForeignKey("foods.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("kcal", sa.Float),
        sa.Column("protein", sa.Float),
        sa.Column("carbs", sa.Float),
        sa.Column("sugar", sa.Float),
        sa.Column("fiber", sa.Float),
        sa.Column("fat", sa.Float),
        sa.Column("sat_fat", sa.Float),
        sa.Column("salt", sa.Float),
        sa.Column("calcium", sa.Float),
        sa.Column("potassium", sa.Float),
        sa.Column("omega3", sa.Float),
        sa.Column("zinc", sa.Float),
        sa.Column("vit_d", sa.Float),
        sa.Column("vit_k2", sa.Float),
        sa.Column("vit_c", sa.Float),
        sa.Column("magnesium", sa.Float),
        sa.Column("b12", sa.Float),
        sa.Column("iron", sa.Float),
    )

    op.create_table(
        "food_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("food_id", UUID(as_uuid=True), sa.ForeignKey("foods.id"), nullable=False),
        sa.Column("date", sa.Date, nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("quantity_g", sa.Float, nullable=False),
        sa.Column("meal_type", sa.String(20), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_food_logs_user_date", "food_logs", ["user_id", "date"])

    op.create_table(
        "supplements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date, nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("dose_amount", sa.Float, nullable=False),
        sa.Column("dose_unit", sa.String(10), nullable=False, server_default="g"),
        sa.Column("time_of_day", sa.String(20)),
        sa.Column("logged_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_supplements_user_date", "supplements", ["user_id", "date"])

    op.create_table(
        "weight_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date, nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("weight_kg", sa.Float, nullable=False),
        sa.Column("body_fat_pct", sa.Float),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("logged_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_weight_logs_user_date", "weight_logs", ["user_id", "date"])


def downgrade() -> None:
    op.drop_table("weight_logs")
    op.drop_table("supplements")
    op.drop_table("food_logs")
    op.drop_table("nutrients")
    op.drop_table("foods")
    op.drop_table("users")
