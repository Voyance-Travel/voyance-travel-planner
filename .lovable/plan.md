## Problem

The generator is producing wellness/spa activities with generic, non-bookable titles ("Private Wellness Refresh", "Spa Treatment", "Wellness Moment") and no venue identity, but with real cost ($261). Existing placeholder detection (`fix-placeholders.ts`, `validate-day.ts → checkGenericVenues`) only targets **dining** — it has no rules for wellness, and no fallback DB for spa venues. So these slip through validation untouched.

This is the same class of bug as the previously fixed "Café Matinal" / "Table du Quartier" generic-meal placeholders, just in the wellness category.

## Fix

Three layers, mirroring the dining placeholder pipeline.

### 1. Detect generic wellness/spa titles & venues

`supabase/functions/generate-itinerary/pipeline/validate-day.ts`

- Add `GENERIC_WELLNESS_TITLE_PATTERNS`:
  - `/^(private\s+)?(wellness|spa)\s+(refresh|moment|break|session|time|experience|treatment)$/i`
  - `/^(spa|wellness|massage|hammam|sauna|thermal)\s+(at\s+(a|the|your)\s+.*)?$/i` (no proper noun)
  - `/^(relaxing|rejuvenating|luxurious|private)\s+(spa|wellness|massage|treatment)/i` when the activity has no `location.name` or location equals "Your Hotel"/destination
- Add a new `checkGenericWellness()` invoked after `checkGenericVenues`. It flags `category === 'wellness'` (or title matching spa/massage/hammam/onsen) when **either**:
  - title matches a generic pattern, OR
  - `location.name` is empty / equals destination / equals "Your Hotel" / fewer than 4 chars,
  with `severity: 'error'`, `code: FAILURE_CODES.GENERIC_VENUE`, `autoRepairable: true`.

### 2. Repair: replace with a real wellness venue (or downgrade)

`supabase/functions/generate-itinerary/fix-placeholders.ts`

- Extend `INLINE_FALLBACK_RESTAURANTS` with a parallel `INLINE_FALLBACK_WELLNESS` map keyed by city → array of `{ name, address, price, description }` for the cities currently covered (paris, rome, berlin, barcelona, london, lisbon). Seed 2–3 vetted, real, named venues per city (e.g., Paris: Spa My Blend by Clarins at Le Royal Monceau, Spa Valmont at Le Meurice, Hammam Pacha; London: ESPA Life at Corinthia, Akasha at Hotel Café Royal; etc.).
- Export `getRandomFallbackWellness(city, usedNames)` and `applyFallbackWellnessToActivity(activity, fallback)` that set `title = "Spa Session at <Name>"`, `location.name/address`, `venue_name`, `description`, and clamp `cost.amount` / `cost_per_person` to the fallback price (which is also a real cost reference, not a hallucination).

`supabase/functions/generate-itinerary/pipeline/repair-day.ts`

- In the validator-driven repair dispatch (the same path that handles generic dining), add a wellness branch: when a `GENERIC_VENUE` failure is on a wellness activity:
  1. Try the wellness fallback DB for the day's city.
  2. If no city match, **downgrade the activity**: zero out the cost, retitle to `"Hotel Spa Time"` only when the trip has a real hotel name (use it: `"Spa Time at <Hotel>"`); otherwise drop the activity (it was a hallucinated line item).
- Log the repair as `{ action: 'replaced_wellness_placeholder' | 'downgraded_wellness_placeholder', before, after }` so it appears in `cost_change_log` / stage logs (per existing memory: silent repair attribution).

### 3. Prompt guardrail (preventive)

`supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` and `meal-policy.ts`-adjacent wellness guidance:

- Add a one-liner to the existing "no generic names" block: *"Wellness/spa activities must name a real, bookable venue (hotel spa, named day spa, or hammam). Generic titles like 'Private Wellness Refresh', 'Spa Time', 'Wellness Moment' are FORBIDDEN — use the venue name (e.g., 'Spa Valmont at Le Meurice')."*

### 4. Tests

`supabase/functions/generate-itinerary/fix-placeholders.test.ts`

- Add cases:
  - `"Private Wellness Refresh"` with no location → flagged as generic wellness.
  - `"Spa Session at Spa Valmont"` → NOT flagged.
  - Repair pass on a Paris wellness placeholder produces a named venue from the fallback DB.
  - Repair on a city without fallback data downgrades to `"Spa Time at <Hotel>"` with $0 cost.

## Files touched

- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — add wellness detector
- `supabase/functions/generate-itinerary/fix-placeholders.ts` — wellness fallback DB + apply helper
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — wire wellness repair into existing GENERIC_VENUE dispatch
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — prompt guardrail line
- `supabase/functions/generate-itinerary/fix-placeholders.test.ts` — coverage

## Out of scope

- Adding a global wellness Google-Places lookup (we mirror the existing dining pattern: curated fallback DB only, no new external API spend).
- Touching already-locked / user-pinned wellness activities — universal locking protocol is preserved; the repair only mutates AI-generated entries.

**Approve to implement?**