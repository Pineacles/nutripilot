"""Add pg_trgm extension and GIN index for fuzzy food search

Revision ID: 002
Revises: 001
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute("CREATE INDEX idx_foods_name_trgm ON foods USING gin (name gin_trgm_ops);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_foods_name_trgm;")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm;")
