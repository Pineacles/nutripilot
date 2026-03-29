import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Integration(Base):
    __tablename__ = "integrations"
    __table_args__ = (Index("idx_integrations_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    source_url: Mapped[str] = mapped_column(String(500), nullable=False)
    auth_header: Mapped[str | None] = mapped_column(String(1000))  # encrypted token/key
    schedule: Mapped[str] = mapped_column(String(50), nullable=False, default="0 6 * * *")  # cron
    field_mapping: Mapped[dict | None] = mapped_column(JSON)  # maps source fields to NutriPilot fields
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active, error, paused
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
