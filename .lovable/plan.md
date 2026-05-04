# Fix: "All Costs" list leaks raw schema, internal tags, and duplicates

## Root cause

`getBudgetLedger` in `src/services/tripBudgetService.ts` (line 381) sets the description with:

```ts
description: row.notes || `${row.category} (Day ${row.day_number})`
```

Two failure modes feed straight into the UI:

1. **Internal tags as description.** `row.notes` is the column the cost pipeline writes diagnostic flags into: `"[Free venue - Tier 1]"`, `"[Repair auto-corrected]"`, `"[Auto-corrected from $X, exceeded 3x ref high $Y]"`, `"[User override: …]"`. These are pipeline breadcrumbs (verified in DB: every notes value in the affected trip is one of those bracketed strings). When `notes` is set the ledger uses it verbatim.
2. **Raw category fallback.** When `notes` is null the fallback is the lowercase enum + `(Day N)` — `"dining (Day 1)"`, `"transport (Day 2)"`, `"cultural (Day 2)"`. No itinerary lookup, no friendly label.

The duplicate `transport (Day 2) — $7` rows are real twin `activity_costs` rows that the repair pass writes (we already saw `[Repair auto-corrected]` transport rows in the same trip); both get mapped to the same opaque label so the user sees them as identical.

The "Show all 25" button itself works correctly (`setShowAll(!showAll)` toggles a slice); the perceived breakage is that scrolling past 10 looks identical because the additional rows are more raw labels — the user assumes nothing happened.

## Fix

### File: `src/services/tripBudgetService.ts` — `getBudgetLedger`

1. **Fetch the trip's itinerary alongside `activity_costs`** so we can resolve `activity_id → title`. Also read `hotel_selection.name` and `flight_selection` to label day-0 rows.
2. **Resolve description in priority order:**
   1. Activity title from `itinerary_data.days[].activities[].title || .name`
   2. Hotel name (for `category='hotel'`, day 0) / `Flight (Airline)` (for `category='flight'`, day 0)
   3. Sanitized `notes` — strip any `[...]` segments before using
   4. Pretty category label + `(Day N)` — e.g. `Meal (Day 2)`, `Local transit (Day 2)`, `Activity (Day 1)`. Map of category → friendly noun (`dining→Meal`, `transport/transit→Local transit`, `cultural→Activity`, `hotel→Accommodation`, `flight→Flight`, etc.).
3. **Always sanitize `notes`** (`.replace(/\[[^\]]*\]/g, '').trim()`) before showing — never leak `[Free venue …]`, `[Repair auto-corrected]`, `[Auto-corrected …]`, `[User override: …]`.
4. **Dedupe identical rows.** After the map step, collapse entries that share `(day_number, category, amount_cents, normalized_description)`. This kills the twin `transport (Day 2) — $7` rows without affecting the canonical sum (the dropped row's amount is already represented by the surviving twin — and `v_trip_total` is the source of truth for the grand total, so no balancing needed).

### Out of scope

- No DB changes. `notes` keeps its diagnostic role for the validation triggers and audit; only the UI mapping changes.
- No edits to `CostsList` rendering or the "Show all" toggle — both work; the perceived breakage disappears once the descriptions read like real items.
- No change to category buckets, totals, or the recently-fixed payable-items hook.

## Acceptance

On the affected trip, the "All Costs (N)" list shows:

- Real activity titles (e.g. *"Lunch at L'Arpège"*, *"Louvre Museum"*) sourced from the itinerary.
- *"Four Seasons Hotel George V, Paris"* for the day-0 hotel row instead of `[Repair auto-corrected]`.
- Friendly fallbacks like *"Local transit (Day 2)"*, *"Meal (Day 1)"* when no JSON match exists.
- No `[Free venue …]`, `[Repair auto-corrected]`, `[Auto-corrected …]`, or `[User override …]` strings anywhere.
- No duplicate identical rows.
- Clicking *Show all 25 items* reveals all 25 (the toggle already works; rows are now distinguishable, so the expansion is visually obvious).
