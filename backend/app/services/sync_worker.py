"""Background sync worker for integrations.

Architecture:
- field_mapping on each Integration defines HOW to map external data to NutriPilot fields.
- Vendor-specific code only handles: API calls, auth refresh, response parsing into raw records.
- A generic pipeline reads the mapping and writes data via upsert (idempotent, no duplicates).

Token lifecycle (generic, works for all providers):
- ``_ensure_valid_token`` checks ``token_expires_at`` before refreshing.
- Refresher functions return a ``RefreshResult`` with error classification
  (transient vs permanent) so the retry loop knows when to stop.
- Transient failures retry with exponential backoff (3 attempts).
- Permanent failures (revoked/expired refresh token) immediately mark ``needs_reauth``.

field_mapping schema:
{
    "type": "withings_measure" | "generic_json" | ...,
    "source_label": "withings",              # used as source in weight_logs
    "data_type": "weight",                    # what kind of data: weight, food, supplement
    "measure_map": {                          # maps vendor-specific keys -> NutriPilot fields
        "1":  "weight_kg",                    # Withings: meastype int -> field name
        "6":  "body_fat_pct",
        "8":  "body_fat_kg",
        "76": "muscle_mass_pct"
    },
    // auth fields (vendor-specific, stored alongside)
    "refresh_token": "...",
    "client_id": "...",
    "client_secret": "...",
    "token_expires_at": 1712000000           # UTC epoch, set after each refresh
}
"""

from __future__ import annotations

import asyncio
import logging
import random
import typing
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.integration import Integration
from app.services.integration_logger import SyncLogger
from app.services.logging_service import upsert_weight
from app.services.url_guard import UnsafeURLError, assert_public_http_url

logger = logging.getLogger(__name__)

# -- NutriPilot weight fields that integrations can write to --
VALID_WEIGHT_FIELDS = {"weight_kg", "body_fat_pct", "muscle_mass_pct", "body_fat_kg", "muscle_mass_kg"}

# -- Retry configuration --
MAX_REFRESH_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 2        # 2s, 8s, 32s  (base * 4^attempt)
TOKEN_EXPIRY_BUFFER_SECS = 300  # refresh 5 minutes before expiry


# ================================================================
# RefreshResult: the return contract for all refresher functions
# ================================================================

@dataclass
class RefreshResult:
    """Return type for all token refresher functions.

    Replaces the old ``dict | None`` contract so the generic layer can
    distinguish transient errors (retry) from permanent ones (stop).
    """
    tokens: dict[str, str | None] | None = None   # access_token, refresh_token, expires_in
    permanent: bool = False                        # True = don't retry, mark needs_reauth
    error: str = ""                                # human-readable (never contains tokens/PII)
    provider_code: int | None = None               # vendor-specific error code (e.g. Withings 293)
    http_status: int | None = None                 # HTTP status from the provider

    @property
    def ok(self) -> bool:
        return self.tokens is not None and self.tokens.get("access_token") is not None


# OAuth refresh endpoint registry: each integration type that supports
# token refresh registers its handler here. New integrations just add an entry.
_TOKEN_REFRESHERS: dict[str, typing.Callable[..., typing.Awaitable[RefreshResult]]] = {}

# Fetcher registry: maps integration type -> fetch function
_FETCHERS: dict[str, typing.Callable] = {}


# ================================================================
# Generic token refresh middleware (with retry + expiry tracking)
# ================================================================

async def _ensure_valid_token(
    db: AsyncSession,
    integration: Integration,
    log: SyncLogger,
) -> bool:
    """Proactively refresh the access token before syncing.

    - Skips refresh if the token hasn't expired yet (``token_expires_at``).
    - Retries transient failures with exponential backoff.
    - Only marks ``needs_reauth`` on permanent failures.

    Returns True if token is valid, False if auth is broken.
    """
    fm = integration.field_mapping or {}
    itype = fm.get("type", "")
    refresh_token = fm.get("refresh_token")
    client_id = fm.get("client_id")
    client_secret = fm.get("client_secret")

    # If no refresh credentials, assume token is valid (API key auth)
    if not refresh_token or not client_id or not client_secret:
        return bool(integration.auth_header)

    # Check if current token is still valid
    expires_at = fm.get("token_expires_at")
    if expires_at and integration.auth_header:
        now_epoch = datetime.now(UTC).timestamp()
        remaining = expires_at - now_epoch
        if remaining > TOKEN_EXPIRY_BUFFER_SECS:
            log.debug("token_still_valid", expires_in=int(remaining))
            return True

    # Token expired or about to: refresh with retry
    refresher = _TOKEN_REFRESHERS.get(itype, _refresh_oauth2_token)
    last_result: RefreshResult | None = None

    for attempt in range(1, MAX_REFRESH_ATTEMPTS + 1):
        log.info("token_refresh_start", attempt=attempt)

        result = await refresher(refresh_token, client_id, client_secret, fm)
        last_result = result

        if result.ok:
            # Save new tokens + expiry
            integration.auth_header = result.tokens["access_token"]
            if result.tokens.get("refresh_token"):
                fm["refresh_token"] = result.tokens["refresh_token"]

            # Track expiry so we can skip unnecessary refreshes
            # Default to 3 hours (10800s) for Withings if not provided
            expires_in = result.tokens.get("expires_in") or 10800
            fm["token_expires_at"] = datetime.now(UTC).timestamp() + int(expires_in)

            fm.pop("last_error", None)
            integration.field_mapping = fm
            await db.commit()

            log.info("token_refresh_ok", attempt=attempt,
                     expires_in=expires_in)
            return True

        if result.permanent:
            # Don't retry: token is revoked or refresh_token expired
            log.error("token_refresh_permanent_fail", attempt=attempt,
                      error_type="permanent",
                      provider_code=result.provider_code,
                      detail=result.error)
            await _update_status(db, integration, "needs_reauth", result.error, log)
            return False

        # Transient failure: backoff and retry (with jitter to avoid thundering herd)
        backoff = BACKOFF_BASE_SECONDS * (4 ** (attempt - 1)) + random.uniform(0, 2)
        log.warning("token_refresh_retry", attempt=attempt,
                    error_type="transient",
                    http_status=result.http_status,
                    provider_code=result.provider_code,
                    detail=result.error,
                    next_retry=f"{backoff}s")

        if attempt < MAX_REFRESH_ATTEMPTS:
            await asyncio.sleep(backoff)

    # All retries exhausted: mark as error (NOT needs_reauth)
    # so the next scheduled sync will try again
    error_msg = f"Token refresh failed after {MAX_REFRESH_ATTEMPTS} attempts: {last_result.error if last_result else 'unknown'}"
    log.error("token_refresh_exhausted", attempt=MAX_REFRESH_ATTEMPTS,
              error_type="transient_exhausted",
              detail=error_msg)
    await _update_status(db, integration, "error", error_msg, log)
    return False


# ================================================================
# Generic pipeline
# ================================================================

async def sync_integration(integration_id: UUID) -> dict:
    """Sync a single integration. Returns a status dict."""
    async with async_session() as db:
        result = await db.execute(
            select(Integration).where(Integration.id == integration_id)
        )
        integration = result.scalar_one_or_none()
        if not integration:
            return {"ok": False, "error": "Integration not found"}

        if integration.status == "needs_reauth":
            return {"ok": False, "error": "Integration needs re-authorization"}

        fm = integration.field_mapping or {}
        itype = fm.get("type", "")

        with SyncLogger(integration) as log:
            # -- Step 0: Ensure valid token (with retry) --
            token_ok = await _ensure_valid_token(db, integration, log)
            if not token_ok:
                log.mark_failed("token_refresh_failed")
                return {"ok": False, "error": "Authentication failed - needs re-authorization"}

            # -- Step 1: Fetch raw records (vendor-specific) --
            fetcher = _FETCHERS.get(itype)
            if not fetcher:
                log.mark_failed(f"unknown_type:{itype}")
                return {"ok": False, "error": f"Unknown integration type: {itype}"}

            raw_records = await fetcher(db, integration, log)
            if raw_records is None:
                log.mark_failed("fetch_failed")
                return {"ok": False, "error": "Fetch failed - check integration status"}

            # -- Step 2: Map fields using measure_map from field_mapping --
            measure_map = fm.get("measure_map", {})
            source_label = fm.get("source_label", integration.name.lower().replace(" ", "_"))
            data_type = fm.get("data_type", "weight")
            conversions = fm.get("conversions")

            # -- Step 3: Write via generic upsert --
            if data_type == "weight":
                synced = await _write_weight_records(db, integration.user_id, raw_records, measure_map, source_label, log, conversions)
            else:
                await _update_status(db, integration, "error", f"Unsupported data_type: {data_type}", log)
                log.mark_failed(f"unsupported_data_type:{data_type}")
                return {"ok": False, "error": f"Unsupported data_type: {data_type}"}

            await _update_status(db, integration, "active", None, log)
            return {"ok": True, "entries_synced": synced}


async def _write_weight_records(
    db: AsyncSession,
    user_id: UUID,
    raw_records: list[dict],
    measure_map: dict[str, str],
    source_label: str,
    log: SyncLogger,
    conversions: dict[str, dict] | None = None,
) -> int:
    """Generic writer: maps raw records to weight_log fields and upserts.

    Each raw_record has a "date" key and numeric keys (vendor measure type IDs).
    measure_map maps those keys -> NutriPilot field names (e.g., "1" -> "weight_kg").

    ``conversions`` (optional): post-mapping transformations for specific fields.
    Example: {"muscle_mass_kg": {"factor": 0.55, "description": "BIA to DEXA skeletal muscle"}}
    Applied after mapping, before upsert. Derived fields (e.g. muscle_mass_pct)
    are recalculated from the converted values.
    """
    conversions = conversions or {}
    synced = 0
    skipped = 0
    for record in raw_records:
        entry_date = record.get("date")
        if not entry_date:
            continue

        # Build the NutriPilot field dict from the mapping
        mapped: dict[str, float] = {}
        for vendor_key, nutripilot_field in measure_map.items():
            if nutripilot_field not in VALID_WEIGHT_FIELDS:
                continue
            value = record.get(vendor_key)
            if value is not None:
                mapped[nutripilot_field] = value

        if "weight_kg" not in mapped:
            skipped += 1
            continue

        # Apply conversions (e.g. BIA muscle mass → DEXA-equivalent)
        for field, conv in conversions.items():
            if field in mapped and "factor" in conv:
                mapped[field] = round(mapped[field] * conv["factor"], 2)

        # Derive muscle_mass_pct from converted muscle_mass_kg
        if "muscle_mass_kg" in mapped and "muscle_mass_pct" not in mapped:
            mapped["muscle_mass_pct"] = round(mapped["muscle_mass_kg"] / mapped["weight_kg"] * 100, 1)

        try:
            await upsert_weight(
                db=db,
                user_id=user_id,
                weight_kg=mapped["weight_kg"],
                body_fat_pct=mapped.get("body_fat_pct"),
                muscle_mass_pct=mapped.get("muscle_mass_pct"),
                body_fat_kg=mapped.get("body_fat_kg"),
                muscle_mass_kg=mapped.get("muscle_mass_kg"),
                source=source_label,
                log_date=entry_date,
            )
            synced += 1
        except Exception as exc:
            skipped += 1
            log.warning("upsert_failed", detail=f"date={entry_date} error={type(exc).__name__}: {exc}")

    log.info("write_complete", upserted=synced, skipped=skipped)
    return synced


async def _update_status(
    db: AsyncSession,
    integration: Integration,
    status: str,
    error_msg: str | None,
    log: SyncLogger,
) -> None:
    """Update integration status. Only advances last_synced_at on success.

    last_synced_at is used as the Withings ``lastupdate`` parameter to fetch
    only new measurements. If we advance it on failures, we'd skip measurements
    that arrived between the last success and the next successful sync.
    """
    old_status = integration.status
    integration.status = status
    if status == "active":
        integration.last_synced_at = datetime.now(UTC)
    fm = integration.field_mapping or {}
    if error_msg:
        fm["last_error"] = error_msg
    else:
        fm.pop("last_error", None)
    integration.field_mapping = fm
    await db.commit()

    if old_status != status:
        log.info("status_changed", status_from=old_status, status_to=status)


# ================================================================
# Withings vendor adapter
# ================================================================

async def _fetch_withings(
    db: AsyncSession,
    integration: Integration,
    log: SyncLogger,
) -> list[dict] | None:
    """Fetch from Withings API. Token is already refreshed by _ensure_valid_token."""
    fm = integration.field_mapping or {}
    access_token = integration.auth_header
    measure_map = fm.get("measure_map", {})

    if not access_token:
        await _update_status(db, integration, "error", "No access token", log)
        return None

    requested_types = [int(k) for k in measure_map.keys() if k.isdigit()]
    if not requested_types:
        await _update_status(db, integration, "error", "No measure types in measure_map", log)
        return None

    groups = await _call_withings_api(access_token, requested_types, integration.last_synced_at, log)

    if groups is None:
        await _update_status(db, integration, "error", "API call failed", log)
        return None

    records = _parse_withings_groups(groups, set(requested_types))
    log.info("fetch_ok", records=len(records))
    return records


async def _call_withings_api(
    access_token: str,
    measure_types: list[int],
    last_synced: datetime | None,
    log: SyncLogger,
) -> list[dict] | None:
    """Call the Withings Measure getmeas endpoint."""
    url = "https://wbsapi.withings.net/measure"
    params: dict = {
        "action": "getmeas",
        "meastype": ",".join(str(t) for t in measure_types),
        "category": 1,
    }
    if last_synced:
        params["lastupdate"] = int(last_synced.timestamp())

    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, data=params, headers=headers)

        if resp.status_code >= 500:
            log.error("withings_api_error", http_status=resp.status_code,
                      detail=f"Withings server error (HTTP {resp.status_code})")
            return None

        body = resp.json()
        status_code = body.get("status")
        if status_code != 0:
            error_desc = body.get("error", "")
            log.error("withings_api_error",
                      provider_code=status_code,
                      detail=f"getmeas failed: status={status_code} error={error_desc!r}")
            return None
        return body.get("body", {}).get("measuregrps", [])
    except Exception as e:
        log.error("withings_api_exception", detail=f"{type(e).__name__}: {e}")
        return None


def _parse_withings_groups(groups: list[dict], accepted_types: set[int]) -> list[dict]:
    """Parse Withings measuregrps into raw records.

    Returns [{date: date, "1": 80.5, "6": 18.2, ...}, ...] where keys are
    vendor measure type IDs as strings; the generic mapper handles the rest.
    """
    from datetime import date as date_type
    by_date: dict[date_type, dict] = defaultdict(dict)

    for grp in groups:
        ts = grp.get("date", 0)
        d = datetime.fromtimestamp(ts, tz=UTC).date()
        for m in grp.get("measures", []):
            mtype = m.get("type")
            if mtype not in accepted_types:
                continue
            value = m.get("value", 0) * (10 ** m.get("unit", 0))
            by_date[d][str(mtype)] = round(value, 3)

    return [{"date": d, **vals} for d, vals in sorted(by_date.items())]


# ================================================================
# Token refreshers: return RefreshResult, classify errors
# ================================================================

# ── Withings error codes (JSON body "status" field, NOT HTTP codes) ──
# IMPORTANT: Withings ALWAYS returns HTTP 200; errors are in the JSON "status" field.
# These are Withings-specific codes, not HTTP status codes.
#
# Permanent (re-auth required; retrying with same params won't help):
#   100  = invalid hash/email
#   247  = bad/missing userid
#   250  = invalid userid/publickey
#   264  = unknown/invalid email
#   293  = bad callback URL or params
#   301  = token invalid or doesn't exist
#   302  = action not permitted for user
#   303  = invalid params / wrong signature
#   304  = invalid params (NOT "token expired"; Withings codes != HTTP codes)
#   320  = invalid refresh_token
#   342  = invalid OAuth signature
#   343  = account needs re-linking
#   401  = not enough permissions / expired token
#   501  = invalid params (per python_withings_api STATUS_INVALID_PARAMS)
#   502  = invalid params (per python_withings_api STATUS_INVALID_PARAMS)
#   503  = invalid params (bad client_id/secret or consumed refresh_token)
#   2554 = wrong action/webservice
#   2556 = undefined service
#
# Transient (retry with backoff):
#   305  = rate limited
#   522  = timeout (Withings side)
#   601  = too many requests
#
# Note on 503: Withings refresh tokens are SINGLE-USE. Each refresh returns a new
# refresh_token. If the previous refresh succeeded but the new token wasn't saved
# (crash, timeout, etc.), the old refresh_token is dead. The only fix is re-auth.
_WITHINGS_PERMANENT_CODES = {
    100, 247, 250, 264, 293, 301, 302, 303, 304, 320, 342, 343, 401,
    501, 502, 503, 2554, 2556,
}
_WITHINGS_TRANSIENT_CODES = {305, 522, 601}


async def _refresh_withings_token(
    refresh_token: str,
    client_id: str,
    client_secret: str,
    fm: dict,
) -> RefreshResult:
    """Withings uses a non-standard OAuth2 endpoint with action= parameter.

    Withings always returns HTTP 200; errors are in the JSON body "status" field.
    If the HTTP response itself fails (5xx, timeout), that's a real server error (transient).
    """
    url = "https://wbsapi.withings.net/v2/oauth2"
    data = {
        "action": "requesttoken",
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, data=data)

        # Real HTTP errors (not Withings status codes): these are transient server issues
        if resp.status_code >= 500:
            return RefreshResult(
                error=f"Withings API server error (HTTP {resp.status_code})",
                http_status=resp.status_code,
            )
        if resp.status_code >= 400:
            return RefreshResult(
                permanent=True,
                error=f"Withings API client error (HTTP {resp.status_code})",
                http_status=resp.status_code,
            )

        body = resp.json()
        status_code = body.get("status")

        if status_code == 0:
            tokens = body.get("body", {})
            return RefreshResult(tokens={
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                "expires_in": tokens.get("expires_in"),
            })

        # Classify the Withings error code
        is_permanent = status_code in _WITHINGS_PERMANENT_CODES
        error_desc = body.get("error", "")
        return RefreshResult(
            permanent=is_permanent,
            error=f"Withings token refresh failed: status={status_code} error={error_desc!r}",
            provider_code=status_code,
        )

    except httpx.TimeoutException:
        return RefreshResult(error="Withings token endpoint timed out", http_status=0)
    except httpx.ConnectError:
        return RefreshResult(error="Could not connect to Withings", http_status=0)
    except (ValueError, KeyError) as exc:
        # JSON decode failed or unexpected structure: likely transient
        logger.warning("Withings returned invalid JSON: %s: %s", type(exc).__name__, exc)
        return RefreshResult(error=f"Withings returned invalid JSON response: {type(exc).__name__}")
    except Exception as e:
        return RefreshResult(error=f"Withings token refresh error: {type(e).__name__}: {e}")


# ── Standard OAuth2 error classification (covers Fitbit, Google, generic) ──
# Permanent errors: the refresh token is dead, user must re-authorize
_OAUTH2_PERMANENT_ERRORS = {
    "invalid_grant",          # refresh token expired/revoked (Fitbit, Google, all)
    "unauthorized_client",    # client not authorized for this grant type
    "invalid_client",         # client_id/secret wrong
    "insufficient_scope",     # token lacks required scope (Fitbit), re-auth with correct scope
    "access_denied",          # user denied access
}
# Transient: the error is temporary, worth retrying
# - "temporarily_unavailable" = server overloaded
# - "server_error" = 500 on provider side
# Provider-specific transient signals:
# - Fitbit: HTTP 401 with error_type "expired_token" = just needs refresh (NOT permanent)
# - Fitbit: HTTP 429 = rate limited (150 req/hour), check Fitbit-Rate-Limit-Reset header
# - Google: HTTP 429 = rate limited (60 req/min), retry with backoff
# - Google: HTTP 503 = service unavailable, retry

# Known token URLs per integration type (agent can override via field_mapping.token_url)
_DEFAULT_TOKEN_URLS = {
    "fitbit_body": "https://api.fitbit.com/oauth2/token",
    "google_fit": "https://oauth2.googleapis.com/token",
}


async def _refresh_oauth2_token(
    refresh_token: str,
    client_id: str,
    client_secret: str,
    fm: dict,
) -> RefreshResult:
    """Generic OAuth2 token refresh: works for Fitbit, Google, and any standard provider.

    Uses the standard RFC 6749 token endpoint. The endpoint URL is determined by:
    1. field_mapping["token_url"] (explicit override)
    2. _DEFAULT_TOKEN_URLS[type] (known providers)
    """
    itype = fm.get("type", "")
    token_url = fm.get("token_url") or _DEFAULT_TOKEN_URLS.get(itype)
    if not token_url:
        return RefreshResult(permanent=True, error="No token_url in field_mapping and no default for this type")

    # SSRF guard: re-check immediately before making the request, even though
    # the router validates source_url/token_url at create/update time: the
    # stored value could have been set before this guard existed, or the
    # integration type's default token_url could change.
    # Residual risk: httpx re-resolves the hostname itself when it opens the
    # connection, so a DNS-rebinding attacker who flips the A/AAAA record
    # between this check and httpx's own resolution could still slip through
    # (TOCTOU); this guard blocks static/typical SSRF targets, not rebinding.
    try:
        await assert_public_http_url(token_url, field="field_mapping.token_url")
    except UnsafeURLError as exc:
        return RefreshResult(permanent=True, error=f"Refused to refresh token: {exc}")

    data = {
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(token_url, data=data)

        if resp.status_code == 200:
            body = resp.json()
            return RefreshResult(tokens={
                "access_token": body.get("access_token"),
                "refresh_token": body.get("refresh_token"),
                "expires_in": body.get("expires_in"),
            })

        # ── Classify the error ──
        is_permanent = False
        error_detail = f"HTTP {resp.status_code}"

        # Parse error body (most OAuth2 providers return JSON errors)
        oauth_error = ""
        error_type = ""
        try:
            err_body = resp.json()
            oauth_error = err_body.get("error", "")
            error_type = err_body.get("error_type", "")  # Fitbit-specific
            error_desc = err_body.get("error_description", "")
            error_detail = f"HTTP {resp.status_code}: {oauth_error}"
            if error_desc:
                error_detail += f" ({error_desc})"
        except Exception as exc:
            logger.warning("Could not parse OAuth2 error response body: %s: %s", type(exc).__name__, exc)

        # Check permanent conditions
        if oauth_error in _OAUTH2_PERMANENT_ERRORS:
            is_permanent = True
        elif resp.status_code in (400, 403):
            is_permanent = True  # bad request / forbidden = config error
        elif resp.status_code == 401:
            # HTTP 401 is nuanced:
            # - Fitbit: error_type="expired_token" → transient (just refresh)
            # - Fitbit: error_type="invalid_token" → permanent (revoked)
            # - Google/others: usually means invalid credentials → permanent
            if error_type == "expired_token":
                is_permanent = False  # transient: token just expired
            elif error_type == "invalid_token" or oauth_error in _OAUTH2_PERMANENT_ERRORS:
                is_permanent = True
            else:
                is_permanent = True  # default 401 = permanent

        # HTTP 429 and 5xx are always transient
        elif resp.status_code == 429 or resp.status_code >= 500:
            is_permanent = False

        return RefreshResult(
            permanent=is_permanent,
            error=error_detail,
            http_status=resp.status_code,
        )

    except httpx.TimeoutException:
        return RefreshResult(error="Token endpoint timed out", http_status=0)
    except httpx.ConnectError:
        return RefreshResult(error="Could not connect to token endpoint", http_status=0)
    except Exception as e:
        return RefreshResult(error=f"Token refresh error: {type(e).__name__}")


# ================================================================
# Register vendor adapters
# ================================================================

_TOKEN_REFRESHERS["withings_measure"] = _refresh_withings_token
_FETCHERS["withings_measure"] = _fetch_withings

# Fitbit and Google Fit use the generic OAuth2 refresher (standard RFC 6749)
# with auto-resolved token URLs from _DEFAULT_TOKEN_URLS.
# Their fetchers use the generic JSON adapter until dedicated adapters are added.
_TOKEN_REFRESHERS["fitbit_body"] = _refresh_oauth2_token
_TOKEN_REFRESHERS["google_fit"] = _refresh_oauth2_token

# Garmin uses OAuth 1.0a: tokens don't expire, no refresh needed.
# The _ensure_valid_token check skips refresh when no refresh_token is present.


# ================================================================
# Generic JSON vendor adapter (for future integrations)
# ================================================================

async def _fetch_generic_json(
    db: AsyncSession,
    integration: Integration,
    log: SyncLogger,
) -> list[dict] | None:
    """Fetch from a generic JSON API endpoint.

    Expects the API to return a JSON array of objects, each with a "date" field
    and numeric fields whose keys match the measure_map keys.

    field_mapping should include:
    - "response_path": optional dot-path to the array in the JSON (e.g., "data.records")
    - "date_field": the key for the date (default "date")
    """
    fm = integration.field_mapping or {}
    url = integration.source_url
    headers = {}
    if integration.auth_header:
        headers["Authorization"] = f"Bearer {integration.auth_header}"

    # SSRF guard: re-check immediately before fetching, even though the
    # router validates source_url at create/update time: the stored value
    # could predate this guard, or an integration could have been created
    # before validation was added.
    # Residual risk: httpx re-resolves the hostname itself when it opens the
    # connection, so a DNS-rebinding attacker who flips the A/AAAA record
    # between this check and httpx's own resolution could still slip through
    # (TOCTOU); this guard blocks static/typical SSRF targets, not rebinding.
    try:
        await assert_public_http_url(url, field="source_url")
    except UnsafeURLError as exc:
        msg = f"Refused to fetch: {exc}"
        log.error("ssrf_blocked", detail=msg)
        await _update_status(db, integration, "error", msg, log)
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                log.error("generic_fetch_error", http_status=resp.status_code)
                return None
            body = resp.json()
    except Exception as e:
        log.error("generic_fetch_exception", detail=str(e))
        return None

    # Navigate to the data array
    response_path = fm.get("response_path", "")
    data = body
    if response_path:
        for key in response_path.split("."):
            if isinstance(data, dict):
                data = data.get(key, [])
            else:
                return None

    if not isinstance(data, list):
        return None

    # Parse records
    date_field = fm.get("date_field", "date")
    measure_map = fm.get("measure_map", {})
    records = []
    for item in data:
        date_str = item.get(date_field)
        if not date_str:
            continue
        from datetime import date as date_type
        try:
            d = date_type.fromisoformat(str(date_str)[:10])
        except ValueError:
            continue

        record: dict = {"date": d}
        for source_key in measure_map:
            val = item.get(source_key)
            if val is not None:
                try:
                    record[source_key] = float(val)
                except (ValueError, TypeError):
                    pass
        records.append(record)

    log.info("fetch_ok", records=len(records))
    return records


_FETCHERS["generic_json"] = _fetch_generic_json
_FETCHERS["fitbit_body"] = _fetch_generic_json    # uses generic JSON until dedicated adapter
_FETCHERS["google_fit"] = _fetch_generic_json     # uses generic JSON until dedicated adapter
_FETCHERS["garmin_body"] = _fetch_generic_json    # uses generic JSON until dedicated adapter


# ================================================================
# Scheduler entry point
# ================================================================

async def run_all_syncs():
    """Run sync for all active integrations. Called by the scheduler."""
    async with async_session() as db:
        result = await db.execute(
            select(Integration).where(Integration.status.in_(["active", "error"]))
        )
        integrations = result.scalars().all()

    logger.info(f"[sync_worker] running sync for {len(integrations)} integration(s)")
    for integration in integrations:
        try:
            sync_result = await sync_integration(integration.id)
            logger.info(f"[sync_worker] {integration.name} ({integration.id}): {sync_result}")
        except Exception as e:
            logger.error(f"[sync_worker] {integration.name} ({integration.id}) failed: {e}")
