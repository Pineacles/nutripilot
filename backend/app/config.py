from pydantic import model_validator
from pydantic_settings import BaseSettings

_DEV_JWT_SECRET = "dev-secret-change-in-production"
_DEV_CORS_ORIGINS = "http://localhost:3000"
# DEV-ONLY fixed Fernet key. This is committed on purpose so local/dev
# environments work out of the box. It MUST be overridden in production via
# TOKEN_ENCRYPTION_KEY (generate one with:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# ). `_check_production_secrets` rejects this default in production.
_DEV_TOKEN_ENCRYPTION_KEY = "sx9C_xR4WKwZa-JGiJ8xy4eZW5OxMkauVGVWpPuDb1A="


class Settings(BaseSettings):
    # NOTE: All default values are for development only.
    # They MUST be overridden via environment variables in production.
    environment: str = "dev"
    database_url: str = "postgresql+asyncpg://nutripilot:nutripilot@db:5432/nutripilot"
    jwt_secret: str = _DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: str = _DEV_CORS_ORIGINS
    usda_api_key: str = ""
    # Fernet key(s) for encrypting integration credentials at rest.
    # Comma-separated for rotation: the FIRST key encrypts new values, all keys
    # (first + rest) can decrypt, so to rotate, prepend a new key and keep the
    # old one until every row has been re-written. See app/services/crypto.py.
    token_encryption_key: str = _DEV_TOKEN_ENCRYPTION_KEY
    # Off for a test copy of a real database: a sync refreshes the provider's token, and providers
    # like Withings then revoke the old one, so the real instance would lose its connection.
    integration_sync: bool = True
    # The address users open NutriPilot at (e.g. https://nutripilot.example.com). OAuth callbacks
    # are built from it; empty means the first https entry of CORS_ORIGINS.
    public_url: str = ""
    # Which forwarded header identifies the client for rate limiting: "cloudflare" (a Cloudflare
    # tunnel is the only way in), "xff" (Caddy or another proxy that rewrites X-Forwarded-For), or
    # "none" (use the direct peer address). See app/client_ip.py.
    trusted_proxy_mode: str = "cloudflare"
    # Opt-in for the public demo account (demo@nutripilot.dev, password "demo"). In production
    # seed_demo.py refuses to create it and demo_daily.py stays idle unless DEMO_ACCOUNT=1.
    demo_account: bool = False
    # withings_client_id and withings_client_secret were removed:
    # credentials are stored per-integration in the Integration.field_mapping column.

    model_config = {"env_file": ".env"}

    @model_validator(mode="after")
    def _check_proxy_mode(self) -> "Settings":
        if self.trusted_proxy_mode not in ("cloudflare", "xff", "none"):
            raise ValueError("TRUSTED_PROXY_MODE must be one of: cloudflare, xff, none")
        return self

    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        if self.environment == "production":
            if self.jwt_secret == _DEV_JWT_SECRET:
                raise ValueError(
                    "JWT_SECRET must not be the development default in production. "
                    "Generate one with: openssl rand -hex 32"
                )
            if len(self.jwt_secret) < 32:
                raise ValueError(
                    "JWT_SECRET must be at least 32 characters in production. "
                    "Generate one with: openssl rand -hex 32"
                )
            if self.cors_origins == _DEV_CORS_ORIGINS:
                raise ValueError(
                    "CORS_ORIGINS must not be the development default (http://localhost:3000) "
                    "in production. Set it to your real frontend origin(s)."
                )
            if _DEV_TOKEN_ENCRYPTION_KEY in [
                k.strip() for k in self.token_encryption_key.split(",")
            ]:
                raise ValueError(
                    "TOKEN_ENCRYPTION_KEY must not include the development default in production. "
                    "Generate one with: python -c \"from cryptography.fernet import Fernet; "
                    "print(Fernet.generate_key().decode())\""
                )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a list of stripped, non-empty strings."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
