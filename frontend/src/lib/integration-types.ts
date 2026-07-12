/**
 * Client-side mirror of backend/app/schemas/integration.py INTEGRATION_TYPES: just the
 * parts the "Add integration" form needs (credential field names, whether a top-level
 * auth_header is required, and which measure_map target fields are valid for this type).
 * Keep in sync manually if the backend adds a new integration type.
 */
export interface IntegrationTypeSpec {
  label: string;
  /** field_mapping keys (besides measure_map) this type requires. */
  credentialFields: { key: string; label: string; secret?: boolean }[];
  requiresAuthHeader: boolean;
  validMeasureTargets: string[];
}

export const INTEGRATION_TYPES: Record<string, IntegrationTypeSpec> = {
  withings_measure: {
    label: "Withings (Body / Body+ / Body Cardio / Body Scan)",
    credentialFields: [
      { key: "refresh_token", label: "Refresh token", secret: true },
      { key: "client_id", label: "Client ID" },
      { key: "client_secret", label: "Client secret", secret: true },
    ],
    requiresAuthHeader: true,
    validMeasureTargets: ["weight_kg", "body_fat_pct", "muscle_mass_pct", "body_fat_kg", "muscle_mass_kg"],
  },
  fitbit_body: {
    label: "Fitbit Aria (Aria / Aria Air / Aria 2)",
    credentialFields: [
      { key: "refresh_token", label: "Refresh token", secret: true },
      { key: "client_id", label: "Client ID" },
      { key: "client_secret", label: "Client secret", secret: true },
    ],
    requiresAuthHeader: true,
    validMeasureTargets: ["weight_kg", "body_fat_pct"],
  },
  google_fit: {
    label: "Google Fit",
    credentialFields: [
      { key: "refresh_token", label: "Refresh token", secret: true },
      { key: "client_id", label: "Client ID" },
      { key: "client_secret", label: "Client secret", secret: true },
    ],
    requiresAuthHeader: true,
    validMeasureTargets: ["weight_kg", "body_fat_pct"],
  },
  garmin_body: {
    label: "Garmin Index (Index S2 / Index 2)",
    credentialFields: [
      { key: "consumer_key", label: "Consumer key" },
      { key: "consumer_secret", label: "Consumer secret", secret: true },
      { key: "oauth_token", label: "OAuth token" },
      { key: "oauth_token_secret", label: "OAuth token secret", secret: true },
    ],
    requiresAuthHeader: false,
    validMeasureTargets: ["weight_kg", "body_fat_pct", "muscle_mass_pct"],
  },
  generic_json: {
    label: "Generic JSON API",
    credentialFields: [],
    requiresAuthHeader: false,
    validMeasureTargets: ["weight_kg", "body_fat_pct", "muscle_mass_pct", "body_fat_kg", "muscle_mass_kg"],
  },
};

export const MEASURE_TARGET_LABELS: Record<string, string> = {
  weight_kg: "Weight (kg)",
  body_fat_pct: "Body fat %",
  muscle_mass_pct: "Muscle mass %",
  body_fat_kg: "Body fat (kg)",
  muscle_mass_kg: "Muscle mass (kg)",
};
