"""Agent-facing API router: `/api/agent/*`.

This used to be a single ~1250-line module. It is now a package split by
domain, with each submodule owning a prefix-less APIRouter. This __init__
assembles them onto one APIRouter(prefix="/api/agent") so `app.main` can keep
doing `app.include_router(agent.router)` unchanged.
"""

from fastapi import APIRouter

from app.routers.agent import (
    food_logs,
    integrations,
    settings_mirror,
    summaries,
    supplements,
    water_caffeine,
    weight_logs,
)

router = APIRouter(prefix="/api/agent", tags=["agent"])

router.include_router(food_logs.router)
router.include_router(weight_logs.router)
router.include_router(water_caffeine.router)
router.include_router(supplements.router)
router.include_router(integrations.router)
router.include_router(settings_mirror.router)
router.include_router(summaries.router)
