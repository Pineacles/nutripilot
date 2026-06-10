from pydantic import model_validator
from pydantic_settings import BaseSettings

_DEV_JWT_SECRET = "dev-secret-change-in-production"


class Settings(BaseSettings):
    # NOTE: All default values are for development only.
    # They MUST be overridden via environment variables in production.
    environment: str = "dev"
    database_url: str = "postgresql+asyncpg://nutripilot:nutripilot@db:5432/nutripilot"
    jwt_secret: str = _DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    api_key: str = "dev-api-key-change-in-production"
    cors_origins: str = "http://localhost:3000"
    usda_api_key: str = ""
    # withings_client_id and withings_client_secret were removed:
    # credentials are stored per-integration in the Integration.field_mapping column.

    model_config = {"env_file": ".env"}

    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        if self.environment == "production":
            if self.jwt_secret == _DEV_JWT_SECRET:
                raise ValueError(
                    "JWT_SECRET must not be the development default in production. "
                    "Generate one with: openssl rand -hex 32"
                )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a list of stripped, non-empty strings."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
