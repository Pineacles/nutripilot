import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FoodLog(Base):
    __tablename__ = "food_logs"
    __table_args__ = (
        Index("idx_food_logs_user_date", "user_id", "date"),
        Index("idx_food_logs_user_logged_at", "user_id", "logged_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    food_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("foods.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    quantity_g: Mapped[float] = mapped_column(Float, nullable=False)
    # What the user entered: amount in `unit` ("g" or "serving"). quantity_g stays the truth for
    # nutrients; these only show the entry back the way it was typed. NULL (older rows) = grams.
    amount: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(10))
    # Name of the extra serving used ("slice"), NULL for the food's own serving size or grams.
    unit_label: Mapped[str | None] = mapped_column(String(40))
    meal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    food: Mapped["Food"] = relationship(lazy="joined")
