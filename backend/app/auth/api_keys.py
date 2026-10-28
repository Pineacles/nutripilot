"""Agent API keys: only a SHA-256 digest is stored, never the key itself.

Keys are 256-bit random values, so a plain unsalted digest is enough: there is
nothing to brute-force or look up in a rainbow table. The full key is shown
once, when it is created or regenerated; afterwards only a short prefix is kept
for display.
"""

import hashlib
import secrets

PREFIX_LENGTH = 8


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def new_api_key() -> str:
    return secrets.token_hex(32)


def api_key_fields(api_key: str) -> dict[str, str]:
    """The User columns that represent *api_key*."""
    return {"api_key_hash": hash_api_key(api_key), "api_key_prefix": api_key[:PREFIX_LENGTH]}


def mask_api_key(prefix: str) -> str:
    return f"{prefix}..."
