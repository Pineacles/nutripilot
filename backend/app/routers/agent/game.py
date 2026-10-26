from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.game import AgentGameSummary
from app.services import game_service

router = APIRouter()


@router.get(
    "/game/summary",
    response_model=AgentGameSummary,
    summary="Streak, day goals, weekly quests and recent prints",
    description=(
        "A short read of the user's game state, for encouragement like '2 days to your 30 day print':\n\n"
        "- **streak_current / streak_longest / freezes_banked / next_milestone**\n"
        "- **day_goals**: today's chosen goals with value, target and done\n"
        "- **quests**: this week's quests with progress\n"
        "- **recent_prints**: the last 5 prints earned\n"
        "- **window_days_this_week**: days this week at or under the kcal target and not below 1000 kcal (null without a target)\n\n"
        "Nothing is ever marked as seen by this call."
    ),
)
async def game_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return game_service.agent_summary(await game_service.evaluate(db, user))
