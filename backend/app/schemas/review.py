import datetime

from pydantic import BaseModel


class ReviewDay(BaseModel):
    date: datetime.date
    weekday: str
    logged: bool
    kcal: float | None = None
    protein_g: float | None = None
    fiber_g: float | None = None
    # The day's weigh-in (average when weighed several times), null on days without one.
    weight_kg: float | None = None
    in_kcal_window: bool
    protein_met: bool
    fiber_met: bool


class ReviewTargets(BaseModel):
    kcal: int
    protein_g: float
    fiber_g: float
    safe_floor_kcal: int


class ReviewIntake(BaseModel):
    logged_days: int
    # Logged days with at least the calorie window floor; the averages use only these.
    full_days: int
    avg_kcal: float | None = None
    avg_protein_g: float | None = None
    avg_fiber_g: float | None = None
    weekday_avg_kcal: float | None = None
    weekend_avg_kcal: float | None = None
    kcal_window_days: int
    protein_met_days: int
    fiber_met_days: int


class ReviewPrevious(BaseModel):
    logged_days: int
    avg_kcal: float | None = None
    avg_protein_g: float | None = None


class ReviewWeight(BaseModel):
    weigh_in_days: int
    trend_start_kg: float | None = None
    trend_end_kg: float | None = None
    trend_change_kg: float | None = None
    rate_kg_per_week: float | None = None
    rate_pct_per_week: float | None = None
    target_weight_kg: float | None = None


class MicronutrientGap(BaseModel):
    nutrient: str
    avg: float
    target: float
    unit: str


class ReviewFlag(BaseModel):
    code: str
    detail: str


class WeekReview(BaseModel):
    start: datetime.date
    end: datetime.date
    days: list[ReviewDay]
    targets: ReviewTargets
    intake: ReviewIntake
    previous_week: ReviewPrevious
    weight: ReviewWeight
    micronutrient_gaps: list[MicronutrientGap]
    flags: list[ReviewFlag]
