"""Background sync worker for integrations.

Reads active integrations, calls the appropriate external API,
and writes data into NutriPilot tables. Currently supports Withings.
"""
import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.integration import Integration
from app.services.logging_service import log_weight

logger = logging.getLogger(__name__)

# ── Withings measure type codes ──
WITHINGS_WEIGHT = 1       # kg
WITHINGS_FAT_PCT = 6      # %
WITHINGS_MUSCLE_PCT = 76  # %
WITHINGS_FAT_MASS = 8     # kg
WITHINGS_MUSCLE_MASS = 88 # kg
WITHINGS_BONE_MASS = 77   # kg


async def _refresh_withings_token(
    refresh_token: str,
    client_id: str,
    client_secret: str,
) -> dict | None:
    """Exchange a Withings refresh token for a new access + refresh token pair."""
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
            body = resp.json()
        if body.get("status") != 0:
            logger.error(f"[withings] token refresh failed: status={body.get('status')}, error={body.get('error')}")
            return None
        tokens = body.get("body", {})
        return {
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
        }
    except Exception as e:
        logger.error(f"[withings] token refresh error: {e}")
        return None


async def _fetch_withings_measures(
    access_token: str,
    last_synced: datetime | None = None,
) -> list[dict] | None:
    """Fetch weight/body comp measures from Withings Measure API."""
    url = "https://wbsapi.withings.net/measure"
    params: dict = {
        "action": "getmeas",
        "meastype": ",".join(str(t) for t in [
            WITHINGS_WEIGHT, WITHINGS_FAT_PCT, WITHINGS_MUSCLE_PCT,
            WITHINGS_FAT_MASS, WITHINGS_MUSCLE_MASS,
        ]),
        "category": 1,  # real measures only
    }
    if last_synced:
        params["lastupdate"] = int(last_synced.timestamp())

    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, data=params, headers=headers)
            body = resp.json()
        if body.get("status") != 0:
            logger.error(f"[withings] getmeas failed: status={body.get('status')}")
            return None
        return body.get("body", {}).get("measuregrps", [])
    except Exception as e:
        logger.error(f"[withings] getmeas error: {e}")
        return None


def _parse_withings_measuregrps(groups: list[dict]) -> list[dict]:
    """Parse Withings measuregrps into a list of {date, weight_kg, body_fat_pct, ...}."""
    from datetime import date as date_type
    from collections import defaultdict

    # Group measures by date
    by_date: dict[date_type, dict] = defaultdict(dict)

    for grp in groups:
        ts = grp.get("date", 0)
        d = datetime.fromtimestamp(ts, tz=timezone.utc).date()
        measures = grp.get("measures", [])
        for m in measures:
            mtype = m.get("type")
            # Withings stores value * 10^unit (e.g., 80123 with unit=-3 = 80.123)
            value = m.get("value", 0) * (10 ** m.get("unit", 0))
            if mtype == WITHINGS_WEIGHT:
                by_date[d]["weight_kg"] = round(value, 3)
            elif mtype == WITHINGS_FAT_PCT:
                by_date[d]["body_fat_pct"] = round(value, 2)
            elif mtype == WITHINGS_MUSCLE_PCT:
                by_date[d]["muscle_mass_pct"] = round(value, 2)
            elif mtype == WITHINGS_FAT_MASS:
                by_date[d]["body_fat_kg"] = round(value, 3)
            elif mtype == WITHINGS_MUSCLE_MASS:
                by_date[d]["muscle_mass_kg"] = round(value, 3)

    result = []
    for d, vals in sorted(by_date.items()):
        if "weight_kg" not in vals:
            continue  # skip entries without weight
        result.append({"date": d, **vals})
    return result


async def sync_integration(integration_id: UUID) -> dict:
    """Sync a single integration. Returns a status dict."""
    async with async_session() as db:
        result = await db.execute(
            select(Integration).where(Integration.id == integration_id)
        )
        integration = result.scalar_one_or_none()
        if not integration:
            return {"ok": False, "error": "Integration not found"}

        fm = integration.field_mapping or {}
        itype = fm.get("type", "")

        if itype == "withings_measure":
            return await _sync_withings(db, integration)
        else:
            return {"ok": False, "error": f"Unknown integration type: {itype}"}


async def _sync_withings(db: AsyncSession, integration: Integration) -> dict:
    """Sync a Withings measure integration."""
    fm = integration.field_mapping or {}
    access_token = integration.auth_header
    refresh_token = fm.get("refresh_token")
    client_id = fm.get("client_id")
    client_secret = fm.get("client_secret")

    if not access_token:
        await _update_status(db, integration, "error", "No access token")
        return {"ok": False, "error": "No access token"}

    # Try to fetch measures
    groups = await _fetch_withings_measures(access_token, integration.last_synced_at)

    # If failed, try token refresh
    if groups is None and refresh_token and client_id and client_secret:
        logger.info(f"[withings] refreshing token for integration {integration.id}")
        tokens = await _refresh_withings_token(refresh_token, client_id, client_secret)
        if tokens:
            # Update stored tokens
            integration.auth_header = tokens["access_token"]
            fm["refresh_token"] = tokens["refresh_token"]
            integration.field_mapping = fm
            await db.commit()

            # Retry fetch
            groups = await _fetch_withings_measures(tokens["access_token"], integration.last_synced_at)

    if groups is None:
        await _update_status(db, integration, "error", "API call failed after token refresh")
        return {"ok": False, "error": "API call failed"}

    # Parse and write weight logs
    entries = _parse_withings_measuregrps(groups)
    created = 0
    for entry in entries:
        try:
            await log_weight(
                db=db,
                user_id=integration.user_id,
                weight_kg=entry["weight_kg"],
                body_fat_pct=entry.get("body_fat_pct"),
                muscle_mass_pct=entry.get("muscle_mass_pct"),
                body_fat_kg=entry.get("body_fat_kg"),
                muscle_mass_kg=entry.get("muscle_mass_kg"),
                source="withings",
                log_date=entry["date"],
            )
            created += 1
        except Exception as e:
            logger.warning(f"[withings] failed to log entry for {entry['date']}: {e}")

    await _update_status(db, integration, "active")
    logger.info(f"[withings] synced {created} entries for integration {integration.id}")
    return {"ok": True, "entries_synced": created}


async def _update_status(db: AsyncSession, integration: Integration, status: str, error_msg: str | None = None):
    """Update integration status and last_synced_at."""
    integration.status = status
    integration.last_synced_at = datetime.now(timezone.utc)
    if error_msg:
        fm = integration.field_mapping or {}
        fm["last_error"] = error_msg
        integration.field_mapping = fm
    await db.commit()


async def run_all_syncs():
    """Run sync for all active integrations. Called by the scheduler."""
    async with async_session() as db:
        result = await db.execute(
            select(Integration).where(Integration.status == "active")
        )
        integrations = result.scalars().all()

    logger.info(f"[sync_worker] running sync for {len(integrations)} active integrations")
    for integration in integrations:
        try:
            result = await sync_integration(integration.id)
            logger.info(f"[sync_worker] {integration.name} ({integration.id}): {result}")
        except Exception as e:
            logger.error(f"[sync_worker] {integration.name} ({integration.id}) failed: {e}")
