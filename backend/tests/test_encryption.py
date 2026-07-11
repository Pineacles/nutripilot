"""Integration credential encryption at rest."""

from __future__ import annotations

from sqlalchemy import select, text

from app.models.integration import Integration
from app.services.crypto import EncryptedJSON, EncryptedStr

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
