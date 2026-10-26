import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

DAY_GOAL_KEYS = ("meals", "protein", "water", "fiber", "supplements")
CELEBRATIONS = ("full", "quiet", "off")


class StripDay(BaseModel):
    date: datetime.date
    state: Literal["logged", "freeze", "empty", "pending"]


class StreakOut(BaseModel):
    current: int
    longest: int
    freezes_banked: int
    freezes_max: int
    today_logged: bool
    next_milestone: int
    strip: list[StripDay]


class DayGoalOut(BaseModel):
    key: str
    label: str
    target: float
    value: float
    unit: Literal["meals", "g", "ml", "taken"]
    done: bool


class AvailableGoal(BaseModel):
    key: str
    label: str
    default_target: Optional[float] = None


class SeriesPoint(BaseModel):
    date: datetime.date
    raw: Optional[float] = None
    trend: float


class WeightOut(BaseModel):
    trend_kg: float
    raw_kg: float
    raw_date: datetime.date
    trend_change_7d: Optional[float] = None
    trend_change_28d: Optional[float] = None
    goal_kg: Optional[float] = None
    direction: Optional[Literal["down", "up", "reached"]] = None
    eta_date: Optional[datetime.date] = None
    weigh_in_weeks_current: int
    weigh_in_weeks_longest: int
    this_week_weigh_ins: int
    is_trend_low: bool
    series: list[SeriesPoint]


class PrintRun(BaseModel):
    run: int
    threshold: float
    earned_at: Optional[datetime.date] = None


class PrintProgress(BaseModel):
    value: float
    next_threshold: Optional[float] = None


class PrintOut(BaseModel):
    key: str
    area: str
    title: str
    description: str
    hidden: bool
    unit: str
    runs: list[PrintRun]
    progress: Optional[PrintProgress] = None


class UnseenOut(BaseModel):
    kind: Literal["print", "quest", "freeze", "comeback"]
    id: Optional[str] = None
    key: str
    run: Optional[int] = None
    title: str
    description: str
    area: Optional[str] = None
    date: datetime.date
    big: bool
    backfill: bool


class QuestOut(BaseModel):
    id: UUID
    key: str
    title: str
    target: int
    progress: int
    done: bool
    area: str


class QuestsOut(BaseModel):
    week_start: datetime.date
    swap_available: bool
    items: list[QuestOut]


class YearDay(BaseModel):
    date: datetime.date
    level: int


class GameState(BaseModel):
    enabled: bool
    show_streak: bool
    celebrations: Literal["full", "quiet", "off"]
    today: datetime.date
    streak: StreakOut
    day_goals: list[DayGoalOut]
    day_closed: bool
    available_goals: list[AvailableGoal]
    weight: Optional[WeightOut] = None
    prints: list[PrintOut]
    unseen: list[UnseenOut]
    quests: QuestsOut
    year: list[YearDay]
    recap_available: Optional[datetime.date] = None


class SeenPrint(BaseModel):
    key: str = Field(max_length=40)
    run: int


class SeenBody(BaseModel):
    prints: list[SeenPrint] = []
    quests: list[UUID] = []
    freezes_through: Optional[datetime.date] = None
    comeback_through: Optional[datetime.date] = None
    all: bool = False


class RecapQuest(BaseModel):
    key: str
    title: str
    target: int
    progress: int
    done: bool


class RecapPrint(BaseModel):
    key: str
    run: int
    title: str
    area: str


class DayValue(BaseModel):
    date: datetime.date
    value: float


class RecapDay(BaseModel):
    date: datetime.date
    logged: bool
    closed: bool


class Recap(BaseModel):
    week_start: datetime.date
    logged_days: int
    closed_days: Optional[int] = None
    quests: list[RecapQuest]
    prints: list[RecapPrint]
    trend_start: Optional[float] = None
    trend_end: Optional[float] = None
    trend_change: Optional[float] = None
    weigh_in_days: int
    best_protein_day: Optional[DayValue] = None
    most_varied_day: Optional[DayValue] = None
    distinct_foods: int
    water_target_days: Optional[int] = None
    streak_at_end: int
    trend_toward_goal: Optional[bool] = None
    days: list[RecapDay] = []


class RecapSeenBody(BaseModel):
    week: datetime.date


class GoalSetting(BaseModel):
    key: str
    target: Optional[float] = Field(default=None, ge=1, le=12)

    @field_validator("key")
    @classmethod
    def known_key(cls, value: str) -> str:
        if value not in DAY_GOAL_KEYS:
            raise ValueError(f"unknown day goal {value!r}, use one of: {', '.join(DAY_GOAL_KEYS)}")
        return value


class GameSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    show_streak: Optional[bool] = None
    celebrations: Optional[Literal["full", "quiet", "off"]] = None
    day_goals: Optional[list[GoalSetting]] = Field(default=None, max_length=3)

    @field_validator("day_goals")
    @classmethod
    def no_duplicates(cls, value):
        if value is not None:
            keys = [g.key for g in value]
            if len(keys) != len(set(keys)):
                raise ValueError("each day goal can only be chosen once")
        return value


class GameSettingsOut(BaseModel):
    enabled: bool
    show_streak: bool
    celebrations: Literal["full", "quiet", "off"]


class GameSettingsResponse(BaseModel):
    game_settings: GameSettingsOut
    day_goals: list[GoalSetting]


class AgentPrint(BaseModel):
    key: str
    run: int
    title: str
    earned_at: datetime.date


class AgentGameSummary(BaseModel):
    streak_current: int
    streak_longest: int
    freezes_banked: int
    next_milestone: int
    day_goals: list[DayGoalOut]
    quests: list[QuestOut]
    recent_prints: list[AgentPrint]
