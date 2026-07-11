"""Model <-> migration parity check.

The alembic migrations under alembic/versions/ use Postgres-only DDL
(``postgresql.JSON``, ``gen_random_uuid()``, ``::text USING`` casts,
``CREATE EXTENSION pg_trgm``) and are NOT SQLite-compatible, so they can't run
against the in-memory engine the rest of this test suite uses.

Pragmatic choice (per the redesign brief): spin up a real ``postgres:16-alpine``
container on a random high port, run the actual migrations against it in a
subprocess (a fresh process, so it neither fights over pytest-asyncio's
running event loop with alembic's own ``asyncio.run()`` in env.py, nor
permanently mutates this process's ``app.config.settings`` singleton), then
ask alembic whether the resulting schema matches the current SQLAlchemy model
metadata.

Skipped automatically if docker isn't usable (it is on GitHub Actions'
ubuntu-latest runners, which is where this is meant to actually run).
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path

import pytest

_BACKEND_DIR = Path(__file__).resolve().parents[1]


def _docker_available() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        subprocess.run(
            ["docker", "info"], capture_output=True, timeout=10, check=True
        )
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return False


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


pytestmark = pytest.mark.skipif(
    not _docker_available(), reason="docker is not available in this environment"
)


def test_migrations_apply_cleanly_and_match_models():
    container = f"nutripilot-migtest-{uuid.uuid4().hex[:8]}"
    port = _free_port()
    dsn_async = f"postgresql+asyncpg://postgres:postgres@localhost:{port}/nutripilot_migtest"

    run = subprocess.run(
        [
            "docker", "run", "--rm", "-d", "--name", container,
            "-e", "POSTGRES_PASSWORD=postgres",
            "-e", "POSTGRES_USER=postgres",
            "-e", "POSTGRES_DB=nutripilot_migtest",
            "-p", f"{port}:5432",
            "postgres:16-alpine",
        ],
        capture_output=True, text=True, timeout=60,
    )
    assert run.returncode == 0, f"failed to start postgres container: {run.stderr}"

    try:
        # Wait for the server to accept connections.
        for _ in range(30):
            ready = subprocess.run(
                ["docker", "exec", container, "pg_isready", "-U", "postgres"],
                capture_output=True, timeout=10,
            )
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            pytest.fail("postgres container did not become ready in time")

        env = {**os.environ, "DATABASE_URL": dsn_async}

        upgrade = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=_BACKEND_DIR, env=env, capture_output=True, text=True, timeout=120,
        )
        assert upgrade.returncode == 0, (
            "alembic upgrade head failed against real Postgres "
            f"(migrations are not Postgres-clean):\n{upgrade.stdout}\n{upgrade.stderr}"
        )

        check = subprocess.run(
            [sys.executable, "-m", "alembic", "check"],
            cwd=_BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60,
        )
        # Historical drift (nullability + the pg_trgm index) was fixed by
        # migration e5f6a7b8c9d0 and the Index() declaration on the Food
        # model, so any drift reported here is NEW: a model change without a
        # matching migration (or vice versa). Read the diff in the failure
        # message and write the missing migration.
        assert check.returncode == 0, (
            "alembic check found model/migration drift:\n"
            f"{check.stdout}\n{check.stderr}"
        )
    finally:
        subprocess.run(["docker", "stop", container], capture_output=True, timeout=30)
