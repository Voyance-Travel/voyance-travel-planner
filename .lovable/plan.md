# Day 1 — "Walk to Hotel · 3 hr 52 min" airport-to-hotel transfer fix

## Root cause

After Day-1 arrival-flight reconcile (§3b), the code looks for an existing airport→hotel transfer card before injecting a fresh locked one. The detector only matches titles that contain `transfer to`, `travel to`, or `airport pickup`:

```
supabase/functions/generate-itinerary/pipeline/repair-day.ts:1003-1010
const existingTransferIdx = activities.findIndex((a: any) => {
  ...
  return (cat === 'transport' || cat === 'logistics') &&
    (t.includes('transfer to') || t.includes('travel to') || t.includes('airport pickup'));
});
```

When the AI emits the connector as `Walk to Hotel Arts Barcelona` (or `Taxi to …`, `Metro to …`, `Ride to …`), none of those substrings match → `existingTransferIdx = -1` → §3b injects a *fresh* locked `Transfer to Hotel Arts Barcelona (45 min)` at index 1 while leaving the AI's original card in place. That AI card carries the LLM's raw walking estimate (≈18.5 km BCN → Barceloneta = `ceil(18500/80) = 232 min = 3 h 52 m`) and is what the user sees on Day 1.

The downstream safety nets don't catch it in this slot:

- `recomputeTransitCards` (timing-cascade Pass 1, the >180-min hard ceiling clamp) skips when there's no chronological non-transit *prev* neighbour — the arrival-flight card is itself transit/flight category, so the orphan walk between two transit/flight cards never reaches the prev/next coord lookup and bails (`if (!prev || !next) continue;` at line 579).
- `WALK_OVER_THRESHOLD` in validate-day catches it only when the card is still marked `method=walk` AND `transportation` is populated; AI-emitted free-text connectors with no `transportation` block slip past the title-fallback in some shapes (no day-1 anchoring hint).

## Fix (scoped — Day-1 arrival transfer only)

### 1. Broaden `existingTransferIdx` detector in §3b

`supabase/functions/generate-itinerary/pipeline/repair-day.ts` (~L1003).

Match the AI's free-form airport→hotel connector when it sits adjacent to the arrival-flight slot, regardless of verb. Concretely, also treat as the airport transfer any card where:

- index is within the first 3 positions of `activities`, AND
- category is `transport` / `logistics` / `transit` / `transfer`, AND
- title matches `/^(walk|stroll|taxi|cab|uber|lyft|rideshare|ride|metro|train|bus|tram|shuttle|drive|transit|transfer|travel)\b.*\bto\b/i`, AND
- the destination token in the title resolves to the hotel (case-insensitive substring match against `hotelName`, or `to (?:the )?hotel`, or `to your hotel`).

When matched, run the existing RECONCILE branch (already at L1015-1056 for the flight; mirror it for the transfer): rewrite title to `Transfer to ${transferHotelName}`, set `startTime/endTime` to `transferStartMins/transferEndMins`, `durationMinutes = transferMinutes`, `category='transport'`, `anchorSource='airport-transfer'`, `subcategory='airport_transfer'`, lock it, set `source='repair-airport-transfer-reconciled'`, add to `lockedIds`, and move it to index 1 (right after the flight card). Drop any *other* card in the first 3 slots that also matches the transit-to-hotel pattern (dedupe).

Push a repair: `{ code: MISSING_SLOT, action: 'reconciled_airport_transfer', before: '${wasTitle} @ ${wasStart}-${wasEnd} (${wasDur}min)', after: '${newTitle} @ ${transferStart}-${transferEnd} (${transferMinutes}min)' }`.

Log: `[Repair §3b] Reconciled LLM airport→hotel transfer "${wasTitle}" → "Transfer to ${transferHotelName}" (${transferMinutes}min)`.

### 2. Belt-and-braces in §15b WALK_OVER_THRESHOLD

`supabase/functions/generate-itinerary/pipeline/repair-day.ts` (~L3919). Today: `if (act?.subcategory === 'airport_transfer') continue;` (skip locked transfer).

Add the *inverse* guard so a walk card on Day 1, index < 3, with a hotel-name destination AND no prior non-transit neighbour, is treated as the airport transfer: rewrite method/duration/cost via `pickTransitFallback(null, 45, hotelName)` and mark `subcategory='airport_transfer'`. This catches any future detector miss without needing another round trip.

### 3. Cascade-clamp Day-1 hotel-transit case

`supabase/functions/_shared/timing-cascade.ts` — `isAirportish` regex (~L526). Extend with hotel-on-arrival heuristic: when the card is in the first 2 indices of Day 1 (caller passes `dayNumber`) AND the title matches `\bto\b.*\b(hotel|inn|resort|hostel|residence|apartments?)\b` OR includes the trip's hotel name, also treat as `airportish` (45-min fallback) instead of the generic intra-city 25-min fallback. Threads `dayNumber` + optional `hotelName` through `recomputeTransitCards` (additive; default to current behaviour when absent).

### 4. One-shot heal for already-persisted trips

New migration: for `itinerary_activities` where `day_number = 1` AND title regex matches `^(walk|stroll|taxi|…|travel)\b.*\bto\b` AND `duration_minutes > 90` AND there exists a sibling activity on the same day with `source IN ('repair-arrival-flight','repair-arrival-flight-reconciled','injected-arrival-flight')`:

- If a sibling row with `source LIKE 'repair-airport-transfer%'` exists on the same day → DELETE the long-walk row (it's the dupe).
- Otherwise → UPDATE the row: rewrite title to `Transfer to <hotel>`, set `start_time = arrival flight end_time`, `end_time = start_time + interval '45 min'`, `duration_minutes = 45`, `category='transport'`, lock, stamp `metadata.quality.airport_transfer_heal_v1 = true`.

Idempotent (skip when `metadata.quality.airport_transfer_heal_v1 = true`).

### 5. Tests

- Extend `supabase/functions/_shared/__tests__/arrival-flight-reconcile.test.ts`:
  - Day-1 input has `Arrival Flight 20:00–20:45` + `Walk to Hotel Arts Barcelona (232 min)` at index 1 → after §3b: index 1 is `Transfer to Hotel Arts Barcelona`, 20:45–21:30, locked, `subcategory='airport_transfer'`; no second transit-to-hotel card remains in the first 3 slots.
  - Same input but `Taxi to Hotel Arts Barcelona` → reconciled (verifies regex covers non-walk verbs).
  - Negative: a `Walk to Picasso Museum` card on Day 1 index 2 is NOT reconciled.
- New `supabase/functions/_shared/__tests__/timing-cascade-day1-hotel.test.ts`: 232-min walk to "Hotel Arts Barcelona" on Day 1 with no coords → clamp pass uses 45-min fallback.

## Files touched

- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (§3b detector + reconcile branch; §15b inverse guard)
- `supabase/functions/_shared/timing-cascade.ts` (signature: add optional `dayNumber`/`hotelName` to `recomputeTransitCards`)
- `supabase/functions/_shared/__tests__/arrival-flight-reconcile.test.ts` (extend)
- `supabase/functions/_shared/__tests__/timing-cascade-day1-hotel.test.ts` (new)
- One SQL migration (one-shot heal, idempotent)

## Out of scope

- Replacing `pickTransitFallback`'s 45-min default with a real Google-Directions lookup for the airport→hotel leg. The 45-min taxi default is the current product convention (matches `input.airportTransferMinutes || 45`); switching to a live distance lookup is a separate, larger change.
- Changing the v2 arrival-flight convention (already shipped in the prior turn).
- Display-layer tweaks to `TransitModePicker` / `TransitGapIndicator`.
