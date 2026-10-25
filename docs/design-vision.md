# NutriPilot design vision

NutriPilot keeps its look: dark clay cards, one green accent, the macro colors (protein blue,
carbs amber, fat red, plus a plate for fiber, water, caffeine and alcohol), rounded pills. This document is about how it should *behave* on a phone in
2026 and which rules every new screen follows. It came out of a small research round on the
leading trackers (MacroFactor, Cronometer, MyFitnessPal, Yazio, Lose It!) in October 2026.

## Theme: Swiss grid on black

Chosen by the owner on 2026-10-25 from an Impeccable direction round (the full system lives in
DESIGN.md, the contract in .impeccable/surfaces/). Each day is one Swiss concert poster on a
visible grid: what has been eaten is set huge (the line under it gives the target and what is left),
the macros run as quarter arcs off the corner, meals step down as ruled rows. No cards on phones: 1px hairlines divide everything; one neo-grotesk (Host
Grotesk); a fixed seven-step neutral ramp; "Swiss poster in full colour" (owner decision, found
the first version cold): every nutrient area wears its own validated plate ink (protein blue, carbs amber,
fat red, fiber green, water cyan, caffeine violet, alcohol rose), one warm alert colour (#FF6F91)
marks over a limit or low on a goal and always comes with the word "over" or "low", and green only means
done. Sugar, salt and vitamins have no plate and read in ink. The palette passed the dataviz skill's
validator on the g0 ground (lightness band, chroma floor, colour-blind separation, 3:1 contrast); carbs
amber was replaced because it failed that check. Details in DESIGN.md, Colors.

Every limit or goal (fiber, sugar, salt, caffeine, alcohol, water) has a scale bar with the limit
marked by a tick; the fill wears the nutrient's plate and past a limit the overflow and tick turn alert beyond the target, with the word "over". Motion
follows the same logic: arcs draw in once, the figure and macro values roll after a log, a food
just logged flashes its row, meal rows open by easing their height; all of it eased out, short and
switched off by reduced motion.

## Rules for every screen

1. **Thumb zone first.** Primary actions sit in the bottom 40% of a phone screen; tap targets are
   at least 44 px. Top-right corners hold only secondary actions.
2. **Phone and desktop differ where it matters.** Desktop keeps centered dialogs and side
   panels. On phones, anything that collects input is a bottom sheet with a drag handle that can
   take the full height.
3. **The keyboard never covers the action.** The primary button of a sheet is sticky above the
   keyboard; number fields use the numeric keypad (`inputMode="decimal"`).
4. **Undo instead of confirm.** Logging, deleting and copying happen at once and offer Undo in a
   toast. Confirm dialogs are only for things Undo cannot bring back.
5. **Recents before search.** Most food is food you ate before. Lists open on what you log most
   at this time of day; search narrows them.
6. **Live preview.** Any amount you type shows the kcal and macros it adds, before you press Log.
7. **One name per action.** "Log food" opens it, the button says "Log", the toast says "Logged".
8. **Feedback you can feel.** A short vibration on a successful log or scan (Android); motion only
   for sheets sliding and things that changed, eased out and short (value rolls and the one-time
   arc draw may run up to 700 ms), and none with reduced motion.
9. **Swiss formats.** Dates as "Sat 25 Oct", numbers with a dot decimal, grams and millilitres.
10. **No dead ends.** Empty and error states say what to do next and offer that action.

## Logging food on the phone

The desktop dialog stays. On phones, **Log food** opens a full-height bottom sheet built for
logging the same things again quickly:

```
┌──────────────────────────────┐
│            ───               │  drag handle
│ Log to  [Lunch ▾] [Today ▾]  │  meal and day chips, defaults: meal by time, the open day
│                              │
│ Recent                        │
│ ┌──────────────────────────┐ │
│ │ Oat flakes   80 g · 300  │+│  tap +: logs last time's amount at once
│ │ Skyr          1 cup · 98 │+│  tap the row: amount step
│ └──────────────────────────┘ │
│ ...                          │
│ ┌──────────────────────────┐ │
│ │ 🔍 Search foods      [▥] │ │  search pinned at the bottom, barcode camera button in it
│ └──────────────────────────┘ │
│ [ 2 logged · Done ]          │  appears after the first log
└──────────────────────────────┘
```

- **Repeat food: 2 taps** (Log food, +). The sheet stays open for more; each logged row shows a
  check, and a toast offers Undo.
- **Different amount: row tap** opens the amount step in the same sheet: a large amount field
  with the numeric keypad, unit chips (Servings, Grams, the food's own units), the live preview and
  a sticky **Log** button. Back returns to the list.
- **Barcode** opens the camera inside the sheet; a hit goes straight to the amount step with one
  serving, a product without values asks for them first, a miss offers search and "Add as new
  food".
- **Search** replaces the list with results while typing; results are ranked with your own
  foods first.
- **Per meal +.** Each meal on the Today page has its own + that opens the sheet with that meal
  chosen.

## Tracked nutrients

Settings has a **Tracked nutrients** section: a switch for every nutrient, grouped as Macros
(protein, carbs, fat, fiber, sugar, saturated fat, salt), Vitamins and minerals, and Drinks
(water, caffeine, alcohol). Calories are always tracked, because the app is built around them.

- A hidden nutrient disappears from the Today panel, the weekly and statistics pages and the
  logging preview. Its data is still stored and still accepted from the agent API, so turning it
  back on shows the full history.
- A card whose every row is hidden is not shown at all.
- Presets at the top: **Everything**, **Macros only**, **Calories and protein**.
