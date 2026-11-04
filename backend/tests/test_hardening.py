"""Production config guards, demo-account opt-in and barcode validation."""

import asyncio

import pytest

from app.config import Settings
from app.external import openfoodfacts, usda

_GOOD = {
    "environment": "production",
    "jwt_secret": "x" * 32,
    "cors_origins": "https://nutri.example.com",
    "token_encryption_key": "IRrBEixRKeDMt6CFRLeX5PYhYqO-m51ElyzSFq_TA9M=",
}


def _settings(**over):
    return Settings(_env_file=None, **{**_GOOD, **over})


def test_production_accepts_good_config():
    assert _settings().trusted_proxy_mode == "cloudflare"


def test_production_rejects_short_jwt_secret():
    with pytest.raises(ValueError, match="at least 32"):
        _settings(jwt_secret="short-secret")


def test_production_rejects_dev_fernet_key():
    from app.config import _DEV_TOKEN_ENCRYPTION_KEY

    with pytest.raises(ValueError, match="TOKEN_ENCRYPTION_KEY"):
        _settings(token_encryption_key=_DEV_TOKEN_ENCRYPTION_KEY)


def test_bad_proxy_mode_rejected():
    with pytest.raises(ValueError, match="TRUSTED_PROXY_MODE"):
        _settings(trusted_proxy_mode="anything")


def test_seed_demo_refused_in_production_without_opt_in(monkeypatch):
    import seed_demo
    from app.config import settings

    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "demo_account", False)
    with pytest.raises(SystemExit, match="Refusing"):
        asyncio.run(seed_demo.seed_demo())


def test_demo_daily_idle_in_production_without_opt_in(monkeypatch):
    from app import demo_daily
    from app.config import settings

    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "demo_account", False)

    def boom():
        raise AssertionError("must not open a session")

    monkeypatch.setattr(demo_daily, "async_session", boom)
    asyncio.run(demo_daily.seed_today())


@pytest.mark.parametrize("code", ["../../x", "123", "1234/../../a", "12 34", "abc12345", "1" * 51, ""])
def test_malformed_barcode_rejected_without_network(code, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "usda_api_key", "k")

    def boom(*a, **k):
        raise AssertionError("must not make a request")

    monkeypatch.setattr(openfoodfacts.httpx, "AsyncClient", boom)
    assert asyncio.run(openfoodfacts.lookup_barcode(code)) is None
    assert asyncio.run(usda.lookup_barcode(code)) is None
