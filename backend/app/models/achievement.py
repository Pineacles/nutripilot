import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Achievement(Base):
    """A print the user earned: one row per (print key, run). `earned_at` is the day the threshold
    was actually reached, so history evaluated after the fact keeps its real dates."""

    __tablename__ = "achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "key", "run", name="uq_achievements_user_key_run"),
        Index("idx_achievements_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    run: Mapped[int] = mapped_column(Integer, nullable=False)
    earned_at: Mapped[date] = mapped_column(Date, nullable=False)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    context: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
