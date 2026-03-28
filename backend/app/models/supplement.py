import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Supplement(Base):
    __tablename__ = "supplements"
    __table_args__ = (Index("idx_supplements_user_date", "user_id", "date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dose_amount: Mapped[float] = mapped_column(Float, nullable=False)
    dose_unit: Mapped[str] = mapped_column(String(10), nullable=False, default="g")
    time_of_day: Mapped[str | None] = mapped_column(String(20))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
