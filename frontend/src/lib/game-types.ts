// The motivation layer: streak, day goals, trend weight, prints, quests and the weekly recap.
// Mirrors GET /api/dashboard/game.

export type Celebrations = "full" | "quiet" | "off";
export type PrintArea = "consistency" | "calories" | "variety" | "protein" | "hydration" | "micros" | "body" | "kitchen" | "supplements";
export type StripState = "logged" | "freeze" | "empty" | "pending";

export interface StreakState {
  current: number;
  longest: number;
  freezes_banked: number;
  freezes_max: number;
  today_logged: boolean;
  next_milestone: number;
  strip: { date: string; state: StripState }[];
  /** The day the owner restarted the streak from, if any. */
  restart_from: string | null;
  /** Days the owner said don't count (food was missing from the log). */
  excluded_days: string[];
}

export interface DayGoal {
  key: string;
  label: string;
  target: number;
  value: number;
  unit: "meals" | "g" | "ml" | "taken" | "kcal";
  done: boolean;
}

export interface WeightGame {
  trend_kg: number;
  raw_kg: number;
  raw_date: string;
  trend_change_7d: number | null;
  trend_change_28d: number | null;
  goal_kg: number | null;
  direction: "down" | "up" | "reached" | null;
  eta_date: string | null;
  weigh_in_weeks_current: number;
  weigh_in_weeks_longest: number;
  this_week_weigh_ins: number;
  is_trend_low: boolean;
  series: { date: string; raw: number | null; trend: number }[];
}

export interface PrintRun {
  run: number;
  threshold: number;
  earned_at: string | null;
}

export interface Print {
  key: string;
  area: PrintArea;
  title: string;
  description: string;
  hidden: boolean;
  unit: string;
  runs: PrintRun[];
  progress: { value: number; next_threshold: number | null } | null;
}

export interface UnseenItem {
  kind: "print" | "quest" | "freeze" | "comeback";
  /** The quest's id for kind "quest", else null. */
  id: string | null;
  key: string;
  run: number | null;
  title: string;
  description: string;
  area: PrintArea | null;
  date: string;
  big: boolean;
  backfill: boolean;
}

export interface Quest {
  id: string;
  key: string;
  title: string;
  target: number;
  progress: number;
  done: boolean;
  area: PrintArea;
}

export interface GameState {
  enabled: boolean;
  show_streak: boolean;
  celebrations: Celebrations;
  today: string;
  streak: StreakState;
  day_goals: DayGoal[];
  day_closed: boolean;
  available_goals: { key: string; label: string; default_target: number | null }[];
  weight: WeightGame | null;
  prints: Print[];
  unseen: UnseenItem[];
  quests: { week_start: string; swap_available: boolean; items: Quest[] };
  year: { date: string; level: 0 | 1 | 2 | 3 }[];
  recap_available: string | null;
  /** At or under the kcal target and not below the floor (1000 kcal). null without a kcal target. */
  calorie_window: { floor: number; target: number; today_kcal: number; in_window: boolean; days_this_week: number } | null;
}

export interface WeekRecap {
  week_start: string;
  logged_days: number;
  /** null when no day goals are chosen */
  closed_days: number | null;
  days: { date: string; logged: boolean; closed: boolean; window?: boolean }[];
  /** Days in the calorie window that week; null without a kcal target. */
  window_days?: number | null;
  quests: { key: string; title: string; target: number; progress: number; done: boolean }[];
  prints: { key: string; run: number; title: string; area: PrintArea }[];
  trend_start: number | null;
  trend_end: number | null;
  trend_change: number | null;
  /** null without a goal; false when the trend moved away from it (then it is not shown) */
  trend_toward_goal: boolean | null;
  weigh_in_days: number;
  best_protein_day: { date: string; value: number } | null;
  most_varied_day: { date: string; value: number } | null;
  distinct_foods: number;
  /** null when water is hidden or has no target */
  water_target_days: number | null;
  streak_at_end: number;
}

export interface GameSettingsInput {
  enabled?: boolean;
  show_streak?: boolean;
  celebrations?: Celebrations;
  day_goals?: { key: string; target?: number | null }[];
}
