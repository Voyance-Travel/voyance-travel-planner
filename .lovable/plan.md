## Problem

Two coupled departure-day bugs on a trip with a 21:45 (9:45 PM) Day-4 flight:

1. **Lunch + dinner missing.** Meal policy correctly classifies it as `late_departure` and requires `[breakfast, lunch, dinner]`. The final per-day meal-guard runs with `latestTimeMins = departure − 180min = 18:45 (1125)`. The hardcoded dinner slot starts at 19:00 (`1140 > 1125`) so the guard *silently skips dinner* with `Skipping dinner — slot 19:00 is outside available window`. Lunch then also gets dropped downstream by `enforceDepartureDayLogistics` (§15z) when the card lands after the (mis-positioned) airport-transfer start, because §15z prunes non-logistics cards at/after transfer start.

2. **"Walk to Transfer to Airport — 1h 46m" persists.** The intra-city duration clamp in `timing-cascade.ts::recomputeTransitCards` detects `isAirportish` and clamps duration to 45 min, **but never changes the transit method.** The `sanitization.ts::enforceTransitModeByDistance` would override the method to taxi, but it only fires when the card is classified as a transit/walk card with known endpoints — synthetic "Transfer to Airport" cards from generation often skip it. Result: card renders as a 106-min walk to the airport.

Root cause for #1 is that the meal-guard treats `latestTimeMins` as a hard ceiling on the *meal slot start*, with no awareness that a late-evening flight has plenty of room for a *pre-transfer* dinner if the slot is moved earlier (e.g. 17:00–18:15) and §15z is aware that this dinner is intentional.

Root cause for #2 is that there is no single chokepoint that says "any card whose destination is an airport must be method=taxi/uber, duration capped at ~45 min, regardless of how the LLM tagged it."

## Plan

### 1. Departure-aware meal-slot shifting (`day-validation.ts::enforceRequiredMealsFinalGuard`)

- Add an optional `departureTime24?: string` to the `options` arg.
- When present and `mealType === 'dinner'`, compute an **early-dinner slot** that ends at `departureTime − bufferMins − transferMins − 30min` (default ~17:00–18:15 for a 21:45 flight). If that window is ≥75min and starts ≥16:30, override `fallbackTimes.dinner` to fit it.
- Mirror for `lunch`: if the standard 12:30 slot collides with airport transfer, shift earlier (11:30–12:30) but never before 11:30.
- Keep the existing "skip if outside window" branch as the final safety net.

### 2. Pass `departureTime24` into the guard at all 3 call sites

- `action-save-itinerary.ts` (line ~759) — already has `savedDepartureTime24` in scope, thread it into the `options` object.
- `action-generate-trip-day.ts` (final per-day pass, line ~2192) — already has `savedDepTime24Hoisted`, thread it.
- `v2/generate-trip-day-v2.ts` (line ~431) — pull from `facts.departure.time24`.

### 3. §15z exemption for meal-guard-injected pre-transfer meals

In `pipeline/repair-day.ts::enforceDepartureDayLogistics`:
- When dropping non-logistics cards at/after transfer start, **exempt** dining cards whose `tags` include `'meal-guard'` AND whose `endTime ≤ transferStart`. They're intentional pre-transfer meals, not "leisure crammed in after the airport run."
- This preserves the meal-guard's work and prevents the silent erosion the user is seeing.

### 4. Airport-transit hard classifier (new shared module)

New helper `_shared/airport-transit-classifier.ts`:
- `isAirportTransitCard(card)`: matches `subcategory === 'airport_transfer'`, OR title/description regex `/\b(airport|terminal|to (airport|terminal))\b/i` AND not a flight card.
- `enforceAirportTransitMode(card, { transferMinutes })`: when `isAirportTransitCard` is true:
  - Force `transportation.method` ∈ {`taxi`,`uber`} (default `taxi`).
  - Cap duration at `min(currentDuration, transferMinutes || 45)`.
  - Rewrite title prefix from "Walk to …"/"Travel to …" → "Taxi to …".
  - Stamp `metadata.airport_transit_classified = true` (idempotent).

Wire it into:
- `pipeline/repair-day.ts §15z` — run on every non-locked card on the last day.
- `pipeline/repair-day.ts §15b` (where `pickTransitTier` is currently called for ad-hoc transit repair).
- `action-save-itinerary.ts` final pass (mirrors §15z save-time net) — single loop over last-day activities.

### 5. Tests

- `__tests__/meal-guard-late-departure.test.ts`: 21:45 departure → guard injects lunch (12:30) AND dinner shifted to 17:00–18:15; both survive §15z.
- `__tests__/airport-transit-classifier.test.ts`: 5 cases — "Walk to Transfer to Airport" → taxi/45min; "Walk to airport terminal 2" → taxi; "Flight to LHR" → untouched (flight card); already-taxi → untouched; coords-known short walk to a non-airport venue → untouched.
- Extend `meal-policy.test.ts`: parametrize the existing `enforceRequiredMealsFinalGuard` tests with `departureTime24: '21:45'` and assert dinner is injected at the shifted slot, not skipped.

### 6. Memory

Update `mem/constraints/itinerary/departure-day-no-rushed-meal.md` (already references late-departure handling) with the new "late-departure dinner gets shifted earlier, not dropped" rule, and add a new `mem/constraints/itinerary/airport-transit-must-be-taxi.md` for rule #4. Update `mem/index.md` Core bullet for departure-day handling.

## Out of scope

- Re-routing the airport transfer to a real ground-transport vendor (Uber/Lyft pricing API). The classifier just stamps `method=taxi` with a flat ~$15 default fallback already used by `pickTransitFallback`.
- Changing the meal policy ladder (still `late_departure` → 3 meals). Only the slot *time* gets shifted, not the *count*.
- Day-1 arrival mirror (late-night arrival meal gating) — separate issue.

## Files touched

- `supabase/functions/generate-itinerary/day-validation.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/_shared/airport-transit-classifier.ts` (new)
- `supabase/functions/_shared/__tests__/airport-transit-classifier.test.ts` (new)
- `supabase/functions/generate-itinerary/__tests__/meal-guard-late-departure.test.ts` (new)
- `supabase/functions/generate-itinerary/meal-policy.test.ts`
- `mem/constraints/itinerary/departure-day-no-rushed-meal.md`
- `mem/constraints/itinerary/airport-transit-must-be-taxi.md` (new)
- `mem/index.md`
