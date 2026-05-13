# Fix: Health engine false-positive meal warnings

## Root cause — two compounding bugs

`TripHealthPanel.analyzeHealth` (src/components/trip/TripHealthPanel.tsx:116-183) flags missing meals via a two-step pipeline. Both steps fail on the trip in the screenshot:

### Bug A — `classifyMealSlot` is too strict (Days 1 + 2 + 3)

`classifyMealSlot` (line 551) only treats an activity as a meal when **category** (`dining|restaurant|food|cafe|breakfast|brunch|lunch|dinner|supper`) OR **title** matches the same regex OR an explicit `mealSlot` is set. The generator routinely emits real restaurants (Katsukura Sanjo Honten, etc.) tagged `category: 'cultural' | 'experience' | ''` with a bare venue title and no `mealSlot` metadata — exactly the pattern the §15z fix logged. Those rows return `null` from the classifier. The user sees "lunch and dinner are both there" while `detectedMeals.size === 0` or 1. Result: Day 2 flagged "missing lunch/dinner" even though all three meals are on screen.

### Bug B — `dayMode` resolution defaults to all-three on first/last day (Days 1 + 3)

When the trip has no `tripFlightSelection.outbound.arrival_time` / `return.departure_time` AND the day's persisted `metadata.quality.dayMode` / `requiredMeals` are absent, `inferDayModeFallback` returns `null` and the analyzer falls through to `['breakfast', 'lunch', 'dinner']`. On a Kyoto trip with hand-entered flights or chat-planner flights that didn't capture clock times, every arrival/departure day demands all three meals. Result: Day 3 (departure) flagged "missing breakfast/lunch/dinner" when the user expects only breakfast (or none).

The two bugs amplify each other: Bug B demands all 3 meals on a departure day, Bug A misses meals that ARE there → user sees the worst of both.

## Scope

Frontend/UI only. Single file `src/components/trip/TripHealthPanel.tsx` plus its existing test file. No backend, no schema, no persisted data changes.

## Fix

### 1. Broaden `classifyMealSlot` (Bug A)

Add a third "likely meal venue" branch that fires when the activity has **non-trivial restaurant signals** even when category/title regex misses:

```ts
function looksLikeMealVenue(a: any): boolean {
  // Logistics / bookends / transport never count.
  const cat = String(a?.category || a?.type || '').toLowerCase();
  if (/(transit|transport|transfer|flight|accommodation|hotel|check[\s-]?in|check[\s-]?out|return|shopping|museum|gallery|park|tour|wellness|spa|nightlife|entertainment)/i.test(cat)) {
    return false;
  }
  // Bar/drinks-only excluded by caller via DRINKS_ONLY_RE.
  const title = String(a?.title || a?.name || '').toLowerCase();
  if (/(museum|park|garden|tour|temple|shrine|gallery|market visit)/i.test(title)) return false;

  // Restaurant signals: any of these indicates a food venue.
  const meta = a?.metadata || {};
  if (a?.cuisine || a?.cuisineType || meta.cuisine || meta.cuisineType) return true;
  if (meta.is_meal === true || meta.isMeal === true) return true;
  if (a?.bookingRequired && /\b(reservation|table|seating|dinner|lunch|brunch)\b/i.test(String(a?.tips || '') + ' ' + String(a?.description || ''))) return true;
  // Common food-venue suffixes/keywords in the title (multilingual-tolerant).
  if (/\b(restaurant|trattoria|osteria|bistro|brasserie|kaiseki|ramen|sushi|izakaya|honten|honke|tonkatsu|teppanyaki|cafe|café|cantina|taqueria|cevicheria|asador|paladar|mesón|bouchon|maison|patisserie|boulangerie|konditorei|bakery|deli|gastropub|chophouse|steakhouse|pizzeria|enoteca|wine bar)\b/i.test(title)) return true;
  return false;
}
```

Then rewrite the head of `classifyMealSlot`:

```ts
const isDiningCat = DINING_CAT_RE.test(cat) || DINING_CAT_RE.test(title);
const looksLike = !isDiningCat && !explicit && looksLikeMealVenue(a);
const isDining = isDiningCat || !!explicit || looksLike;
if (!isDining) return null;
```

The rest of `classifyMealSlot` (explicit-wins → title-keyword → drinks-only exclusion → start-time window) stays as-is. Net effect: a "Katsukura Sanjo Honten" row at 12:30 with `category: 'cultural'` now returns `'lunch'`.

### 2. Conservative dayMode fallback (Bug B)

Replace the default-to-all-three branch in `analyzeHealth`:

```ts
// BEFORE
if (inferred) return inferred.requiredMeals;
return ['breakfast', 'lunch', 'dinner'];

// AFTER
if (inferred) return inferred.requiredMeals;
// First/last day with no persisted policy AND no flight clock to infer
// from — DO NOT demand all three meals. The backend would have stamped
// requiredMeals if it intended to enforce them; absence means we can't
// reason about arrival/departure context and should not generate
// false-positive warnings on those days specifically.
if (dayIndex === 0 || dayIndex === totalDays - 1) return [];
return ['breakfast', 'lunch', 'dinner'];
```

This honors the existing core meal-rules contract — middle days still require 3, only edge days where we genuinely lack signal stay quiet.

### 3. Add a "departure last-resort" branch to `inferDayModeFallback` (defense-in-depth)

In `src/lib/itinerary/inferDayMode.ts`, when departure clock is missing on the last day, fall back to the **last non-bookend activity end-time**. If that's < 14:00 → `early_departure` (breakfast only). 14:00–17:59 → `afternoon_departure` (breakfast). ≥ 18:00 → `evening_departure` (all 3). Mirror the symmetric `firstNonBookendStart` already used for arrival.

```ts
function lastNonBookendEnd(day: any): number | null {
  // Mirror inferArrivalMinsFromSchedule but tail-side.
  // Return latest non-bookend, non-transport endTime in minutes, or null.
}
```

Wire it into the `isLast` branch as the final fallback before returning null.

### 4. Tests

Extend `src/components/trip/__tests__/TripHealthPanel.classifyMealSlot.test.ts`:

- "Katsukura Sanjo Honten 12:30 cat=cultural → lunch" (the bug case)
- "Sushi Saito 19:30 cat=experience → dinner"
- "Kennin-ji Temple 12:30 cat=cultural → null" (must not classify temples as meals)
- "Walk to Gion 12:30 cat=transit → null"
- "Kissa Sarutahiko cafe 08:00 → breakfast" (already-passing parity)

Add a lightweight unit test for `analyzeHealth` (or a new `TripHealthPanel.dayModeFallback.test.ts`) covering:

- Last day with no flight clock + no persisted dayMode → returns `[]` (no missing-meal warning)
- Middle day with no flight + no persisted → still returns all three (regression guard)
- First day with arrival 14:00 + no persisted → `['lunch','dinner']` (existing inferDayMode behavior preserved)

### 5. Memory update

Extend `mem://constraints/itinerary/health-gap-day-scoping` (or create `mem://constraints/itinerary/health-meal-detection-tolerance`) noting:

- Classifier accepts cuisine/metadata/venue-suffix signals so generator category drift can't cause false-positive missing-meal warnings.
- `analyzeHealth` returns `[]` (no required meals) on first/last day when neither persisted policy nor flight clock is available — better to under-flag than spam.
- Backend `[MEAL_AUDIT]` log remains the source of truth; FE health panel is best-effort detection only.

## What this does NOT change

- Server-side meal policy / repair pipeline / `[MEAL_AUDIT]` logs untouched.
- Middle-day full-day default still requires all three meals.
- Drinks-only exclusion (`DRINKS_ONLY_RE`) and time-window math unchanged.
- `sparseJsonLikely` recovering-warning branch unchanged.
- Other health checks (gaps, thin-day, conflicts, transit-overlap) untouched.

## Verification

- New tests pass; existing `TripHealthPanel.classifyMealSlot.test.ts` and `TripHealthPanel.cascadePreview.test.ts` still pass.
- Manual: reload the trip in the screenshot — Days 1, 2, 3 should drop their false missing-meal warnings (assuming the meal cards are visible on screen).
- Telemetry: no edge-fn impact; FE-only.
