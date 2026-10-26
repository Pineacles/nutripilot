---
name: NutriPilot
description: The day as a Swiss poster on black; what has been eaten is set huge, the meals step down the grid.
colors:
  g0: "#0E0F0E"
  g1: "#171817"
  g2: "#232523"
  g3: "#3A3D3A"
  g4: "#7D817C"
  g5: "#A3A79F"
  ink: "#EDEEE8"
  protein: "#4F7CFF"
  carbs: "#D2790E"
  fat: "#C8384B"
  fiber: "#3FAD3E"
  water: "#299FCD"
  caffeine: "#854CDD"
  alcohol: "#B24C74"
  alert: "#FF6F91"
  done: "#3FCB7E"
typography:
  display:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "7.5rem"
    fontWeight: 700
    lineHeight: 0.8
    letterSpacing: "-0.045em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "4rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\" 1"
  title:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.2
    fontFeature: "\"tnum\" 1"
  row:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.3
    fontFeature: "\"tnum\" 1"
  body:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
  body-sm:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
  nav-label:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  none: "0px"
  field: "14px"
  panel: "14px"
  sheet: "24px"
  control: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  touch: "44px"
  row: "60px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.g0}"
    typography: "{typography.row}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-primary-sheet:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.g0}"
    rounded: "{rounded.control}"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.g0}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-icon:
    backgroundColor: "{colors.g0}"
    textColor: "{colors.g4}"
    rounded: "{rounded.control}"
    size: "44px"
  chip:
    backgroundColor: "{colors.g0}"
    textColor: "{colors.g5}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.g0}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  input-search:
    backgroundColor: "{colors.g0}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px 0 40px"
    height: "48px"
  input-amount:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.none}"
    height: "80px"
  panel:
    backgroundColor: "{colors.g1}"
    rounded: "{rounded.panel}"
    padding: "20px"
  sheet:
    backgroundColor: "{colors.g1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
  nav-tab:
    backgroundColor: "{colors.g0}"
    textColor: "{colors.g4}"
    typography: "{typography.nav-label}"
    height: "60px"
  nav-tab-active:
    backgroundColor: "{colors.g0}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-label}"
    height: "60px"
---

# Design System: NutriPilot

## Overview

**Creative North Star: "The Day Poster"**

Each day is one Swiss International Style poster set on a near-black ground. The single most important fact, how many kcal have been eaten today, is set in enormous bold numerals flush left with the target and what is left (or over) in the line beneath, and the rest of the day steps down a visible grid: a ruled row of macros on one absolute gram scale, ruled rows of details and drinks, then the meals as hairline rows. Concentric quarter arcs in the macro plate inks bleed off the top right edge, the only graphic flourish, and it carries data.

The palette is a fixed seven-step neutral ramp plus seven plate inks (every nutrient area prints in its own colour, like poster printing plates), one warm attention colour, and one green that only ever means done. Type is one neo-grotesk, Host Grotesk, with tabular figures everywhere, so columns of numbers line up and days compare honestly. Depth is not a thing in this world: regions are divided by 1px hairlines, never lifted. On phones there are no boxes at all, one sheet divided by rules; on wider screens the secondary sections sit in quiet flat panels.

Density is planned, not packed. Every value has a fixed column and a fixed size, and state is shown by brightness on the ramp: the current meal burns in full ink, earlier ones step one ramp step down, empty ones sit two steps down. A food logged minutes ago stays lit with a small ink dot until it is seen.

**Key Characteristics:**
- Near-black ground with a seven-step neutral ramp and no other greys.
- Swiss poster in full colour: every nutrient area wears its own plate ink (protein blue, carbs amber, fat red, fiber green, water cyan, caffeine violet, alcohol rose) as data, never decoration; one warm alert colour for over and low.
- One typeface, tabular figures, one huge number per screen.
- 1px hairlines in ramp step g2 instead of cards and shadows.
- Primary actions set in ink, like the poster's type.
- Pill controls, square poster.

## Colors

A monochrome ramp from near-black to warm paper white, printed over with seven plate inks, one attention colour and one signal green. Colour is data: it names a nutrient area or says "look here", and it is never decoration.

### Primary
- **Poster Ink** (ink): the type colour and the primary action colour. The Log food bar, the sheet's Log button, selected chips, the active tab rule, focus outlines, the text selection and the "just logged" dot are all ink on ground. The kcal arc and kcal figures are ink: kcal has no plate.

### Secondary (plates)
- **Protein Plate** (protein #4F7CFF), **Carbs Plate** (carbs #D2790E), **Fat Plate** (fat #C8384B): the macros. Value, arc, bar and source bars.
- **Fiber Plate** (fiber #3FAD3E), **Water Plate** (water #299FCD), **Caffeine Plate** (caffeine #854CDD), **Alcohol Plate** (alcohol #B24C74): the detail and drink areas. Value, bar, source bars, and the water plus on hover and press.
- Sugar, salt and the vitamins have no plate. They read in ink when fine and in alert with a word when over or low.
- In code, `plateOf(key)` returns a nutrient's ink (ink when it has none), `plateTint(key, amount)` a flat tint for zones and fills, and `ALERT` the attention colour (frontend/src/lib/plates.ts).

### Tertiary
- **Alert** (alert #FF6F91): attention, always with a word. Over a limit (sugar, salt, caffeine, alcohol), kcal over target, fat or carbs over target, or low on a goal. The word is "over" or "low"; colour alone never carries it.
- **Done Green** (done #3FCB7E): a supplement checked off, a thing completed. Never used for buttons, links or "under target".

### Neutral
- **Ground** (g0): the page, the tab bar, the sidebar, the band behind the Log food bar, the search field fill.
- **Raised Ground** (g1): the phone sheet, dialogs, wide-screen panels, hover fill on ruled cells.
- **Hairline** (g2): every divider and rule, empty track of arcs and scale bars, hover fill on icon buttons.
- **Control Edge** (g3): outlines of pill buttons, chips and inputs; disabled icons; the secondary text inside the ink Log food bar.
- **Quiet Text** (g4): labels, units, item lists, empty meal names, inactive tabs. Raised from the contract's #6B6F6A for 4.5:1 contrast on g0 and g1.
- **Stepped Text** (g5): earlier meals, unchecked supplement names, the target tick on scale bars, outline hover edge, the bar fill of a nutrient without a plate.

### Named Rules
**The Seven Steps Rule.** The ramp g0 to ink is the only grey scale. No other neutral hex, no white or black alpha overlays standing in for a step.

**The Plate Rule.** A plate ink appears only on its own nutrient's data: its value, its bar, its arc, its source bars in the sources dialog. Fat red is fat, water cyan is water. A plate is never an error, warning or "over" colour; that job belongs to alert alone.

**The Over In Alert Rule.** Over a limit, over a target or low on a goal is said with the word and alert together. The line under the figure reads "kcal eaten, 177 over 2400" with "177 over" in alert semibold (the figure stays ink); a limit cell shows "over" in alert beside its label and the overflow ("+12 g") in alert after the value, and its bar draws the overflow and the tick in alert past the target. Fat or carbs over target draw their bar overflow in alert; protein over target is just more protein and stays in its plate. Below a goal the bar itself stays calm.

**The Green Means Done Rule.** Done Green marks completion only. It is not the primary action colour and does not mean "on track".

### Colour science
The palette was validated with the dataviz skill's `validate_palette.js` on g0 (#0E0F0E): dark-surface lightness band L 0.48 to 0.67, chroma at least 0.10, colour-blind (CVD) and normal-vision separation within each group of up to three plates that sit side by side, and contrast of at least 3:1 against g0. Carbs amber #E9A23B was replaced by #D2790E because it failed the lightness band and sat too close to fat red for colour-blind readers; fat moved from #F0553F to #C8384B for the same separation. Do not nudge a plate value by eye: re-run the validator.

## Typography

**Display Font:** Host Grotesk (with system-ui, sans-serif), loaded through next/font as `--font-grotesk`
**Body Font:** Host Grotesk
**Label/Mono Font:** Host Grotesk; Geist Mono is loaded but not part of the poster world.

**Character:** One neo-grotesk does everything, from the 136px day figure to the 10px tab label; hierarchy comes from size and weight jumps, not from a second face. Tabular figures are switched on at the body, so every number sits in a column.

### Hierarchy
- **Display** (700, 6.5rem / 7.5rem / 8.5rem by breakpoint for three digits, stepping down for four and five, line-height 0.8, tracking -0.045em): the kcal eaten figure, sized by its digit count. One per screen.
- **Headline** (700, 4rem, tracking -0.04em): the amount being entered in the Log food sheet, set as a numeral on a rule.
- **Title** (600, 22px, tracking -0.01em): the day name in the top row ("Today", "Sat 25 Oct").
- **Figure** (500, 22px): a macro's value in its plate ink, with its target in Label size beside it.
- **Row** (500, 17px): meal names and kcal in meal rows; the Log food bar text.
- **Body** (400, 15px): values in ruled cells, food names in expanded meals and lists, supplement names.
- **Body small** (400, 13px): the line under the display figure, item lists under meals, chips, "Log to", secondary actions.
- **Label** (400, 12px): cell labels (Protein, Fiber, Water), units, portions, in g4.
- **Nav label** (500, 10px): tab bar labels under their icons.

### Named Rules
**The One Number Rule.** Each screen has one display-size number, and it answers the screen's question. Everything else is at least four times smaller.

**The Plain Label Rule.** Labels are sentence case at 12px in g4, sitting directly above their value. No uppercase tracked microlabels, no eyebrows above headings.

## Layout

A single column on phones, with 16px page gutters, built as a stack of full-width ruled bands: the top row (day left, previous/next right, hairline below), the hero band (172px, 196px from 400px wide, 260px from 640px), then equal-column hairline grids for macros, details and drinks (columns divide by 1px g2 rules, cells pad 12px to 14px vertically and the first cell has no left padding so its text aligns with the page edge), then the meals list.

Columns are equal fractions of the row (`repeat(n, 1fr)`), so the same quantity always lands in the same place. Meal rows use a fixed grid: optional 52px time column, flexible name column, 44px add button; times only appear when the day's meals actually have different times.

The Log food bar is fixed above the 60px tab bar on phones, full width on a g0 band with a g2 rule above, and a 96px spacer keeps it from covering content. The Log food sheet takes 92% of the dynamic viewport height, pads 20px, and pins its search field or Log button at the bottom in thumb reach.

From 768px the grid becomes two columns and from 1024px three, with 16px gaps; the poster spans the full width, meals take two columns, supplements one. From 1024px a 224px left sidebar replaces the tab bar and Log food moves into the top row as a pill button.

Touch targets are 44px minimum everywhere; list rows are at least 60px tall.

## Elevation & Depth

Flat. Nothing in the world casts a shadow. Separation comes from 1px g2 hairlines, and the only tonal step is g0 to g1 for things that sit on top of the page: the phone sheet, dialogs, and wide-screen panels. Dialogs dim the page with a light backdrop behind them rather than lifting with a shadow.

### Named Rules
**The Hairline Not Box Rule.** On phones a section is a band between two rules, not a box. If you reach for a border on four sides, a radius and a fill, you are building a card; use a top rule instead.

**The No Shadow Rule.** No `box-shadow` on any surface or control. State shows as a fill step (hover g1 or g2), an edge step (g3 to g5) or a brightness step in text.

## Shapes

The poster is square: rules, scale bars, arc strokes and ruled cells have no radius. Roundness belongs to things you touch or that move over the page. Buttons, chips, icon buttons and the search field are full pills; text inputs that are not the search use the 14px field radius; the amount entry has no box at all, only a rule beneath the numeral that turns ink on focus. The phone sheet rounds its top corners to 24px; wide-screen panels use the 14px panel radius and on phones lose their box entirely.

The arcs are quarter circles around the hero band's top right corner, 13px strokes stepping inward, kcal outermost in ink, then protein, carbs, fat, each over a g2 track, and they deliberately bleed off the edge. When kcal passes the target the kcal arc stays full (a quarter arc has no room for more) and a 3px alert cap marks its end; the text carries the number. Scale bars are 3px tall on a g2 track with a 1px g5 tick marking the target. The macro bars share one absolute gram scale per day. Every detail and drink cell (fiber, sugar, salt, caffeine, alcohol, water) carries a limit bar: the fill runs to the value on a scale that leaves room for 50% past the target, the fill up to the target wears the nutrient's plate (g5 without one), a limit's tick turns alert once it is passed and the overflow is drawn in alert beyond it, a goal (fiber, water) shows nothing alarming below target and quiet g4 beyond it.

## Motion

Motion conveys state only: something changed, so it moves. Everything is eased out (`--ease-out`), short (150ms press, 220ms reveals, 500ms to 600ms value changes) and off under reduced motion. Tokens and utilities live at the end of globals.css (`--dur-fast`, `--dur`, `--dur-draw`, `.animate-bar`, `.animate-rule`, `.animate-lit`, `.animate-check`).
- The four arcs draw in once on first paint (700ms) and ease to new values after a log.
- The kcal figure, macro values and the water value roll to their new number when a log changes them (`useCountUp`); the first value of a page load never counts up.
- Scale bars grow from the left on first paint and ease on change.
- Motivation (streak cell stamp, digit roll, rule and check draws, the print pass, square paper confetti, the year grid ripple) follows the same rule: it marks something that just changed. The print pass is the single exception to the 700ms ceiling (up to about 1.1s including the text), runs only for a newly earned print, never on routine logging, and under reduced motion every one of these keeps its end state with no movement.
- A food just logged flashes its meal row and entry one step up the ramp (900ms) and settles; a day shown for the first time flashes nothing.
- A meal row opens by easing its height and opacity (220ms).
- The water plus presses to 0.9 and takes the water plate on hover and press; a supplement's check mark draws itself when taken.
- No decorative loops and no page-load sequence of sections.

## Components

### Buttons
Confident and quiet: ink when it is the action, an outline when it is one of several.
- **Shape:** full pill (999px).
- **Primary:** ink fill, g0 text. On phones the Log food bar is 52px tall, 17px medium text, a plus icon and "Log food" left, the target meal ("to lunch") right in 13px g3. In the sheet the Log button is 48px full width and names its meal ("Log to lunch"). Pressed scales to 0.98 (off under reduced motion).
- **Outline:** transparent on ground, 1px g3 edge, ink 13px text, 40px to 44px tall ("Take", repeat-meal chips, the water plus). Hover moves the edge to g5.
- **Icon:** 44px round, g4 or g5 icon, hover fills g2 and turns the icon ink. Disabled icons drop to g3.
- **Focus:** 2px ink outline with 2px offset, on every control.

### Chips
- **Style:** 40px to 44px pills with a g3 edge and g5 or ink text at 13px medium. "Log to" meal and day chips open native pickers and carry a small chevron.
- **State:** selected is an ink fill with g0 text (the active unit, a food already added in this session). An "add unit" chip uses a dashed g3 edge.

### Cards / Containers
- **Corner Style:** 14px on wide screens; none on phones.
- **Background:** g1 on wide screens; transparent on phones.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px g2 all round on wide screens; a single g2 top rule on phones. Hover on interactive panels moves the edge to g3.
- **Internal Padding:** 20px on wide screens; horizontal padding drops to zero on phones so content aligns with the page gutter.
- **Section heading:** 15px medium ink left, a summary figure (total kcal) in g4 right, on one baseline.

### Inputs / Fields
- **Search:** 48px pill, g0 fill on the g1 sheet, g3 edge, search icon inset left, 16px text so phones do not zoom. A round 48px outline button for the barcode scanner sits beside it.
- **Amount:** the Headline numeral on a transparent field with only a g3 bottom rule; focus turns the rule ink. The selected text uses g3 behind ink.
- **Other fields:** 14px radius, g3 edge, transparent fill, ink focus edge.
- **Error:** a short line in 11px to 12px under the field.

### Navigation
- **Tab bar (phones and tablets):** seven equal tabs, 60px tall, on g0 with a g2 top rule, 20px outline icons at 1.5px stroke over 10px medium labels. Inactive g4 (hover g5), active ink with a 2px ink rule along the top edge of the tab, the way the grid marks everything else. Pads itself for the safe area.
- **Sidebar (from 1024px):** 224px on g0 with a g2 right rule, wordmark in bold 18px ink, 14px medium items with the same outline icons; inactive g4, active and hover fill g1 with ink text.

### Day Poster (signature)
The hero band, the macro row, the detail row and the drinks row described in Layout and Shapes. Each macro cell and detail cell is a button that opens the sources dialog for that nutrient (foods ranked with a 3px bar in the nutrient's plate ink, ink for sugar and salt, and a percentage). The water cell logs 250 ml from a round outline plus. Over limits follow the Over In Alert Rule. Fiber, water, caffeine and alcohol values and bars wear their plates.

### Meal Rows (signature)
Hairline rows: meal name and kcal at Row size on one baseline, the day's items at 13px g4 truncated beneath, a 44px plus to log into that meal. Brightness carries state: the current meal in ink, other logged meals in g5, empty meals in g4 regular weight. Tapping opens the meal's entries as a nested ruled list with portions in 12px g4 and kcal in g5; an entry logged in the last 15 minutes carries a 6px ink dot.

### Supplement Rows
Ruled rows: a round check that turns Done Green when taken, the name in ink when taken and g5 when not, the time of day in 12px g4 beside it, contributions in 12px g4 beneath, and an outline "Take" pill on the right.

### Motivation: the print shop
Streaks, day goals, prints and quests extend the poster instead of borrowing game art. They reward logging and consistency; nothing rewards eating less, and a missed day is never said in alert.
- **Streak band** (Today, under the poster): "Streak" label and the run in Figure size (its digits roll up when it grows), then the last 14 days as square cells in one row: ink logged, g2 empty, a g4 outline for today not logged yet, and g5 diagonal hatching for a day a freeze covered. A 3px g5 scale bar runs to the next streak print. Banked freezes are small hatched squares at the right. Logging the day's first food stamps today's cell (a short press, 420ms).
- **Day goals**: up to three equal cells under a rule, each a small quarter arc (the poster's corner shape) filling in the goal's plate (protein, water, fiber; meals and supplements in ink), the label in 12px g4 and the count in 13px. A done goal draws a Done Green check beside its label. When every goal is done a 2px Done Green rule draws along the bottom of the band. There is never a calorie goal.
- **Prints**: each achievement is a square print. Earned: a g1 sheet with printer's crop marks (1px g4 corners) just outside, the numeral (its threshold) in the area's ink, set huge and tight, the unit in 11px g4, the title in 12px ink and one small square per run (filled in the area's ink when earned). Not yet: an unprinted plate, a 1px g2 outline with the numeral in g3 and a 3px progress bar. A print's ink follows the Plate Rule: protein prints are protein blue, variety fiber green, water water cyan, everything else ink. Tap turns a print over (rotateY, 500ms) for its dates and what is left.
- **The print pass** (the one authored moment): a new print is pulled across the screen in a sheet: crop marks register (300ms, staggered), a g5 squeegee line wipes left to right leaving the print behind (800ms clip-path), the numeral counts up, then title and description rise in. Big runs throw square paper confetti in the print's own ink (all plates only for "Full plate", which is about every nutrient). One short haptic pattern. Celebrations can be set to quiet (a toast) or off in Settings, App.
- **Progress page**: the number of prints earned is the display number; then streak, longest and weigh-in weeks in Figure size, the year grid, this week's quests and the wall of prints by area.
- **Year grid**: one square per day in Monday-first weeks, brightness on the ramp for how complete the day was (g2, g4, g5, ink for a closed day). It ripples in diagonally (9ms per step) the first time it scrolls into view.
- **Quests**: ruled rows with the task, the count and a 3px bar in the area's ink; a done quest draws a Done Green check. One swap per week.
- **Weight**: the trend weight (smoothed) is the Body display number, with the day's scale reading beside it in 12px; a new low on the trend toward the goal draws one 1px ink outline ring outward from the figure. Weigh-in weeks show this week's three cells.

## Hidden Nutrients

Settings can hide any nutrient except kcal, so every screen is composed from what is visible, never from a fixed list with holes in it.
- **One flowing grid.** Fiber, sugar, salt, water, caffeine and alcohol share a single hairline grid, details first, then drinks. Columns come from the visible count: 1 is full width, 2 and 3 are one row, 4 is 2 by 2 on phones, 5 and 6 are 3 across. A short last row stretches its last cell so no hole is left. Rules are 1px gaps over g2, so only internal rules exist and nothing doubles. From 640px every visible cell sits in one row (up to six). Nothing visible drops the band and its hairline.
- **Macro row.** Equal columns for what shows; with no macros the row is gone. A lone macro spans the row with what is left (or "+n g over") opposite the value, and its bar runs full width with the target tick.
- **Arcs.** The kcal arc plus the visible macros only. Strokes thicken as arcs drop (30, 20, then 13px) while the outer edge stays put, so with only kcal the corner holds one bold quarter circle, not a thin line. The hero band keeps its height.
- **Sheets and lists.** The Log food amount preview has cells for kcal (ink) and the tracked macros (plate inks) only and recomputes its columns. Supplement contribution lines skip hidden nutrients and tint the nutrient name only when it has a plate. The wide-screen hydration panel disappears when water and caffeine are both hidden.
- **Check every preset.** Everything, Macros only and Calories and protein must each look planned, plus two macros hidden and one detail left alone.

## Do's and Don'ts

### Do:
- **Do** use only g0, g1, g2, g3, g4, g5 and ink for every neutral; g4 (#7D817C) is the lightest text allowed on g0 and g1 for small labels.
- **Do** set primary actions in ink with g0 text, and name where the action lands ("Log food to lunch", "Log to lunch").
- **Do** divide regions with 1px g2 hairlines and keep phone sections boxless.
- **Do** keep tabular figures on and put each quantity in its own fixed column of an equal-fraction grid.
- **Do** show over a limit or target in alert together with the word "over" (or "low" for a missed goal) and a plus sign on the overflow; never colour alone.
- **Do** give every nutrient area its own plate ink for value, bar and source bars, via `plateOf(key)`; sugar, salt and vitamins have none and read in ink.
- **Do** validate any new plate with `validate_palette.js` on g0 before it ships.
- **Do** show state by stepping brightness on the ramp (current in ink, past in g5, empty in g4).
- **Do** draw every macro bar on one absolute gram scale for the day, with a g5 tick at the target, and give every limit or goal cell a limit bar.
- **Do** let motion say what changed, eased out and under 700ms, and let reduced motion turn it off.
- **Do** keep touch targets at 44px and list rows at 60px or more.

### Don't:
- **Don't** use a plate ink for anything other than its own nutrient's data; fat red and carbs amber are never error or warning colours.
- **Don't** use alert for decoration, for a plate, or without its word.
- **Don't** use Done Green for buttons, links, progress or "on track".
- **Don't** reward low calories, deficits or a single day's weight, and never say a missed day or a broken streak in alert.
- **Don't** add box-shadows, gradients or tinted gradient tiles to any surface.
- **Don't** introduce greys outside the seven-step ramp, or any colour that is not a plate, alert or done.
- **Don't** put more than one display-size number on a screen.
- **Don't** add uppercase tracked microlabels or eyebrows above headings; labels are plain 12px sentence case.
- **Don't** wrap phone sections in rounded filled cards.
