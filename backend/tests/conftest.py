"""Test fixtures: isolated in-memory SQLite database per test session.

PostgreSQL-specific UUID and JSON dialects are used in models but SQLAlchemy
renders them as TEXT/JSON on SQLite, which is sufficient for unit tests.

Design: One in-memory DB per session; each test gets a fresh User (unique email)
so there are no UNIQUE constraint conflicts between tests.

SQLite compat: The PG UUID(as_uuid=True) type works in SQLAlchemy 2 on SQLite by
emitting CHAR(32) — but the round-trip requires uuid.UUID objects. We configure
the engine with a type_coerce_to_known_native event listener so UUID strings are
correctly roundtripped.
"""

from __future__ import annotations

import os
import secrets
import uuid

# Set env vars BEFORE importing app modules
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-xx")
os.environ.setdefault("API_KEY", "test-api-key-not-for-production-xxx")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from passlib.context import CryptContext
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Patch settings before app modules load them
from app.config import settings
settings.database_url = "sqlite+aiosqlite:///:memory:"
settings.jwt_secret = "test-secret-not-for-production-xx"
settings.api_key = "test-api-key-not-for-production-xxx"

from app.database import Base, get_db
from app.main import app
from app.models import *  # noqa: F401,F403

# Disable rate limiting for tests so login calls don't get throttled
from app.rate_limit import limiter
limiter.enabled = False

TEST_PASSWORD = "test-password-123"
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# SQLite-compatible engine
# ---------------------------------------------------------------------------

_test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    echo=False,
    connect_args={"check_same_thread": False},
)


@event.listens_for(_test_engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable WAL mode and foreign keys on each SQLite connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


_test_session_factory = async_sessionmaker(
    _test_engine, class_=AsyncSession, expire_on_commit=False
)

# ---------------------------------------------------------------------------
# Session-scoped table creation
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    """Create all tables once at the start of the test session."""
    # SQLAlchemy 2 maps the PG UUID type to CHAR(32) on SQLite automatically.
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def db_session():
    """Yield an AsyncSession backed by the in-memory test database."""
    async with _test_session_factory() as session:
        yield session


@pytest_asyncio.fixture()
async def async_client(db_session):
    """AsyncClient wired to the FastAPI app with the test DB injected."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Per-test user (unique email to avoid UNIQUE constraint errors)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def test_user(db_session):
    """Create a fresh User in the test DB."""
    from app.models.user import User

    unique_email = f"test-{uuid.uuid4().hex[:10]}@nutripilot.dev"
    user = User(
        id=uuid.uuid4(),
        email=unique_email,
        password_hash=_pwd_context.hash(TEST_PASSWORD),
        api_key=secrets.token_hex(32),
        target_kcal=2000,
        target_protein_g=150,
        target_carbs_g=250,
        target_fat_g=70,
        target_fiber_g=30,
        target_sugar_g=50,
        target_sodium_mg=2300,
        target_alcohol_g=0,
        target_water_ml=2500,
        target_caffeine_mg=400,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture()
async def auth_headers(test_user, async_client):
    """Return JWT Bearer headers for the test user."""
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": TEST_PASSWORD},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture()
async def api_key_headers(test_user):
    """Return X-API-Key headers for the test user."""
    return {"X-API-Key": test_user.api_key}
