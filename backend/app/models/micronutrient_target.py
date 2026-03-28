import uuid

from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MicronutrientTarget(Base):
    __tablename__ = "micronutrient_targets"
    __table_args__ = (UniqueConstraint("user_id", "nutrient", name="uq_user_nutrient"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    nutrient: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "vitamin_d"
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g. "µg"
