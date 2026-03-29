import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class IntegrationResponse(BaseModel):
    id: UUID
    name: str
    source_url: str
    schedule: str
    field_mapping: dict | None = None
    last_synced_at: datetime.datetime | None = None
    status: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class IntegrationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    source_url: str = Field(min_length=1, max_length=500)
    auth_header: Optional[str] = Field(default=None, max_length=1000)
    schedule: str = Field(default="0 6 * * *", max_length=50)
    field_mapping: Optional[dict] = None


class IntegrationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    source_url: Optional[str] = Field(default=None, min_length=1, max_length=500)
    auth_header: Optional[str] = Field(default=None, max_length=1000)
    schedule: Optional[str] = Field(default=None, max_length=50)
    field_mapping: Optional[dict] = None
    status: Optional[str] = Field(default=None, pattern="^(active|error|paused)$")
