"""Reconnect a Withings integration through Withings' own login page.

Withings hands out single-use refresh tokens, so a lost one (crash between refresh and save,
or a second copy of the database refreshing first) leaves the integration in `needs_reauth`.
`POST /integrations/{id}/reconnect` returns the Withings login URL; Withings sends the browser
back to `GET /oauth/withings/callback`, which swaps the code for fresh tokens and returns the
user to the Connections settings page.

The callback carries no login of its own: the signed, short-lived `state` names the user and
the integration, and is only issued to that signed-in user. Its nonce is also kept on the
integration and cleared on first use, so a state works once and a newer one replaces it.
"""

import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.config import settings
from app.database import get_db
from app.models.integration import Integration
from app.models.user import User

router = APIRouter()

AUTHORIZE_URL = "https://account.withings.com/oauth2_user/authorize2"
TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2"
CALLBACK_PATH = "/api/agent/oauth/withings/callback"
SETTINGS_PATH = "/settings/connections"
STATE_TYPE = "withings_oauth"
STATE_MINUTES = 15
NONCE_KEY = "reconnect_nonce"


def public_url() -> str:
    """The address users open NutriPilot at: PUBLIC_URL, else the first https CORS origin."""
    if settings.public_url:
        return settings.public_url.rstrip("/")
    origins = settings.cors_origins_list
    return next((o for o in origins if o.startswith("https://")), origins[0] if origins else "").rstrip("/")


def redirect_uri() -> str:
    return public_url() + CALLBACK_PATH


def back_to_settings(result: str) -> RedirectResponse:
    return RedirectResponse(f"{public_url()}{SETTINGS_PATH}?withings={result}", status_code=303)


def make_state(user_id: UUID, integration_id: UUID, nonce: str) -> str:
    exp = datetime.now(UTC) + timedelta(minutes=STATE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "iid": str(integration_id), "nonce": nonce, "type": STATE_TYPE, "exp": exp},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def read_state(state: str) -> tuple[UUID, UUID, str] | None:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != STATE_TYPE or not isinstance(payload.get("nonce"), str):
            return None
        return UUID(payload["sub"]), UUID(payload["iid"]), payload["nonce"]
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


async def exchange_code(code: str, client_id: str, client_secret: str) -> dict | None:
    """Withings' token endpoint answers HTTP 200 with the outcome in the body's `status`."""
    data = {
        "action": "requesttoken",
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri(),
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(TOKEN_URL, data=data)
        body = resp.json()
    except (httpx.HTTPError, ValueError):
        return None
    if not isinstance(body, dict) or body.get("status") != 0 or not isinstance(body.get("body"), dict):
        return None
    tokens = body["body"]
    access, refresh = tokens.get("access_token"), tokens.get("refresh_token")
    if not isinstance(access, str) or not isinstance(refresh, str) or not access or not refresh:
        return None
    try:
        expires_in = int(tokens.get("expires_in") or 10800)
    except (TypeError, ValueError):
        expires_in = 10800
    return {"access_token": access, "refresh_token": refresh, "expires_in": expires_in}


@router.post(
    "/integrations/{integration_id}/reconnect",
    summary="Start reconnecting a Withings integration",
    description=(
        "Returns `{url}`: the Withings login page. Open it in the browser; after the user allows "
        "access, Withings returns to NutriPilot, the integration gets fresh tokens and the browser "
        f"lands on `{SETTINGS_PATH}?withings=connected` (or `?withings=failed`).\n\n"
        f"The Withings app must list `{CALLBACK_PATH}` on this NutriPilot's address as a callback URL.\n\n"
        "**Errors:** `404` not found, `422 NOT_WITHINGS` for other integration types, "
        "`422 NO_CLIENT` when the integration has no client_id/client_secret."
    ),
)
async def start_reconnect(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    integration = (await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )).scalar_one_or_none()
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
    fm = integration.field_mapping or {}
    if fm.get("type") != "withings_measure":
        raise HTTPException(status_code=422, detail={"code": "NOT_WITHINGS", "message": "Only Withings integrations reconnect here."})
    if not fm.get("client_id") or not fm.get("client_secret"):
        raise HTTPException(status_code=422, detail={"code": "NO_CLIENT", "message": "The integration has no Withings client_id and client_secret."})
    nonce = secrets.token_urlsafe(24)
    integration.field_mapping = {**fm, NONCE_KEY: nonce}
    await db.commit()
    query = urlencode({
        "response_type": "code",
        "client_id": fm["client_id"],
        "scope": "user.metrics",
        "redirect_uri": redirect_uri(),
        "state": make_state(user.id, integration.id, nonce),
    })
    return {"url": f"{AUTHORIZE_URL}?{query}"}


@router.get("/oauth/withings/callback", include_in_schema=False)
async def withings_callback(
    code: str | None = None,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    ids = read_state(state) if state else None
    if ids is None:
        return back_to_settings("expired")
    user_id, integration_id, nonce = ids
    integration = (await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user_id)
    )).scalar_one_or_none()
    fm = dict(integration.field_mapping or {}) if integration else {}
    stored = fm.pop(NONCE_KEY, None)
    if integration is None or not isinstance(stored, str) or not secrets.compare_digest(stored, nonce):
        return back_to_settings("expired")
    # The state is spent whatever happens next.
    integration.field_mapping = fm
    await db.commit()
    if not code:
        return back_to_settings("cancelled")
    if fm.get("type") != "withings_measure":
        return back_to_settings("failed")

    tokens = await exchange_code(code, fm.get("client_id", ""), fm.get("client_secret", ""))
    if tokens is None:
        return back_to_settings("failed")

    integration.auth_header = tokens["access_token"]
    fm["refresh_token"] = tokens["refresh_token"]
    fm["token_expires_at"] = datetime.now(UTC).timestamp() + tokens["expires_in"]
    fm.pop("last_error", None)
    integration.field_mapping = fm
    integration.status = "active"
    await db.commit()
    return back_to_settings("connected")
