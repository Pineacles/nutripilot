"""Integration credential encryption at rest."""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select, text

from app.config import settings
from app.models.integration import Integration
from app.services.crypto import EncryptedJSON, EncryptedStr, encrypt_str, fernet, try_decrypt_str

_SECRET_REFRESH = "super-secret-refresh-token-xyz"
_SECRET_CLIENT = "super-secret-client-secret-xyz"
_ACCESS_TOKEN = "plaintext-access-token-abc"

_PAYLOAD = {
    "name": "Withings Body+",
    "source_url": "https://wbsapi.withings.net/measure",
    "auth_header": _ACCESS_TOKEN,
    "schedule": "0 6 * * *",
    "field_mapping": {
        "type": "withings_measure",
        "source_label": "withings",
        "data_type": "weight",
        "measure_map": {"1": "weight_kg", "6": "body_fat_pct"},
        "refresh_token": _SECRET_REFRESH,
        "client_id": "my-client-id",
        "client_secret": _SECRET_CLIENT,
    },
}


# --- TypeDecorator unit tests ---

def test_encrypted_str_roundtrip():
    t = EncryptedStr()
    stored = t.process_bind_param("my-secret", None)
    assert stored != "my-secret"
    assert t.process_result_value(stored, None) == "my-secret"


def test_encrypted_str_plaintext_fallback():
    """A legacy plaintext (non-Fernet) value is returned as-is on read."""
    t = EncryptedStr()
    assert t.process_result_value("legacy-plaintext-token", None) == "legacy-plaintext-token"


def test_encrypted_json_roundtrip():
    t = EncryptedJSON()
    stored = t.process_bind_param({"a": 1, "secret": "x"}, None)
    assert "secret" not in stored  # ciphertext must not leak the key value contents
    assert t.process_result_value(stored, None) == {"a": 1, "secret": "x"}


def test_encrypted_json_plaintext_fallback():
    """A legacy plaintext JSON value is parsed as-is on read."""
    t = EncryptedJSON()
    assert t.process_result_value('{"refresh_token": "old"}', None) == {"refresh_token": "old"}


def test_key_rotation_old_key_still_decrypts_new_writes_use_new_key(monkeypatch):
    """Zero-downtime key rotation: FIRST key encrypts, ALL keys can decrypt.

    ``fernet()`` is ``@lru_cache(maxsize=1)``, so rotating ``settings.token_encryption_key``
    mid-test requires clearing that cache for the change to take effect.
    """
    key1 = Fernet.generate_key().decode()
    key2 = Fernet.generate_key().decode()

    monkeypatch.setattr(settings, "token_encryption_key", key1)
    fernet.cache_clear()
    ciphertext_v1 = encrypt_str("secret-under-key1")

    # Rotate: key2 is prepended (becomes the encrypting key); key1 is kept
    # decrypt-only so already-stored rows keep working until re-written.
    monkeypatch.setattr(settings, "token_encryption_key", f"{key2},{key1}")
    fernet.cache_clear()

    try:
        # Old ciphertext (encrypted under key1 alone) still decrypts post-rotation.
        plaintext, was_encrypted = try_decrypt_str(ciphertext_v1)
        assert was_encrypted is True
        assert plaintext == "secret-under-key1"

        # New writes are encrypted with the NEW first key (key2), not key1.
        ciphertext_v2 = encrypt_str("secret-under-key2")
        assert Fernet(key2.encode()).decrypt(ciphertext_v2.encode()).decode() == "secret-under-key2"
        with pytest.raises(InvalidToken):
            Fernet(key1.encode()).decrypt(ciphertext_v2.encode())
    finally:
        # Leave the lru_cache empty so monkeypatch's teardown (restoring the
        # real test key) is picked up cleanly by the next test to call fernet().
        fernet.cache_clear()


# --- End-to-end via the API ---

async def test_integration_credentials_encrypted_at_rest(async_client, api_key_headers, db_session):
    create = await async_client.post(
        "/api/agent/integrations", json=_PAYLOAD, headers=api_key_headers
    )
    assert create.status_code == 201

    # Raw column values (bypassing the ORM TypeDecorator) must NOT contain secrets.
    rows = (await db_session.execute(text("SELECT auth_header, field_mapping FROM integrations"))).all()
    assert rows
    for auth_header, field_mapping in rows:
        assert _ACCESS_TOKEN not in (auth_header or "")
        assert _SECRET_REFRESH not in (field_mapping or "")
        assert _SECRET_CLIENT not in (field_mapping or "")
        assert auth_header != _ACCESS_TOKEN

    # ORM read decrypts transparently.
    integ = (
        await db_session.execute(
            select(Integration).where(Integration.name == "Withings Body+")
        )
    ).scalars().first()
    assert integ.auth_header == _ACCESS_TOKEN
    assert integ.field_mapping["refresh_token"] == _SECRET_REFRESH
    assert integ.field_mapping["client_secret"] == _SECRET_CLIENT
