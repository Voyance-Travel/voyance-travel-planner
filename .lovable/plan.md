# Same-Day "Tomorrow" Copy Fix

## Problem
On the departure day, AI-generated checkout/airport-prep descriptions read:
> "prepare for the 08:00 flight tomorrow"

…when the flight is later **the same day**. Existing scrub patterns (`FORWARD_REF_RE`, `TOMORROW_REF_RE` in `sanitization.ts`) only catch "tomorrow's adventure/exploration/excursion/day/visit" — they miss the literal pattern "the HH:MM flight tomorrow" and "tomorrow morning's flight".

The forward-ref filter in `action-generate-trip-day.ts` L1520-1530 and `generation-core.ts` L1639-1651 only inspects accommodation cards titled "Return to / Freshen up / Back to / Settle in" — checkout cards (`hotel_checkout`, departure transfers) are not covered.

## Fix (scrub-layer only — no business-logic changes)

Add a single shared helper `scrubSameDayTomorrow(text, { flightIsSameDay })` and wire it into the existing scrub passes. When the activity is on the departure day and the flight (or transfer) occurs the same calendar day, rewrite or strip "tomorrow" references in `description`/`tips`/`notes`.

### 1. New regex set in `supabase/functions/generate-itinerary/sanitization.ts`
- `FLIGHT_TOMORROW_RE` — matches: `the 08:00 flight tomorrow`, `tomorrow morning's 08:00 flight`, `tomorrow's flight`, `before tomorrow's checkout`, `for tomorrow's departure/transfer/airport`.
- Replacement strategy when `flightIsSameDay === true`:
  - `tomorrow morning's` → `this morning's`
  - `tomorrow's` → `today's`
  - `tomorrow` (trailing/leading adverb) → `later today` (or drop if it leaves a clean sentence)
- When `flightIsSameDay === false`, leave existing text alone (cross-day refs are valid on multi-day trips).

### 2. Widen forward-ref accommodation filter
In both `action-generate-trip-day.ts` (L1520-1530) and `generation-core.ts` (L1639-1651):
- Extend the category match to include `hotel_checkout` / `logistics` / `transit` when the title contains `checkout`, `check-out`, `airport`, `transfer`, `departure`, or `flight`.
- Pass `flightIsSameDay` (derived from existing flight metadata already in scope — `cityInfo.departureDate` vs the day's date) into `scrubSameDayTomorrow`.

### 3. Save-time net in `action-save-itinerary.ts` normalizeDays
Run `scrubSameDayTomorrow` over the last day's checkout/departure-logistics cards using the persisted `savedDepartureTime24` / `metadata.savedDepartureDate` already used by the departure-net (Core memory: "Meal Rules — Save-time net"). This catches legacy trips on reload.

### 4. UI sanitizer (`src/lib/itinerary/activityNameSanitizer.ts` chain)
Add the same regex to the existing `sanitizeActivityText` cascade so any persisted leak gets cleaned at render time without a regen.

## Files touched
- `supabase/functions/generate-itinerary/sanitization.ts` — add `SAME_DAY_TOMORROW_RE` + `scrubSameDayTomorrow` helper.
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — widen forward-ref filter, pass `flightIsSameDay`.
- `supabase/functions/generate-itinerary/generation-core.ts` — same widening.
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — add save-time net for departure day.
- `src/lib/itinerary/activityNameSanitizer.ts` — render-time cleanup for already-persisted trips.
- `supabase/functions/generate-itinerary/__tests__/sanitization.test.ts` (new or extended) — cases:
  - "prepare for the 08:00 flight tomorrow" + sameDay=true → "prepare for the 08:00 flight later today"
  - "tomorrow morning's flight at 08:00" + sameDay=true → "this morning's flight at 08:00"
  - same strings + sameDay=false → unchanged
  - non-departure-logistics card → unchanged

## Out of scope
- No changes to scheduling, anchors, prompt rules, or generation logic. This is a copy-correctness scrubber bounded to departure-day logistics cards.
- No memory entry yet — will add one on implementation completion under `mem://constraints/itinerary/same-day-tomorrow-scrub` referencing the 4-layer defense.
