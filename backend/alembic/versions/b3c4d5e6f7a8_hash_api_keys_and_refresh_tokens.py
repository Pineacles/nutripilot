"""Store API keys as SHA-256 digests and make refresh tokens revocable

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-10-28 12:00:00.000000

users.api_key (plaintext) becomes users.api_key_hash (SHA-256 hex) plus
users.api_key_prefix (first 8 characters, display only). Existing keys are
hashed in place, so agents keep working with the key they already hold.

refresh_tokens records the jti of every issued refresh token. Refresh JWTs
issued before this migration carry no jti and are refused, so each session
logs in once more.

The downgrade cannot restore the original keys (the digest is one way): it
puts the digest into users.api_key, which means every agent needs a new key
from Settings afterwards.
"""
import hashlib
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("api_key_hash", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("api_key_prefix", sa.String(16), nullable=True))

    conn = op.get_bind()
    users = sa.table(
        "users",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("api_key", sa.String),
        sa.column("api_key_hash", sa.String),
        sa.column("api_key_prefix", sa.String),
    )
    for user_id, api_key in conn.execute(sa.select(users.c.id, users.c.api_key)).all():
        conn.execute(
            users.update()
            .where(users.c.id == user_id)
            .values(
                api_key_hash=hashlib.sha256(api_key.encode("utf-8")).hexdigest(),
                api_key_prefix=api_key[:8],
            )
        )

    op.alter_column("users", "api_key_hash", nullable=False)
    op.alter_column("users", "api_key_prefix", nullable=False)
    op.create_unique_constraint("users_api_key_hash_key", "users", ["api_key_hash"])
    op.drop_column("users", "api_key")  # also drops its unique constraint

    op.create_table(
        "refresh_tokens",
        sa.Column("jti", sa.String(32), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_refresh_tokens_user", "refresh_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_refresh_tokens_user", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.add_column("users", sa.Column("api_key", sa.String(64), nullable=True))
    op.execute("UPDATE users SET api_key = api_key_hash")
    op.alter_column("users", "api_key", nullable=False)
    op.create_unique_constraint("users_api_key_key", "users", ["api_key"])
    op.drop_constraint("users_api_key_hash_key", "users", type_="unique")
    op.drop_column("users", "api_key_hash")
    op.drop_column("users", "api_key_prefix")
