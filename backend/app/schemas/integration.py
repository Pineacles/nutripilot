import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

# ── Supported integration types and their required fields ──

INTEGRATION_TYPES = {
    "withings_measure": {
        "description": "Withings smart scale (Body, Body+, Body Cardio). Syncs weight and body composition.",
        "required_fm_keys": {"refresh_token", "client_id", "client_secret", "measure_map"},
        "required_top_keys": {"auth_header"},
        "valid_measure_targets": {"weight_kg", "body_fat_pct", "muscle_mass_pct", "body_fat_kg", "muscle_mass_kg"},
        "example_measure_map": {"1": "weight_kg", "6": "body_fat_pct", "8": "body_fat_kg", "76": "muscle_mass_pct"},
        "withings_measure_types": {
            "1": "weight_kg",
            "6": "body_fat_pct (ratio 0-100)",
            "8": "body_fat_kg",
            "76": "muscle_mass_pct (ratio 0-100)",
            "77": "muscle_mass_kg (use target muscle_mass_kg)",
        },
    },
    "generic_json": {
        "description": "Any JSON API that returns an array of records with a date field and numeric fields.",
        "required_fm_keys": {"measure_map"},
        "required_top_keys": set(),
        "valid_measure_targets": {"weight_kg", "body_fat_pct", "muscle_mass_pct", "body_fat_kg", "muscle_mass_kg"},
        "example_measure_map": {"weight": "weight_kg", "fat_percentage": "body_fat_pct"},
    },
}

_FIELD_MAPPING_DESCRIPTION = """\
Configuration object that tells the sync worker how to map external API data to NutriPilot fields.

**Required keys for all types:**
- `type` (str): Integration type. One of: `withings_measure`, `generic_json`.
- `measure_map` (object): Maps vendor field keys to NutriPilot field names.
- `source_label` (str): Label for the data source (e.g. "withings"). Used in weight logs.
- `data_type` (str): What kind of data to sync. Currently only "weight" is supported.

**For `withings_measure`:**
- `refresh_token` (str): OAuth2 refresh token from Withings authorization flow.
- `client_id` (str): Withings OAuth2 client ID.
- `client_secret` (str): Withings OAuth2 client secret.
- `measure_map`: Keys are Withings measure type IDs (as strings), values are NutriPilot field names.
  - Withings type "1" → "weight_kg"
  - Withings type "6" → "body_fat_pct"
  - Withings type "8" → "body_fat_kg"
  - Withings type "76" → "muscle_mass_pct"
- The `auth_header` top-level field must contain the initial OAuth2 access token.

**For `generic_json`:**
- `response_path` (str, optional): Dot-path to the data array in the response (e.g. "data.records").
- `date_field` (str, optional): Key name for the date field in each record. Default: "date".
- `measure_map`: Keys are the source JSON field names, values are NutriPilot field names.

**Valid NutriPilot target fields for measure_map values:**
`weight_kg`, `body_fat_pct`, `muscle_mass_pct`, `body_fat_kg`, `muscle_mass_kg`

**Do NOT invent custom field names.** Only use the target field names listed above as measure_map values.\
"""

_FIELD_MAPPING_EXAMPLES = {
    "withings_measure": {
        "type": "withings_measure",
        "source_label": "withings",
        "data_type": "weight",
        "measure_map": {"1": "weight_kg", "6": "body_fat_pct", "8": "body_fat_kg", "76": "muscle_mass_pct"},
        "refresh_token": "<from_oauth_flow>",
        "client_id": "<your_withings_client_id>",
        "client_secret": "<your_withings_client_secret>",
    },
    "generic_json": {
        "type": "generic_json",
        "source_label": "my_scale_api",
        "data_type": "weight",
        "measure_map": {"weight": "weight_kg", "fat_percentage": "body_fat_pct"},
        "response_path": "data.records",
        "date_field": "recorded_at",
    },
}

_VALID_MEASURE_TARGETS = {"weight_kg", "body_fat_pct", "muscle_mass_pct", "body_fat_kg", "muscle_mass_kg"}


def _validate_field_mapping(fm: dict) -> list[str]:
    """Validate field_mapping and return a list of error messages (empty = valid)."""
    errors: list[str] = []

    itype = fm.get("type")
    if not itype:
        errors.append("field_mapping.type is required. Must be one of: " + ", ".join(sorted(INTEGRATION_TYPES)))
        return errors

    if itype not in INTEGRATION_TYPES:
        errors.append(f"field_mapping.type '{itype}' is not supported. Must be one of: " + ", ".join(sorted(INTEGRATION_TYPES)))
        return errors

    spec = INTEGRATION_TYPES[itype]

    # Check required keys
    for key in spec["required_fm_keys"]:
        if not fm.get(key):
            errors.append(f"field_mapping.{key} is required for type '{itype}'")

    # Validate measure_map targets
    measure_map = fm.get("measure_map")
    if isinstance(measure_map, dict):
        for vendor_key, target in measure_map.items():
            if target not in _VALID_MEASURE_TARGETS:
                errors.append(
                    f"measure_map value '{target}' (for key '{vendor_key}') is not a valid NutriPilot field. "
                    f"Valid targets: {', '.join(sorted(_VALID_MEASURE_TARGETS))}"
                )

    # Validate source_label and data_type are present
    if not fm.get("source_label"):
        errors.append("field_mapping.source_label is required (e.g. 'withings', 'garmin')")
    if not fm.get("data_type"):
        errors.append("field_mapping.data_type is required (currently only 'weight' is supported)")

    return errors


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
    name: str = Field(min_length=1, max_length=100, description="Human-readable name (e.g. 'Withings Body+')")
    source_url: str = Field(min_length=1, max_length=500, description="API base URL (e.g. 'https://wbsapi.withings.net/measure')")
    auth_header: Optional[str] = Field(
        default=None, max_length=1000,
        description="OAuth2 access token (for withings_measure) or API key. Required for withings_measure.",
    )
    schedule: str = Field(
        default="0 6 * * *", max_length=50,
        description="Cron schedule for automatic sync. Default: daily at 06:00 UTC.",
    )
    field_mapping: dict = Field(
        description=_FIELD_MAPPING_DESCRIPTION,
        json_schema_extra={
            "examples": list(_FIELD_MAPPING_EXAMPLES.values()),
        },
    )

    @model_validator(mode="after")
    def validate_field_mapping(self) -> "IntegrationCreate":
        errors = _validate_field_mapping(self.field_mapping)
        if self.field_mapping.get("type") in INTEGRATION_TYPES:
            spec = INTEGRATION_TYPES[self.field_mapping["type"]]
            if "auth_header" in spec.get("required_top_keys", set()) and not self.auth_header:
                errors.append("auth_header is required for this integration type (set it to the OAuth2 access token)")
        if errors:
            raise ValueError("Invalid field_mapping: " + "; ".join(errors))
        return self


class IntegrationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    source_url: Optional[str] = Field(default=None, min_length=1, max_length=500)
    auth_header: Optional[str] = Field(default=None, max_length=1000)
    schedule: Optional[str] = Field(default=None, max_length=50)
    field_mapping: Optional[dict] = None
    status: Optional[str] = Field(default=None, pattern="^(active|error|paused)$")
