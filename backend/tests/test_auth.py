"""Auth endpoint tests: login/refresh/protected routes."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_login_success(async_client, test_user):
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "test-password-123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_login_wrong_password(async_client, test_user):
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "wrong-password"},
    )
    assert resp.status_code == 401


async def test_login_unknown_user(async_client, test_user):
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "nobody-at-all@example.com", "password": "password"},
    )
    assert resp.status_code == 401


async def test_refresh_token(async_client, test_user):
    login = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "test-password-123"},
    )
    refresh_token = login.json()["refresh_token"]
    resp = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_refresh_with_access_token_rejected(async_client, test_user):
    """Access tokens must not be accepted as refresh tokens."""
    login = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "test-password-123"},
    )
    access_token = login.json()["access_token"]
    resp = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert resp.status_code == 401


async def test_protected_endpoint_requires_auth(async_client, test_user):
    resp = await async_client.get("/api/v1/settings")
    assert resp.status_code == 401


async def test_api_key_auth(async_client, test_user):
    resp = await async_client.get(
        "/api/agent/summary/today",
        headers={"X-API-Key": test_user.api_key},
    )
    assert resp.status_code == 200


async def test_api_key_wrong_key_rejected(async_client, test_user):
    resp = await async_client.get(
        "/api/agent/summary/today",
        headers={"X-API-Key": "completely-wrong-key"},
    )
    assert resp.status_code == 401


async def test_agent_endpoint_accepts_jwt(async_client, auth_headers):
    """/api/agent/* must also accept a JWT Bearer token, not just X-API-Key."""
    resp = await async_client.get("/api/agent/summary/today", headers=auth_headers)
    assert resp.status_code == 200


async def test_foods_create_accepts_jwt(async_client, auth_headers):
    """/api/foods/* must also accept a JWT Bearer token, not just X-API-Key."""
    resp = await async_client.post(
        "/api/foods",
        json={
            "name": "JWT Auth Test Food",
            "source": "manual",
            "nutrients": {"kcal": 100, "protein": 10.0},
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201


async def test_jwt_or_api_key_wrong_api_key_still_401(async_client, test_user):
    """Wrong X-API-Key on the combined dependency must still be rejected."""
    resp = await async_client.post(
        "/api/foods",
        json={"name": "Should Not Be Created", "source": "manual", "nutrients": {"kcal": 100}},
        headers={"X-API-Key": "completely-wrong-key"},
    )
    assert resp.status_code == 401
