import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.services.crypto import EncryptedJSON, EncryptedStr


class Integration(Base):
    """An external data source (smart scale, JSON API) synced into NutriPilot.

    ``auth_header`` (the OAuth access token / API key) and ``field_mapping``
    (which carries refresh_token / client_secret / consumer_secret / oauth_token
    / etc.) are ENCRYPTED AT REST via the EncryptedStr / EncryptedJSON types —
    all reads/writes, including the sync worker's token refresh write-back, go
    through the ORM and are therefore transparently encrypted/decrypted.

    Operational note: encryption uses ``settings.token_encryption_key``. If that
    key is lost, every integration's credentials become unrecoverable and each
    integration must be re-authorized from scratch.
    """

    __tablename__ = "integrations"
    __table_args__ = (Index("idx_integrations_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    source_url: Mapped[str] = mapped_column(String(500), nullable=False)
    auth_header: Mapped[str | None] = mapped_column(EncryptedStr)  # encrypted access token/key
    schedule: Mapped[str] = mapped_column(String(50), nullable=False, default="0 6 * * *")  # cron
    field_mapping: Mapped[dict | None] = mapped_column(
        MutableDict.as_mutable(EncryptedJSON)  # encrypted; maps source fields to NutriPilot fields
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active, error, paused
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
