"""Encrypt integration credentials at rest (auth_header, field_mapping)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-11 00:00:04.000000

Switches integrations.auth_header (was VARCHAR(1000)) and integrations.field_mapping
(was JSON) to TEXT, then encrypts every existing value with the configured
Fernet key (app.services.crypto). Idempotent: values that already decrypt as a
valid Fernet token are left untouched, so re-running is safe.

NOTE: requires TOKEN_ENCRYPTION_KEY to be configured (the same key the app uses).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.services.crypto import encrypt_str, try_decrypt_str

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Widen column types to TEXT (encrypted blobs are longer than plaintext).
    op.alter_column(
        'integrations', 'auth_header',
        existing_type=sa.String(length=1000),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        'integrations', 'field_mapping',
        existing_type=postgresql.JSON(),
        type_=sa.Text(),
        existing_nullable=True,
        postgresql_using='field_mapping::text',
    )

    # 2. Encrypt existing values in place (skip already-encrypted rows).
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, auth_header, field_mapping FROM integrations")
    ).fetchall()
    for rid, auth_header, field_mapping in rows:
        updates = {}
        if auth_header is not None:
            _, was_encrypted = try_decrypt_str(auth_header)
            if not was_encrypted:
                updates['auth_header'] = encrypt_str(auth_header)
        if field_mapping is not None:
            _, was_encrypted = try_decrypt_str(field_mapping)
            if not was_encrypted:
                # field_mapping is already a JSON string after the type change.
                updates['field_mapping'] = encrypt_str(field_mapping)
        if updates:
            set_clause = ", ".join(f"{col} = :{col}" for col in updates)
            conn.execute(
                sa.text(f"UPDATE integrations SET {set_clause} WHERE id = :id"),
                {**updates, "id": rid},
            )


def downgrade() -> None:
    # 1. Decrypt existing values back to plaintext.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, auth_header, field_mapping FROM integrations")
    ).fetchall()
    for rid, auth_header, field_mapping in rows:
        updates = {}
        if auth_header is not None:
            plaintext, was_encrypted = try_decrypt_str(auth_header)
            if was_encrypted:
                updates['auth_header'] = plaintext
        if field_mapping is not None:
            plaintext, was_encrypted = try_decrypt_str(field_mapping)
            if was_encrypted:
                updates['field_mapping'] = plaintext
        if updates:
            set_clause = ", ".join(f"{col} = :{col}" for col in updates)
            conn.execute(
                sa.text(f"UPDATE integrations SET {set_clause} WHERE id = :id"),
                {**updates, "id": rid},
            )

    # 2. Restore original column types.
    op.alter_column(
        'integrations', 'auth_header',
        existing_type=sa.Text(),
        type_=sa.String(length=1000),
        existing_nullable=True,
    )
    op.alter_column(
        'integrations', 'field_mapping',
        existing_type=sa.Text(),
        type_=postgresql.JSON(),
        existing_nullable=True,
        postgresql_using='field_mapping::json',
    )
