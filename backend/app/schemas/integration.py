import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

# ── Supported integration types and their required fields ──

INTEGRATION_TYPES = {
    "withings_measure": {
        "description": "Withings smart scale (Body, Body+, Body Cardio, Body Scan). Syncs weight and body composition.",
        "required_fm_keys": {"refresh_token", "client_id", "client_secret", "measure_map"},
        "required_top_keys": {"auth_header"},
        "valid_measure_targets": {"weight_kg", "body_fat_pct", "muscle_mass_pct", "body_fat_kg", "muscle_mass_kg"},
        "example_measure_map": {"1": "weight_kg", "6": "body_fat_pct", "8": "body_fat_kg", "76": "muscle_mass_pct"},
    },
    "fitbit_body": {
        "description": "Fitbit Aria scales (Aria, Aria Air, Aria 2). Syncs weight and body fat via Fitbit Web API.",
        "required_fm_keys": {"refresh_token", "client_id", "client_secret", "measure_map"},
        "required_top_keys": {"auth_header"},
        "valid_measure_targets": {"weight_kg", "body_fat_pct"},
        "example_measure_map": {"weight": "weight_kg", "fat": "body_fat_pct"},
    },
    "google_fit": {
        "description": (
            "Google Fit. Syncs weight and body fat. Strategic: catches Xiaomi, Eufy, Samsung, "
            "and Renpho users who sync their scale data through Google Fit."
        ),
        "required_fm_keys": {"refresh_token", "client_id", "client_secret", "measure_map"},
        "required_top_keys": {"auth_header"},
        "valid_measure_targets": {"weight_kg", "body_fat_pct"},
        "example_measure_map": {"weight": "weight_kg", "body_fat_percentage": "body_fat_pct"},
    },
    "garmin_body": {
        "description": (
            "Garmin Index scales (Index S2, Index 2). Uses OAuth 1.0a (NOT 2.0). "
            "Tokens do not expire: they remain valid until the user revokes access. "
            "Requires Garmin Health API partner approval. Weight is returned in grams."
        ),
        "required_fm_keys": {"consumer_key", "consumer_secret", "oauth_token", "oauth_token_secret", "measure_map"},
        "required_top_keys": set(),
        "valid_measure_targets": {"weight_kg", "body_fat_pct", "muscle_mass_pct"},
        "example_measure_map": {"weightInGrams": "weight_kg", "bodyFatPercentage": "body_fat_pct", "muscleMassInGrams": "muscle_mass_pct"},
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
- `type` (str): Integration type. One of: `withings_measure`, `fitbit_body`, `google_fit`, `garmin_body`, `generic_json`.
- `measure_map` (object): Maps vendor field keys to NutriPilot field names.
- `source_label` (str): Label for the data source (e.g. "withings"). Used in weight logs.
- `data_type` (str): What kind of data to sync. Currently only "weight" is supported.

---

**`withings_measure`: Withings Body / Body+ / Body Cardio / Body Scan**
- OAuth2 flow. Authorization: `https://account.withings.com/oauth2_user/authorize2`
- Token endpoint: `https://wbsapi.withings.net/v2/oauth2` (non-standard, uses `action=requesttoken`)
- Required: `refresh_token`, `client_id`, `client_secret` in field_mapping. `auth_header` = access token.
- `measure_map` keys are Withings measure type IDs (strings):
  - `"1"` = weight (kg): use target `"weight_kg"`
  - `"5"` = fat free mass (kg)
  - `"6"` = fat ratio (%) → use target `"body_fat_pct"`
  - `"8"` = fat mass weight (kg) → use target `"body_fat_kg"`
  - `"76"` = muscle mass (kg) → use target `"muscle_mass_kg"`
  - `"77"` = hydration (kg)
  - `"88"` = bone mass (kg)
- Withings error codes: 301/320/343 = permanent (re-auth needed). 304 = refresh token. 305/601 = rate limit.
- Rate limit: 120 requests/minute per user.

---

**`fitbit_body`: Fitbit Aria / Aria Air / Aria 2**
- OAuth2 + PKCE. Authorization: `https://www.fitbit.com/oauth2/authorize`
- Token endpoint: `https://api.fitbit.com/oauth2/token`
- Required: `refresh_token`, `client_id`, `client_secret` in field_mapping. `auth_header` = access token.
- **Fitbit rotates refresh tokens on every refresh.** The new refresh_token is saved automatically.
- Scope needed: `weight`
- `source_url` should be `https://api.fitbit.com/1/user/-/body/log/weight/date`
- `measure_map` keys are Fitbit response field names:
  - `"weight"` → use target `"weight_kg"` (value is in user's unit system; set Accept-Language: en_US)
  - `"fat"` → use target `"body_fat_pct"`
  - `"bmi"` = BMI (calculated, not a NutriPilot target)
  - Fitbit Aria does NOT report muscle mass, bone mass, or water: only weight and body fat.
- Error codes: HTTP 401 `expired_token` = refresh. HTTP 401 `invalid_token`/`invalid_grant` = permanent. HTTP 429 = rate limit.
- Rate limit: 150 requests/hour per user. Headers: `Fitbit-Rate-Limit-Remaining`, `Fitbit-Rate-Limit-Reset`.

---

**`google_fit`: Google Fit (catches Xiaomi, Eufy, Samsung, Renpho users)**
- Standard Google OAuth2. Authorization: `https://accounts.google.com/o/oauth2/v2/auth`
- Token endpoint: `https://oauth2.googleapis.com/token`
- Required: `refresh_token`, `client_id`, `client_secret` in field_mapping. `auth_header` = access token.
- Scope needed: `https://www.googleapis.com/auth/fitness.body.read`
- `source_url` should be `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`
- `measure_map` keys are Google Fit data type suffixes:
  - `"weight"` (from `com.google.weight`) → use target `"weight_kg"`
  - `"body_fat_percentage"` (from `com.google.body.fat.percentage`) → use target `"body_fat_pct"`
  - Google Fit does NOT have muscle mass or bone mass data types.
- Error codes: `invalid_grant` = permanent. HTTP 429 = rate limit. HTTP 5xx = transient.
- Rate limit: 60 requests/minute per user, 360/minute per project.
- Note: Google Fit REST API is being deprecated in favor of Health Connect (Android-only).
  Many users of scales without APIs (Xiaomi Mi Scale, Eufy, Renpho, Samsung) sync to Google Fit,
  so this integration captures them indirectly.

---

**`garmin_body`: Garmin Index S2 / Index 2**
- **OAuth 1.0a (NOT 2.0)**. Tokens do NOT expire and do NOT need refreshing.
- Required: `consumer_key`, `consumer_secret`, `oauth_token`, `oauth_token_secret` in field_mapping.
- No `auth_header` or `refresh_token` needed: OAuth 1.0a signs each request with HMAC.
- Requires Garmin Health API partner approval at developer.garmin.com.
- `source_url` should be `https://apis.garmin.com/wellness-api/rest/bodyComps`
- Garmin is push-based (sends data to your callback), but also supports pull-based backfill.
- `measure_map` keys are Garmin response field names:
  - `"weightInGrams"` → use target `"weight_kg"` (sync worker divides by 1000 automatically)
  - `"bodyFatPercentage"` → use target `"body_fat_pct"`
  - `"muscleMassInGrams"` → use target `"muscle_mass_kg"` (sync worker divides by 1000)
  - `"boneMassInGrams"` = bone mass (not a NutriPilot target yet)
  - `"bodyWaterPercentage"` = hydration (not a NutriPilot target yet)
- Error codes: HTTP 401 = revoked token (permanent, user must re-authorize on Garmin Connect). HTTP 429 = rate limit.

---

**`generic_json`: Any JSON API**
- For any API returning a JSON array with date + numeric fields.
- `response_path` (str, optional): Dot-path to the array (e.g. "data.records").
- `date_field` (str, optional): Key for the date. Default: "date".
- `token_url` (str): Required if the API uses OAuth2 token refresh.
- `measure_map` keys are the JSON field names from the API response.

---

**Valid NutriPilot target fields for measure_map values:**
`weight_kg`, `body_fat_pct`, `muscle_mass_pct`, `body_fat_kg`, `muscle_mass_kg`

**Do NOT invent custom field names.** Only use the exact target names listed above as measure_map values.
If a scale does not report a measurement (e.g. Fitbit has no muscle mass), do NOT include it in measure_map.

---

**`conversions`: Post-mapping value transformations (optional)**

Scales like Withings report "muscle mass" as BIA lean mass (everything except fat and bone),
which is ~60-65% of body weight. This is NOT comparable to DEXA skeletal muscle mass (~35-45%).

Use `conversions` to apply a scaling factor so stored values are DEXA-equivalent:
```json
"conversions": {
  "muscle_mass_kg": {
    "factor": 0.62,
    "description": "BIA lean mass to DEXA skeletal muscle estimate"
  }
}
```

- **factor** (float): Multiplied with the raw value before storing. E.g. Withings 52kg × 0.62 = 32.2kg skeletal muscle.
- **description** (str, optional): Human-readable note for what the conversion does.
- After conversion, `muscle_mass_pct` is auto-derived from the converted `muscle_mass_kg` / `weight_kg`.
- Applies to any field in `measure_map` values: `weight_kg`, `body_fat_pct`, `muscle_mass_kg`, etc.
- Common factor for Withings/BIA → DEXA skeletal muscle: **0.55-0.65** depending on individual body composition.\
"""

_FIELD_MAPPING_EXAMPLES = {
    "withings_measure": {
        "type": "withings_measure",
        "source_label": "withings",
        "data_type": "weight",
        "measure_map": {"1": "weight_kg", "6": "body_fat_pct", "8": "body_fat_kg", "76": "muscle_mass_pct"},
        "refresh_token": "<from_withings_oauth_flow>",
        "client_id": "<your_withings_client_id>",
        "client_secret": "<your_withings_client_secret>",
    },
    "fitbit_body": {
        "type": "fitbit_body",
        "source_label": "fitbit",
        "data_type": "weight",
        "measure_map": {"weight": "weight_kg", "fat": "body_fat_pct"},
        "refresh_token": "<from_fitbit_oauth_flow>",
        "client_id": "<your_fitbit_client_id>",
        "client_secret": "<your_fitbit_client_secret>",
    },
    "google_fit": {
        "type": "google_fit",
        "source_label": "google_fit",
        "data_type": "weight",
        "measure_map": {"weight": "weight_kg", "body_fat_percentage": "body_fat_pct"},
        "refresh_token": "<from_google_oauth_flow>",
        "client_id": "<your_google_client_id>",
        "client_secret": "<your_google_client_secret>",
    },
    "garmin_body": {
        "type": "garmin_body",
        "source_label": "garmin",
        "data_type": "weight",
        "measure_map": {"weightInGrams": "weight_kg", "bodyFatPercentage": "body_fat_pct", "muscleMassInGrams": "muscle_mass_kg"},
        "consumer_key": "<your_garmin_consumer_key>",
        "consumer_secret": "<your_garmin_consumer_secret>",
        "oauth_token": "<from_garmin_oauth1a_flow>",
        "oauth_token_secret": "<from_garmin_oauth1a_flow>",
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


def validate_field_mapping(fm: dict) -> list[str]:
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


# Keys in field_mapping that must never appear in API responses.
_SECRET_FM_KEYS: frozenset[str] = frozenset({
    "refresh_token",
    "access_token",
    "client_secret",
    "consumer_secret",
    "oauth_token_secret",
    "password",
    "api_key",
    "apikey",
    "api_secret",
    "token",
    "secret",
})

# Sentinel value sent back to clients in place of a real secret.
REDACTED_SENTINEL = "•••"


def _redact_field_mapping(fm: dict | None) -> dict | None:
    """Return a copy of *fm* with secret-shaped keys replaced by REDACTED_SENTINEL.

    Only top-level keys are examined; nested dicts (e.g. measure_map, conversions)
    are left intact because they do not carry credentials.
    """
    if fm is None:
        return None
    result = {}
    for k, v in fm.items():
        if k.lower() in _SECRET_FM_KEYS:
            result[k] = REDACTED_SENTINEL
        else:
            result[k] = v
    return result


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

    @model_validator(mode="after")
    def _redact_secrets(self) -> "IntegrationResponse":
        self.field_mapping = _redact_field_mapping(self.field_mapping)
        return self


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
    def _check_field_mapping(self) -> "IntegrationCreate":
        errors = validate_field_mapping(self.field_mapping)
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
