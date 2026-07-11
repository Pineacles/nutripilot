from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.integration import Integration
from app.models.user import User
from app.schemas.integration import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationUpdate,
    REDACTED_SENTINEL,
    validate_field_mapping,
)
from app.services.url_guard import UnsafeURLError, assert_public_http_url

router = APIRouter()


async def _validate_integration_urls(source_url: str | None, field_mapping: dict | None) -> None:
    """SSRF guard for integration source_url and field_mapping.token_url.

    Raises HTTPException(422) with a clear detail if either URL resolves to
    a non-public address.
    """
    if source_url:
        try:
            await assert_public_http_url(source_url, field="source_url")
        except UnsafeURLError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    token_url = (field_mapping or {}).get("token_url")
    if token_url:
        try:
            await assert_public_http_url(token_url, field="field_mapping.token_url")
        except UnsafeURLError as exc:
            raise HTTPException(status_code=422, detail=str(exc))


@router.get(
    "/integrations",
    response_model=list[IntegrationResponse],
    summary="List integrations",
    description=(
        "Get all configured integrations (smart scales, external APIs). Sorted by newest first.\n\n"
        "Check the `status` field: `active` = working, `error` = temporary failure (will retry), "
        "`needs_reauth` = tokens expired (user must re-authorize), `paused` = manually paused.\n\n"
        "To fetch latest data from a scale, use `POST /api/agent/integrations/{id}/sync`."
    ),
)
async def agent_list_integrations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.user_id == user.id).order_by(Integration.created_at.desc())
    )
    return [IntegrationResponse.model_validate(i) for i in result.scalars().all()]


@router.post(
    "/integrations",
    response_model=IntegrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create integration (connect a smart scale or API)",
    description=(
        "Connect an external data source. The `field_mapping` object tells the sync worker how to map vendor data to NutriPilot fields.\n\n"
        "**Supported types:** `withings_measure`, `fitbit_body`, `google_fit`, `garmin_body`, `generic_json`.\n\n"
        "See the `field_mapping` field schema for complete documentation on each integration type, "
        "including OAuth flows, required keys, measure_map values, error codes, and rate limits.\n\n"
        "**WARNING:** After creating an integration, NEVER call the provider's API directly. "
        "Use `POST /api/agent/integrations/{id}/sync` to fetch data. Calling provider APIs directly "
        "will consume OAuth refresh tokens and permanently break the integration."
    ),
)
async def agent_create_integration(
    body: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    await _validate_integration_urls(body.source_url, body.field_mapping)
    integration = Integration(
        user_id=user.id,
        name=body.name,
        source_url=body.source_url,
        auth_header=body.auth_header,
        schedule=body.schedule,
        field_mapping=body.field_mapping,
        status="active",
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return IntegrationResponse.model_validate(integration)


@router.patch(
    "/integrations/{integration_id}",
    response_model=IntegrationResponse,
    summary="Update integration",
    description=(
        "Update any field on an integration. Only send the fields you want to change.\n\n"
        "**status** can be set to `active`, `paused`, or `error`."
    ),
)
async def agent_update_integration(
    integration_id: UUID,
    body: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail={"code": "INTEGRATION_NOT_FOUND"})
    updates = body.model_dump(exclude_unset=True)
    # If the caller sends a field_mapping that contains REDACTED_SENTINEL values,
    # keep the existing (stored) secret values rather than overwriting them.
    if "field_mapping" in updates and updates["field_mapping"] is not None:
        existing_fm = integration.field_mapping or {}
        merged = dict(existing_fm)
        for k, v in updates["field_mapping"].items():
            if v == REDACTED_SENTINEL:
                # Caller is echoing back our redaction — preserve stored secret
                pass
            else:
                merged[k] = v
        updates["field_mapping"] = merged

        # Validate the MERGED mapping (same rules as IntegrationCreate).
        # Must run on the merged result, not the raw PATCH body — a partial
        # update may only send one changed key while relying on stored
        # values (including sentinel-preserved secrets) for the rest.
        errors = validate_field_mapping(merged)
        if errors:
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_FIELD_MAPPING", "errors": errors},
            )

    # SSRF guard on the merged result (source_url may come from this PATCH
    # or, if unset, from the already-stored integration).
    merged_source_url = updates.get("source_url", integration.source_url)
    merged_field_mapping = updates.get("field_mapping", integration.field_mapping)
    await _validate_integration_urls(merged_source_url, merged_field_mapping)

    for field, value in updates.items():
        setattr(integration, field, value)
    await db.commit()
    await db.refresh(integration)
    return IntegrationResponse.model_validate(integration)


@router.delete(
    "/integrations/{integration_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete integration",
    description="Permanently remove an integration. Past weight logs synced by this integration are NOT deleted.",
)
async def agent_delete_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail={"code": "INTEGRATION_NOT_FOUND"})
    await db.delete(integration)
    await db.commit()


@router.post(
    "/integrations/{integration_id}/sync",
    summary="Trigger manual sync (fetch latest data from scale/device)",
    description=(
        "Manually trigger a data sync for an integration right now. "
        "This is the **correct way** to fetch the latest data from Withings, Fitbit, Google Fit, Garmin, etc.\n\n"
        "**IMPORTANT: Never call external provider APIs (Withings, Fitbit, etc.) directly.** "
        "Doing so will consume OAuth tokens and permanently break the integration. "
        "Always use this endpoint instead — it safely handles token refresh, API calls, "
        "and data storage in one atomic operation.\n\n"
        "**When to use:**\n"
        "- User says 'sync my scale', 'get my latest weight', 'fetch data from Withings'\n"
        "- User wants to see recent weigh-in data that hasn't been synced yet\n"
        "- After setting up a new integration to pull initial data\n\n"
        "**Returns** `{ok: true, entries_synced: N}` on success.\n\n"
        "**Errors:**\n"
        "- `404 INTEGRATION_NOT_FOUND` — wrong ID or not owned by this user\n"
        "- `502 SYNC_FAILED` — sync failed (check error details). If `needs_reauth`, "
        "the user must re-authorize through the provider's OAuth flow to get fresh tokens."
    ),
)
async def agent_sync_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    from app.services.sync_worker import sync_integration

    # Verify ownership
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail={"code": "INTEGRATION_NOT_FOUND"})

    sync_result = await sync_integration(integration_id)
    if not sync_result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail={"code": "SYNC_FAILED", "error": sync_result.get("error", "Unknown error")},
        )
    return sync_result
