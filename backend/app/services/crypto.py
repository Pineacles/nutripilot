"""Transparent encryption-at-rest for sensitive columns.

Integration credentials (OAuth access/refresh tokens, client secrets, consumer
secrets, etc.) are encrypted with Fernet (AES-128-CBC + HMAC) via SQLAlchemy
``TypeDecorator`` types. Because the encryption lives at the type layer, EVERY
read/write path — routers, the sync worker's token write-back, seed scripts —
is covered automatically; no call site can "forget" to encrypt.

Key management:
- ``settings.token_encryption_key`` is one or more comma-separated Fernet keys.
- The FIRST key encrypts; ALL keys can decrypt (``MultiFernet``), enabling
  zero-downtime key rotation.
- **Losing the key(s) makes all stored integration credentials unrecoverable —
  every integration would need to be re-authorized from scratch.**

Legacy plaintext rows (written before the encryption migration ran) are read
back transparently: if a stored value is not a valid Fernet token, it is
returned as-is (a warning is logged). All WRITES are always encrypted.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def fernet() -> MultiFernet:
    """Build (and cache) a MultiFernet from the configured key(s).

    First key encrypts; the rest are decrypt-only (for rotation).
    """
    keys = [k.strip() for k in settings.token_encryption_key.split(",") if k.strip()]
    if not keys:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY is not configured")
    return MultiFernet([Fernet(k.encode()) for k in keys])


def encrypt_str(value: str) -> str:
    return fernet().encrypt(value.encode()).decode()


def try_decrypt_str(token: str) -> tuple[str, bool]:
    """Return (value, was_encrypted).

    On a valid Fernet token -> (plaintext, True).
    On a non-Fernet (legacy plaintext) value -> (value, False).
    """
    try:
        return fernet().decrypt(token.encode()).decode(), True
    except (InvalidToken, ValueError):
        return token, False


class EncryptedStr(TypeDecorator):
    """A string column encrypted at rest (stored as TEXT)."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        plaintext, was_encrypted = try_decrypt_str(value)
        if not was_encrypted:
            logger.warning(
                "EncryptedStr: stored value is not a valid Fernet token (legacy "
                "plaintext?); returning as-is. Run the credential-encryption migration."
            )
        return plaintext


class EncryptedJSON(TypeDecorator):
    """A JSON column encrypted at rest (json.dumps -> encrypt -> TEXT)."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_str(json.dumps(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        plaintext, was_encrypted = try_decrypt_str(value)
        if not was_encrypted:
            logger.warning(
                "EncryptedJSON: stored value is not a valid Fernet token (legacy "
                "plaintext?); parsing as plaintext JSON. Run the credential-encryption migration."
            )
        return json.loads(plaintext)
