import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WeeklyQuest(Base):
    """One of the three quests of an ISO week (week_start is the Monday). Progress is never stored,
    it is recomputed from the logs; only the day the target was reached is."""

    __tablename__ = "weekly_quests"
    __table_args__ = (
        UniqueConstraint("user_id", "week_start", "key", name="uq_weekly_quests_user_week_key"),
        Index("idx_weekly_quests_user_week", "user_id", "week_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    target: Mapped[int] = mapped_column(Integer, nullable=False)
    done_at: Mapped[date | None] = mapped_column(Date)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    swapped: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
