"""Background sync worker for integrations.

Architecture:
- field_mapping on each Integration defines HOW to map external data to NutriPilot fields.
- Vendor-specific code only handles: API calls, auth refresh, response parsing into raw records.
- A generic pipeline reads the mapping and writes data via upsert (idempotent, no duplicates).

field_mapping schema:
{
    "type": "withings_measure" | "generic_json" | ...,
    "source_label": "withings",              # used as source in weight_logs
    "data_type": "weight",                    # what kind of data: weight, food, supplement
    "measure_map": {                          # maps vendor-specific keys → NutriPilot fields
        "1":  "weight_kg",                    # Withings: meastype int → field name
        "6":  "body_fat_pct",
        "8":  "body_fat_kg",
        "76": "muscle_mass_pct"
    },
    // auth fields (vendor-specific, stored alongside)
    "refresh_token": "...",
    "client_id": "...",
    "client_secret": "..."
}
"""
import logging
from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.integration import Integration
from app.services.logging_service import upsert_weight

logger = logging.getLogger(__name__)

# ── NutriPilot weight fields that integrations can write to ──
VALID_WEIGHT_FIELDS = {"weight_kg", "body_fat_pct", "muscle_mass_pct", "body_fat_kg", "muscle_mass_kg"}


# ═══════════════════════════════════════════════════════════════
# Generic pipeline
# ═══════════════════════════════════════════════════════════════

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

        # ── Step 1: Fetch raw records (vendor-specific) ──
        if itype == "withings_measure":
            raw_records = await _fetch_withings(db, integration)
        elif itype == "generic_json":
            raw_records = await _fetch_generic_json(integration)
        else:
            return {"ok": False, "error": f"Unknown integration type: {itype}"}

        if raw_records is None:
            return {"ok": False, "error": "Fetch failed — check integration status"}

        # ── Step 2: Map fields using measure_map from field_mapping ──
        measure_map = fm.get("measure_map", {})
        source_label = fm.get("source_label", integration.name.lower().replace(" ", "_"))
        data_type = fm.get("data_type", "weight")

        # ── Step 3: Write via generic upsert ──
        if data_type == "weight":
            synced = await _write_weight_records(db, integration.user_id, raw_records, measure_map, source_label)
        else:
            await _update_status(db, integration, "error", f"Unsupported data_type: {data_type}")
            return {"ok": False, "error": f"Unsupported data_type: {data_type}"}

        await _update_status(db, integration, "active")
        return {"ok": True, "entries_synced": synced}


async def _write_weight_records(
    db: AsyncSession,
    user_id: UUID,
    raw_records: list[dict],
    measure_map: dict[str, str],
    source_label: str,
) -> int:
    """Generic writer: maps raw records to weight_log fields and upserts.

    Each raw_record has a "date" key and numeric keys (vendor measure type IDs).
    measure_map maps those keys → NutriPilot field names (e.g., "1" → "weight_kg").
    """
    synced = 0
    for record in raw_records:
        entry_date = record.get("date")
        if not entry_date:
            continue

        # Build the NutriPilot field dict from the mapping
        mapped: dict[str, float] = {}
        for vendor_key, nutripilot_field in measure_map.items():
            if nutripilot_field not in VALID_WEIGHT_FIELDS:
                continue  # skip any unknown target fields
            value = record.get(vendor_key)
            if value is not None:
                mapped[nutripilot_field] = value

        if "weight_kg" not in mapped:
            continue  # can't write a weight log without weight

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
        except Exception as e:
            logger.warning(f"[sync] failed to upsert {source_label} entry for {entry_date}: {e}")

    return synced


async def _update_status(db: AsyncSession, integration: Integration, status: str, error_msg: str | None = None):
    """Update integration status and last_synced_at."""
    integration.status = status
    integration.last_synced_at = datetime.now(timezone.utc)
    fm = integration.field_mapping or {}
    if error_msg:
        fm["last_error"] = error_msg
    else:
        fm.pop("last_error", None)
    integration.field_mapping = fm
    await db.commit()


# ═══════════════════════════════════════════════════════════════
# Withings vendor adapter
# ═══════════════════════════════════════════════════════════════

async def _fetch_withings(db: AsyncSession, integration: Integration) -> list[dict] | None:
    """Fetch from Withings API. Returns raw records with vendor measure type IDs as keys."""
    fm = integration.field_mapping or {}
    access_token = integration.auth_header
    refresh_token = fm.get("refresh_token")
    client_id = fm.get("client_id")
    client_secret = fm.get("client_secret")
    measure_map = fm.get("measure_map", {})

    if not access_token:
        await _update_status(db, integration, "error", "No access token")
        return None

    # Build the list of measure types to request from the mapping keys
    requested_types = [int(k) for k in measure_map.keys() if k.isdigit()]
    if not requested_types:
        await _update_status(db, integration, "error", "No measure types in measure_map")
        return None

    # Fetch
    groups = await _call_withings_api(access_token, requested_types, integration.last_synced_at)

    # If failed, try token refresh
    if groups is None and refresh_token and client_id and client_secret:
        logger.info(f"[withings] refreshing token for integration {integration.id}")
        tokens = await _refresh_withings_token(refresh_token, client_id, client_secret)
        if tokens:
            integration.auth_header = tokens["access_token"]
            fm["refresh_token"] = tokens["refresh_token"]
            integration.field_mapping = fm
            await db.commit()
            groups = await _call_withings_api(tokens["access_token"], requested_types, integration.last_synced_at)

    if groups is None:
        await _update_status(db, integration, "error", "API call failed after token refresh")
        return None

    # Parse measuregrps into raw records keyed by vendor measure type ID (as string)
    return _parse_withings_groups(groups, set(requested_types))


async def _call_withings_api(
    access_token: str,
    measure_types: list[int],
    last_synced: datetime | None = None,
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
            body = resp.json()
        if body.get("status") != 0:
            logger.error(f"[withings] getmeas failed: status={body.get('status')}")
            return None
        return body.get("body", {}).get("measuregrps", [])
    except Exception as e:
        logger.error(f"[withings] getmeas error: {e}")
        return None


def _parse_withings_groups(groups: list[dict], accepted_types: set[int]) -> list[dict]:
    """Parse Withings measuregrps into raw records.

    Returns [{date: date, "1": 80.5, "6": 18.2, ...}, ...] where keys are
    vendor measure type IDs as strings — the generic mapper handles the rest.
    """
    from datetime import date as date_type
    by_date: dict[date_type, dict] = defaultdict(dict)

    for grp in groups:
        ts = grp.get("date", 0)
        d = datetime.fromtimestamp(ts, tz=timezone.utc).date()
        for m in grp.get("measures", []):
            mtype = m.get("type")
            if mtype not in accepted_types:
                continue
            value = m.get("value", 0) * (10 ** m.get("unit", 0))
            by_date[d][str(mtype)] = round(value, 3)

    return [{"date": d, **vals} for d, vals in sorted(by_date.items())]


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
            logger.error(f"[withings] token refresh failed: status={body.get('status')}")
            return None
        tokens = body.get("body", {})
        return {
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
        }
    except Exception as e:
        logger.error(f"[withings] token refresh error: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# Generic JSON vendor adapter (for future integrations)
# ═══════════════════════════════════════════════════════════════

async def _fetch_generic_json(integration: Integration) -> list[dict] | None:
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

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.error(f"[generic] HTTP {resp.status_code} from {url}")
                return None
            body = resp.json()
    except Exception as e:
        logger.error(f"[generic] fetch error: {e}")
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

    return records


# ═══════════════════════════════════════════════════════════════
# Scheduler entry point
# ═══════════════════════════════════════════════════════════════

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
