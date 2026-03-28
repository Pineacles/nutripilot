import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100))
    target_kcal: Mapped[int] = mapped_column(Integer, default=2000)
    target_protein_g: Mapped[float] = mapped_column(Float, default=150.0)
    target_carbs_g: Mapped[float] = mapped_column(Float, default=250.0)
    target_fat_g: Mapped[float] = mapped_column(Float, default=70.0)
    target_fiber_g: Mapped[float] = mapped_column(Float, default=30.0)
    target_sugar_g: Mapped[float] = mapped_column(Float, default=50.0)
    target_sodium_mg: Mapped[float] = mapped_column(Float, default=2300.0)
    target_weight_kg: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
