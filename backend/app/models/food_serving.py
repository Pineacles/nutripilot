import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FoodServing(Base):
    """An extra named portion a user added to a food ("slice" = 30 g), on top of the food's
    own serving size. Personal, so anyone can add units to official foods without editing them."""

    __tablename__ = "food_servings"
    __table_args__ = (UniqueConstraint("user_id", "food_id", "label", name="uq_food_servings_user_food_label"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    food_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("foods.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(40), nullable=False)
    grams: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
