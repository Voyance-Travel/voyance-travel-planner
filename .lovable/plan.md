## Issue 2 Fix Plan — 525-minute "Travel to Transfer to the Airport"

### What's actually happening

The user has no return flight entered, only outbound. On Day 4 the system shows:
- A placeholder "Departure Flight" block at 10:05 AM (expected).
- Above it: **"Travel to Transfer to the Airport — 525 min"** (broken).

Two distinct bugs combine here:

1. **No-flight departure-day still emits a transfer card.** `enforceDepartureDayLogistics` (repair-day §15z, line ~4077) only *injects* an airport transfer when `hasFlight` is true. But the AI itself can emit "Transfer to the Airport" rows from the prompt template — and an upstream synthesizer adds a "Departure Flight" placeholder when none was entered, which then re-enters the flow as if a flight exists. So an `airport_transfer` row survives even with zero real flight data.
2. **No sanity ceiling on transit duration.** The consolidation pass in `repair-day.ts:4895-5010` collapses adjacent transports and only recomputes duration when **both** endpoints have coords (`fromCoords && toCoords`). The destination "Transfer to the Airport" has `location.address: ''` and no lat/lng, so the merge falls back to `last.durationMinutes || 15` — whatever the AI emitted. AI emitted 525 (≈ gap between previous activity end and the 10:05 flight). Nothing caps it. `recomputeTransitCards` only acts when neighbours have coords; otherwise it tags `transit_unverified` and leaves the duration untouched (line 528).

So the system has neither a value-sanity gate nor a "no-flight ⇒ no transfer" guard.

### What to change

1. **`supabase/functions/_shared/timing-cascade.ts`** — extend `recomputeTransitCards` to **clamp implausible durations** for transit cards even when coords are missing. Rule:
   - If `card.durationMinutes > 180` (3h) and the card is not coord-verified and not `isLocked`/`basis=user|booked`, clamp to a category-aware default:
     - airport/station/terminal in title or `subcategory: 'airport_transfer'` → **45 min**
     - other transit → **30 min**
   - Recompute `endTime = startTime + clamped`. Tag `metadata.transit_unverified = true` and `metadata.transit_clamped_from = <original>`. Emit a new repair entry `transit_duration_clamped` with `before`/`after`. Sentinel `[CASCADE] transit_clamped=K`.
   - This is a tight, defensible cap — anything over 3h on a single-city day transit is broken data, period.

2. **`supabase/functions/generate-itinerary/pipeline/repair-day.ts` (§15z `enforceDepartureDayLogistics`, lines ~4077-4133)** — when `hasFlight === false` (no real return-flight time available):
   - Do NOT inject a new airport transfer (already true).
   - Add: **drop any existing AI-emitted `airport_transfer` / "Transfer to Airport" / "Travel to Airport" row** on the departure day if `lockedIds` doesn't contain it and `isLockedRow` returns false. Replace it with a single soft prompt card:
     ```
     title: "Add your return flight to plan your departure"
     category: "logistics-placeholder"
     subcategory: "return_flight_missing"
     description: "We'll book your airport transfer once a return flight is entered. Tap to add it."
     durationMinutes: 0  (no time block, displays as a banner-style card)
     startTime: null, endTime: null
     source: "repair-no-return-flight-prompt"
     ```
   - Also drop the preceding orphan "Travel to Transfer to the Airport" connector (the 525 card) — `pruneOrphanTransits` style: any transport whose `title` references the dropped transfer.

3. **`supabase/functions/generate-itinerary/pipeline/repair-day.ts` consolidation block (lines ~4895-5010)** — when merging transports without coord-verified endpoints, **never inherit a duration > 180 min from `last.durationMinutes`**. Fall back to:
   - 45 min if destination name/title matches `/airport|terminal/i`
   - 30 min otherwise
   - Emit repair `transport_consolidation_duration_clamped`.

4. **Frontend (`src/components/ItineraryView.tsx` and the editorial card renderer)** — defense in depth. Any transit/transfer card with `durationMinutes > 180` AND no coord-verified flag renders as a soft warning chip ("Transfer time unverified — confirm before departure") instead of "525 min". Five-line guard at the duration-format site.

5. **Trace recorder** — extend the `flight_ingest` stage from Issue 1's recorder so the departure-day branch emits `return_flight_present: boolean` and `departure_transfer_action: 'injected'|'kept'|'dropped'|'clamped'|'prompt_card'`. Five minutes to debug next time.

### Files touched
- `supabase/functions/_shared/timing-cascade.ts` (clamp branch + repair type)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (§15z no-flight drop+prompt; consolidation duration cap)
- `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts` (record departure_transfer_action in trace)
- Frontend transit card renderer (soft warning render for unverified > 180 min)
- One unit test in `supabase/functions/generate-itinerary/__tests__/` covering: (a) 525 → 45 clamp, (b) no-flight ⇒ prompt card replaces transfer, (c) verified-coord 60-min transfer untouched.

### Acceptance criteria
- Trip with outbound flight only, departure day: **no "Travel to Transfer to the Airport — 525 min"**. Instead, a single "Add your return flight to plan your departure" prompt card; no orphan connector.
- Trip with both flights and real coords: transfer renders with coord-derived duration (45–90 min typical), unchanged.
- Trip with both flights but no airport coords: transfer renders with 45-min fallback (was: unbounded AI value).
- Trace shows `departure_transfer_action='prompt_card'` for no-flight case, `'clamped'` when 525 got reduced.
- Existing tests pass; new test covers all three cases.

### Out of scope
- Issue 1 (already shipped — Day 1 flight arrival).
- Backfilling persisted trips that already have a 525-min card — handled lazily on next save/parse pass via the same clamp.
- UI for "add return flight" deep link (the prompt card text is enough for v1).

No DB migration. Edge function + small FE renderer change.
