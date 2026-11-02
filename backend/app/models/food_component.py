import uuid

from sqlalchemy import Float, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FoodComponent(Base):
    """One part of a dish: a dish is a Food (source 'dish') whose nutrients are computed from
    these rows. A component food cannot be deleted while a dish uses it."""

    __tablename__ = "food_components"
    __table_args__ = (
        Index("idx_food_components_food", "food_id"),
        Index("idx_food_components_component", "component_food_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    food_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("foods.id", ondelete="CASCADE"), nullable=False)
    component_food_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("foods.id", ondelete="RESTRICT"), nullable=False
    )
    quantity_g: Mapped[float] = mapped_column(Float, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
