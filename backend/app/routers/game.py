from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt
from app.database import get_db
from app.models.user import User
from app.schemas.game import (
    DayCountsBody,
    GameState,
    QuestOut,
    Recap,
    RecapSeenBody,
    SeenBody,
    StreakRestartBody,
    StreakRestartOut,
)
from app.services import game_service

router = APIRouter(prefix="/api/dashboard/game", tags=["game"])


@router.get("", response_model=GameState)
async def get_game(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    ev = await game_service.evaluate(db, user)
    return game_service.build_game_response(ev)


@router.post("/seen", status_code=status.HTTP_204_NO_CONTENT)
async def post_seen(
    body: SeenBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    await game_service.mark_seen(db, user, body)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/quests/{quest_id}/swap", response_model=QuestOut)
async def swap_quest(
    quest_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await game_service.swap_quest(db, user, quest_id)


@router.get("/recap", response_model=Recap)
async def get_recap(
    week: date | None = Query(None, description="Any date in the week (default: last complete week)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    ev = await game_service.evaluate(db, user)
    return game_service.build_recap(ev, week)


@router.post("/recap/seen", status_code=status.HTTP_204_NO_CONTENT)
async def post_recap_seen(
    body: RecapSeenBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    await game_service.mark_recap_seen(db, user, body.week)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/streak", response_model=StreakRestartOut)
async def put_streak_restart(
    body: StreakRestartBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    """Restart the streak from a day, or clear the restart (Undo) with null."""
    previous = await game_service.set_streak_restart(db, user, body.restart_from)
    return {"restart_from": body.restart_from, "previous": previous}


@router.put("/days/{day}", status_code=status.HTTP_204_NO_CONTENT)
async def put_day_counts(
    day: date,
    body: DayCountsBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    """Whether a day counts for the streak; off when food was missing from that day's log."""
    await game_service.set_day_counts(db, user, day, body.counts)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
