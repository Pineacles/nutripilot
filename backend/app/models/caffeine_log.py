import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CaffeineLog(Base):
    __tablename__ = "caffeine_logs"
    __table_args__ = (Index("idx_caffeine_logs_user_date", "user_id", "date"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    amount_mg: Mapped[float] = mapped_column(Float, nullable=False)
    source_name: Mapped[str | None] = mapped_column(String(100))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
