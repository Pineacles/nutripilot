"""Align column nullability with the ORM models

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-11 00:00:05.000000

Eleven columns are declared NOT NULL in the SQLAlchemy models but were created
nullable (with only a server default) by earlier migrations, which made
`alembic check` report drift. Each column gets a defensive NULL backfill to its
model default before SET NOT NULL, so this is safe on databases with old rows.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, column, sqlalchemy type, SQL literal used to backfill NULLs)
_COLUMNS = [
    ("food_logs", "logged_at", sa.DateTime(timezone=True), "now()"),
    ("foods", "created_at", sa.DateTime(timezone=True), "now()"),
    ("supplement_definitions", "active", sa.Boolean(), "true"),
    ("supplement_definitions", "created_at", sa.DateTime(timezone=True), "now()"),
    ("supplements", "logged_at", sa.DateTime(timezone=True), "now()"),
    ("users", "target_kcal", sa.Integer(), "2000"),
    ("users", "target_protein_g", sa.Float(), "150.0"),
    ("users", "target_carbs_g", sa.Float(), "250.0"),
    ("users", "target_fat_g", sa.Float(), "70.0"),
    ("users", "created_at", sa.DateTime(timezone=True), "now()"),
    ("weight_logs", "logged_at", sa.DateTime(timezone=True), "now()"),
]


def upgrade() -> None:
    for table, column, col_type, default_sql in _COLUMNS:
        op.execute(f"UPDATE {table} SET {column} = {default_sql} WHERE {column} IS NULL")
        op.alter_column(table, column, existing_type=col_type, nullable=False)


def downgrade() -> None:
    for table, column, col_type, _ in _COLUMNS:
        op.alter_column(table, column, existing_type=col_type, nullable=True)
