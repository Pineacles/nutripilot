/**
 * Shared supplement dose-unit/timing option lists.
 *
 * Supplement *definitions* (backend/app/schemas/settings.py SupplementDefinitionCreate/Update)
 * accept free-form strings for dose_unit/time_of_day, so DOSE_UNITS/TIMINGS below are just a
 * helpful default option list, not a hard constraint.
 *
 * Supplement intake *logs* (backend/app/schemas/supplement.py SupplementCreate) DO restrict
 * time_of_day to a Literal — INTAKE_LOG_TIMINGS mirrors that, so "mark taken" can sanitize a
 * definition's (potentially freer) time_of_day before posting a log.
 */
export const DOSE_UNITS = ["mg", "g", "IU", "mcg", "µg", "ml"];
export const TIMINGS = ["morning", "afternoon", "evening", "with meal"];
export const INTAKE_LOG_TIMINGS = ["morning", "afternoon", "evening"];
