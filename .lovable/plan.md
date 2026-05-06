## Problem

Travel Pace +10 ("Fast-Paced") isn't honored on generated days. Two symptoms on the user's Day 2:

1. A 2h20m midday "Freshen Up" hotel block (15:40–18:00) creating dead time.
2. A "Breakfast — find a local spot" placeholder card with no real venue.

Root causes:

- The repair pipeline (`supabase/functions/generate-itinerary/pipeline/repair-day.ts`) **never receives the pace score**, so its hotel-return / freshen-up logic runs identically for every traveler. It auto-injects a midday hotel return between lunch and dinner (line ~3479) and only caps freshen-up at 90 min (line ~2369) — but the AI sometimes returns 140-min blocks under a different category/title spelling that bypasses the cap.
- The nuclear placeholder sweep (`fix-placeholders.ts` line ~516) intentionally writes "Breakfast — find a local spot" when no fallback DB exists for the city. That's the right anti-stub behavior, but it leaves a visibly empty meal slot (and on Fast-Paced days that empty slot is double-painful because it should have been packed).

## Fix

### 1. Make the repair pipeline pace-aware

- Add `paceScore?: number` to `RepairDayInput` in `supabase/functions/generate-itinerary/pipeline/repair-day.ts`.
- Plumb the existing trait score through both call sites:
  - `supabase/functions/generate-itinerary/action-generate-day.ts` (~line 1171)
  - `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (~line 1354)
- Where the score lives: trip profile traits already loaded earlier in those handlers (see `tripProfile.traitScores.pace` in `action-generate-trip.ts` line 485). We just need to pass it down — no schema or DB changes.

### 2. Tighten freshen-up rules when pace ≥ 4 (Fast-Paced)

In `repair-day.ts`:

- **Midday hotel-return injection** (block at line ~3479, `if (!isDepartureDay) { ... lunch/dinner gap → insert freshen-up }`): skip entirely when `paceScore >= 4`. Fast-Paced travelers don't want a forced hotel detour between lunch and dinner.
- **Freshen-up duration cap** (block at line ~2369): tighten the cap to **30 min** when `paceScore >= 4` (vs the current 90). Also broaden the match so any `accommodation` card with title containing "freshen", or any non-structural accommodation card scheduled between two real activities, gets capped.
- **Freshen-up after check-in injection** (block at line ~3442, `injected_hotel_freshen_up`): skip when `paceScore >= 4` if there's already a real activity within 60 min after the transport — Fast-Paced should chain straight into the next activity.

### 3. Strengthen pacing prompt for high-pace days

In `archetype-constraints.ts` `buildPacingRules`, for `pace >= 4`:

- Add an explicit "NO midday hotel returns / NO freshen-up blocks unless arrival or pre-dinner change is required" line.
- Add "Buffers ≤ 20 min between consecutive activities. Long blocks (>60 min idle) = VIOLATION."

This stops the AI from generating the 140-min freshen-up in the first place.

### 4. Make unverified meal slots less wasteful on Fast-Paced

In `fix-placeholders.ts` `nuclearPlaceholderSweep` (line ~510 fallback branch):

- When the slot has no fallback DB, in addition to setting `__needs_meal_swap`, **trim the duration to 30 min** so it stops eating a 90-min block in the timeline. Keep the existing "find a local spot" title and `needsRefinement` flag — the UI already surfaces a swap CTA for it.

## Files to change

- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add `paceScore`, gate midday return + freshen-up cap on it.
- `supabase/functions/generate-itinerary/action-generate-day.ts` — pass `paceScore` into `repairDay`.
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — pass `paceScore` into `repairDay` (resolve from existing trait load near top of function).
- `supabase/functions/generate-itinerary/archetype-constraints.ts` — extend the `pace >= 4` block in `buildPacingRules`.
- `supabase/functions/generate-itinerary/fix-placeholders.ts` — trim duration on unverified meal slots.

## Out of scope

- Building real venue data for cities missing from the fallback DB (separate enrichment work).
- Frontend "Fix" affordance for `__needs_meal_swap` cards (already exists per the assistant chat path).
- Re-generating the user's existing Day 2 — they'll need to tap "Refresh Day" once these changes ship; the new pacing rules will apply to all subsequent generations and refreshes.
