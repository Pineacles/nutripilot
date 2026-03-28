import uuid

from sqlalchemy import Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Nutrient(Base):
    __tablename__ = "nutrients"

    food_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("foods.id", ondelete="CASCADE"), primary_key=True
    )
    kcal: Mapped[float | None] = mapped_column(Float)
    protein: Mapped[float | None] = mapped_column(Float)
    carbs: Mapped[float | None] = mapped_column(Float)
    sugar: Mapped[float | None] = mapped_column(Float)
    fiber: Mapped[float | None] = mapped_column(Float)
    fat: Mapped[float | None] = mapped_column(Float)
    sat_fat: Mapped[float | None] = mapped_column(Float)
    salt: Mapped[float | None] = mapped_column(Float)
    calcium: Mapped[float | None] = mapped_column(Float)
    potassium: Mapped[float | None] = mapped_column(Float)
    omega3: Mapped[float | None] = mapped_column(Float)
    zinc: Mapped[float | None] = mapped_column(Float)
    vit_d: Mapped[float | None] = mapped_column(Float)
    vit_k2: Mapped[float | None] = mapped_column(Float)
    vit_c: Mapped[float | None] = mapped_column(Float)
    magnesium: Mapped[float | None] = mapped_column(Float)
    b12: Mapped[float | None] = mapped_column(Float)
    iron: Mapped[float | None] = mapped_column(Float)

    food: Mapped["Food"] = relationship(back_populates="nutrients")
