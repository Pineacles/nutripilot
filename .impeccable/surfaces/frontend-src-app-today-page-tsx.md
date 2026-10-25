---
version: 1
slug: "frontend-src-app-today-page-tsx"
primary_target: "frontend/src/app/today/page.tsx"
related_targets: ["frontend/src/components/food-log/add-food-dialog.tsx"]
---

# Today and Log food (phone first)

Scope: the Today page and the Log food sheet on phones; desktop keeps its layout but takes the same world. Mode: Operate. Audience: the owner, logging right after eating, one handed, on Android.

## Direction contract

THESIS: Each day is one Swiss concert poster on a visible grid: what is left is set huge, the meals step down the columns. It refuses the category default of a stack of rounded cards with a centered calorie donut.

OWN-WORLD: Near-black ground #0E0F0E with a fixed seven-step neutral ramp (#0E0F0E #171817 #232523 #3A3D3A #6B6F6A #A3A79F #EDEEE8), no other greys. Macro inks as poster plates: protein #4F7CFF, carbs #E9A23B, fat #F0553F; green #3FCB7E only for "done/under target". One neo-grotesk (Host Grotesk) for everything, tabular figures. Regions divided by 1px hairlines in ramp step 3; no cards, no shadows, radius only on controls (pill buttons 999px, inputs 14px).

STORY: Open the app and know in one glance how much is left and what was eaten; log the next food in two taps; a just-logged food stays lit until seen.

FIRST VIEWPORT: Top row: day name and date left, previous/next right, hairline below. Hero band: remaining kcal flush left at ~120px, "kcal left of 2200, 1428 eaten" under it; concentric quarter arcs (kcal white, protein, carbs, fat) bleeding off the top right edge. Below, a three-column hairline row of protein/carbs/fat with value in macro ink over one absolute gram scale bar. Then Meals as hairline rows: time, meal, items, kcal; the current meal in full ink, earlier ones one ramp step down, an empty upcoming meal with +. Log food is a full-width ink bar (ramp 7 ground, ramp 1 text) above the tab bar, naming the meal it logs to.

FORM: Swiss International Typographic Style grid poster on black (Müller-Brockmann), position 4 on my list; seed:ef9c94b220a5f805. Raises: hairlines not boxes (design annual), stepped ramp (exposure record), stays lit until seen (gate board), current item burns brightest (transit), one absolute scale (orienteering).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
