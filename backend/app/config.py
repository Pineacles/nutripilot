from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # NOTE: All default values are for development only.
    # They MUST be overridden via environment variables in production.
    environment: str = "dev"
    database_url: str = "postgresql+asyncpg://nutripilot:nutripilot@db:5432/nutripilot"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    api_key: str = "dev-api-key-change-in-production"
    cors_origins: str = "http://localhost:3000"
    usda_api_key: str = ""
    withings_client_id: str = ""
    withings_client_secret: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
