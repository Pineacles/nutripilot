import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Food(Base):
    __tablename__ = "foods"
    __table_args__ = (
        # Trigram GIN index for fuzzy name search (extension + index created in
        # migration 002); declared here so alembic autogenerate knows it is
        # intentional. On SQLite (tests) it degrades to a plain index on name.
        Index(
            "idx_foods_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(50), unique=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    serving_size_g: Mapped[float | None] = mapped_column(Float)
    serving_label: Mapped[str | None] = mapped_column(String(100))
    # NULL = official / curated catalog food (globally read-only). A non-NULL
    # value marks a user-owned food that only its owner may edit or delete.
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    corrected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    corrected_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    nutrients: Mapped["Nutrient"] = relationship(back_populates="food", uselist=False, lazy="joined")
