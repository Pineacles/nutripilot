import datetime

from pydantic import BaseModel


class TrendPoint(BaseModel):
    date: datetime.date
    # The day's weigh-in (average when weighed several times), null on days without one.
    weight_kg: float | None = None
    trend_kg: float


class IntakeStats(BaseModel):
    days_logged: int
    avg_kcal: float | None = None
    avg_protein_g: float | None = None


class ProgressTargets(BaseModel):
    target_kcal: int | None = None
    target_protein_g: float | None = None
    target_weight_kg: float | None = None


class ProgressResponse(BaseModel):
    days: int
    trend: list[TrendPoint]
    latest_trend_kg: float | None = None
    rate_kg_per_week: float | None = None
    rate_pct_per_week: float | None = None
    intake: IntakeStats
    tdee_estimate_kcal: float | None = None
    tdee_confidence: str | None = None
    bmr_kcal: float | None = None
    maintenance_from_profile: float | None = None
    safe_floor_kcal: float
    targets: ProgressTargets
    protein_per_kg: float | None = None
