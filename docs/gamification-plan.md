# Gamification plan

Status: plan, not built yet (2026-10-26). Based on four research passes: competitor apps, behaviour
science, animation tooling, and a map of the current code and DESIGN.md.

## What the research says

**What works**
- Logging consistency is the strongest predictor of results people get from a food tracker. Even 2 to 3 logged days a week helps (MyNetDiary 2026, 5,132 users; GoalTracker RCT: 54% vs 15% reaching 5% loss for 6 of 7 day loggers). So the game rewards logging, not eating less.
- A smoothed trend weight beats the daily scale number (Libra, Happy Scale, MacroFactor). Daily water swings are noise and demotivate.
- Forgiving streaks: Duolingo's freezes and "slack" research, Apple's rest days. Rigid streaks cause "streak anxiety". In 1 to 3 star reviews of calorie apps, people report deleting the app after losing a 47 day streak, or logging dishonestly to keep one.
- Rare, earned rewards feel meaningful; expected rewards for every action crowd out your own reasons (overjustification). So there are no points per log, only milestones that mean something.
- Closing a small number of daily goals (Apple rings) is the clearest pattern. Three goals at most.

**What backfires, especially for nutrition**
- Rewarding low calories, deficits or "staying under". This is a disordered eating trigger.
- Celebrating single-day weight drops, shame copy, red X marks, "you broke your streak" screens.
- Leaderboards and percentiles (MyFitnessPal's "top 29%"). They don't fit a one-person app anyway.
- Punishing companions (Forest's dead trees), and confetti on every action.

## Design fit: "the print shop"

DESIGN.md makes the app a Swiss poster: colour is data, there are no shadows, one display number per screen, green means done, and motion only shows state. Gamification therefore can't arrive as cartoon badges, flames and gradients. It extends the poster metaphor instead:

- **Achievements are prints.** Each earned milestone is a small square poster print: a typographic numeral or glyph on g1 with a 1px g2 frame, printed in the plate ink of its area. A protein print is protein blue, water is water cyan, consistency and weight are ink. This follows the Plate Rule, since the colour names the nutrient. Tiers are print runs: I, II and III.
- **The collection is a poster wall:** an equal-column grid of prints. Unearned ones sit as g2 outlines with the requirement in 12px g4.
- **The streak is a ruled strip of days,** not a flame. Each day is a small square cell: ink when logged, g2 when empty, and a hatched cell for a day covered by a freeze. Today's cell "prints" when the first food is logged.
- **The celebration is a print pass.** The new print wipes in like a screen-print squeegee pass (clip-path left to right), the numeral rolls in, and for big milestones a burst of square paper confetti flies in the print's plate ink. No round confetti and no rainbow.
- **Done Green** only marks completed day goals and completed quests. That is its meaning in DESIGN.md.

DESIGN.md gets a new "Prints" section, plus one motion exception: one celebration moment of up to 900ms, user-triggered by a milestone, never on routine logging, and off under reduced motion.

## The mechanics (ranked, all built)

### 1. Logging streak with freezes (Today)
- A day counts when at least one food is logged. Agent-logged food counts, since it is your record.
- Logging a missed day later (backfilling) repairs the streak. You can fix yesterday tomorrow.
- **Freezes:** you start with 2, earn one per 7-day run, and hold at most 3. A freeze is used automatically for a missed day and shown as a hatched cell. No purchase and no shame screen.
- A broken streak reads "Longest 43 days. Today starts a new run." in g4. No red.
- On Today, a thin band under the day poster shows the last 14 day cells and "12 days" at Figure size. That keeps the One Number Rule. Milestones come at 7, 30, 100, 200, 365, then every 100 days.

### 2. Day goals: close the day (Today)
- You pick up to three daily goals from things that are safe to reward:
  - meals logged (for example 3),
  - protein target reached,
  - water target reached,
  - all supplements taken,
  - fiber target reached.
- There is never a kcal goal.
- These show as ruled rows with round checks that turn Done Green. When all are closed, the band prints a "Day closed" rule draw with a short check animation and a haptic.

### 3. Trend weight and weigh-in rhythm (Body)
- The headline becomes the **trend weight**: an exponentially smoothed average, as in The Hacker's Diet and Libra. The raw scale value sits beside it in 13px. The chart draws raw points faint and the trend line in ink.
- **Goal ETA** from the trend's 4-week slope: "Goal 78.0 kg around 14 Feb". This only shows when the trend moves toward the goal.
- **Weigh-in weeks:** a week with at least 3 weigh-ins counts, and Withings syncs count. Milestones come at 4, 12, 26 and 52 weeks.
- **Trend milestones:** a print for each full kg the *trend* moves toward the goal, and a big one for goal reached. Never for a single day's reading. A trend moving the wrong way shows no message at all.

### 4. Prints (achievements collection, Stats tab section)
About 30 prints in 7 areas, each with up to three runs:

| Area | Prints (runs) |
|---|---|
| Consistency (ink) | Streak 7/30/100/365; Foods logged 100/1000/5000; Comeback (logging again after 3+ days away, celebrates the return) |
| Variety (fiber plate) | 30 different plants in a week (American Gut "30 plants" idea); 20 different foods in a week; new foods tried 10/50/150 |
| Protein (protein plate) | Protein target 5 of 7 days, for 1/4/12 weeks |
| Hydration (water plate) | Water target 7 days running, 30, 100 |
| Micronutrients (ink) | Every tracked micronutrient met in one day; a full week coverage grid |
| Body (ink) | Weigh-in weeks 4/12/26/52; each trend kg toward goal; goal reached |
| Kitchen (ink) | Barcodes scanned 10/50/200; own foods saved 5/25; named servings 5 |
| Supplements (done green check on ink) | Full adherence 7/30/100 days |

- Two or three are hidden until earned ("Comeback", "Full plate": every tracked nutrient goal met in one day). That gives the surprise of a variable reward without randomness.
- On deploy, history is evaluated once. Earned prints are added silently and announced in one summary sheet: "You already earned 14 prints." That avoids 14 popups.

### 5. Weekly quests and Monday recap (Today and Stats)
- Every Monday, three quests are picked from a pool and adapted to last week, for example:
  - "Protein target 4 of 7 days" (if last week had 2),
  - "Try 3 new foods",
  - "Water target 5 days",
  - "25 different plants".
- **Autonomy:** one swap per week.
- **Safety:** no quest ever asks for fewer kcal, less fat or weight change.
- A quest completes with a Done Green check and a small print pass. Completing all three earns the week's print.
- **Monday recap sheet:** a one-screen "Your week" poster with logged days, quests done, new prints, trend weight change, the best protein day and the most varied day. It is the one orchestrated sequence in the app, with a staggered reveal of rows.

### 6. Year grid (Stats)
- A 53 by 7 grid of the year, one square per day, with brightness on the ramp for how complete the day was: g2 empty, then g4 and g5, then ink for a closed day. It is a GitHub-style contribution grid set like a Swiss calendar, and it is very on-brand.

### Safety rails (built in, not optional)
- **Nothing rewards low intake.** The existing **"Lowest calorie day" record is replaced** by "Most varied day". Under the research rules it rewards restriction.
- Over-target days are logged and counted like any other day, and honest logging is what is rewarded.
- **Settings > App > Motivation:** game features on/off, a "Show streak" toggle, and Celebrations full / quiet (no confetti, no sheet, a toast only) / off. All prints keep working in the background, so switching back on loses nothing.
- Reduced motion: every animation has a no-movement path.

## Animation stack

| Need | Tool | Cost |
|---|---|---|
| Cell print, rule draw, check draw, ring and bar easing | CSS keyframes already in globals.css (`animate-rule`, `animate-check`, `animate-bar`) plus 2 new ones (`print-pass`, `cell-print`) | 0 KB |
| Number roll | existing `useCountUp` hook | 0 KB |
| Unlock sheet, recap stagger, interruptible enter/exit | `motion` (`motion/react` with `LazyMotion` + `m`, `domAnimation` features), loaded only in the sheet's chunk | ~5 KB initial, ~15 KB when the sheet opens |
| Square paper confetti in plate ink | `canvas-confetti`, dynamic import, `shapes: ["square"]`, `disableForReducedMotion: true`, only for runs II/III, big streaks and goal reached | ~4 KB, only when fired |
| Haptics | `navigator.vibrate` patterns (short tick for a day goal, double pulse for a print) | 0 KB |

Rejected:
- Lottie (34 to 196 KB) and Rive (75 KB): too heavy, and their look would not match.
- tsparticles.
- A pet or companion: it does not fit the poster world, and the Finch study shows reward drift.
- XP and levels: overjustification risk.

**Skills used while building:**
- The installed `impeccable` animate reference for duration bands (100 to 150, 150 to 300 and 500 to 800 ms), `cubic-bezier(0.16, 1, 0.3, 1)` arrivals, transform and opacity only, and a reduced-motion path.
- `ui-ux-pro-max` motion rules (30 to 50 ms stagger, at most 1 to 2 animated elements per view, tap feedback under 100 ms).
- `frontend-design` (one orchestrated moment).
- Optional: the public `emilkowalski/skills` animate skill, installed only with your OK.

## Backend

**New tables (one Alembic migration)**
- `achievements`: user_id, key, run, earned_at, seen_at, context JSON; unique on (user_id, key, run).
- `streak_freezes`: user_id, date, kind (`auto`); banked count on `users.freezes_banked`.
- `day_goals` on users as JSON (the chosen up to 3).
- `weekly_quests`: user_id, week_start, key, target, progress, done_at, swapped.
- `users.game_settings` JSON (enabled, show_streak, celebrations).

**Service**
- `app/services/game_service.py`:
  - `evaluate(user, changed_dates)` is pure and idempotent, computed from existing logs. It runs after every food, water, supplement and weight write and after each sync.
  - `backfill(user)` runs once.
  - Trend weight uses an EWMA with alpha 0.1 on daily means.

**Endpoints**
- `GET /api/dashboard/game` returns the streak, freezes, the 14-day strip, day goals, quests, unseen prints and the collection.
- `POST /api/dashboard/game/seen`.
- `POST /api/dashboard/game/quests/{id}/swap`.
- `PUT /api/v1/settings/game`.

The agent API only gains things: a read-only `GET /api/agent/game/summary` the agent can mention ("2 days to your 30 day print"). Existing contracts are untouched.

## Build order
1. **Foundation:** tables, game_service with streak, freezes and day goals, settings toggles, the global unlock sheet, the Today band. Tests for the streak rules (backfill repair, freezes, timezone day edges, agent logs).
2. **Body:** trend weight, ETA, weigh-in weeks, trend milestones.
3. **Prints:** full catalogue, silent backfill and summary sheet, the Stats wall and year grid, replacing the lowest calorie record.
4. **Quests and Monday recap.**
5. **Review and polish:** a UI reviewer and a UX reviewer (separate Opus agents), a phone E2E on the demo account with empty test dates only, the DESIGN.md "Prints" section, and screenshots.

**Who builds:**
- I build the frontend myself.
- A Sonnet agent builds game_service and the migration against this spec with tests, and I verify it.
- Two Opus agents review at the end.

## Owner decisions (2026-10-26)
- "Lowest calorie day" is replaced by "Most varied day" in the app. The agent API keeps its `lowest_calorie_day` field (contracts only gain fields) and gains `most_varied_day`.
- Agent-logged food counts toward the streak and prints.
- Celebrations default to full for big milestones.
- Scope now: phases 1 to 3 (streak and day goals, trend weight, prints). Quests and the Monday recap come later.

## Owner decisions (2026-10-26, later)
- The app should push streaks and healthy lower calorie eating over time. The logging streak stays the only streak and moves into the Today poster's hero.
- A "window day" is a logged day at or under the kcal target and not below 1000 kcal. It earns prints (days in the window, window weeks, window streak), a weekly quest and an optional "Calorie window" day goal. Days under 1000 kcal never count; days the owner marks as incomplete never count.
- This replaces the earlier rule "nothing rewards eating less" with "nothing rewards a day under 1000 kcal".
