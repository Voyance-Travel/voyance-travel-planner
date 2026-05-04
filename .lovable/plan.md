## Problem

When the user hasn't added flight details, Day 1 shows a hollow placeholder card:

> **7:00 AM — Arrive at Airport** · venue: *Airport* · Free

It sits directly under the "Add Your Flight" banner, so the user sees both the prompt and the empty result of having ignored it. For a luxury traveler this reads as broken/unfinished.

The placeholder is generated server-side (`compile-day-schema.ts` lines 280–339 and `repair-day.ts` lines 824–870) whenever `arrivalTime24` is unknown — it deliberately injects an "Arrival" / "Arrive at the Airport" card so the day has a believable opening sequence. That made sense before the dedicated arrival banner existed; now it duplicates it.

## Fix

### 1. Hide the placeholder at render time when no flight is set

In `src/components/itinerary/EditorialItinerary.tsx` (the `days` useMemo at line 1455), filter Day 1 activities through a `isPlaceholderArrival` predicate when `flightSelection` is empty. The predicate matches:

- title in {`Arrival`, `Arrive at Airport`, `Arrival at <Airport>`, `Arrival Flight`}
- category in {flight, travel, transport, transit}
- venue empty / `Airport` / `the Airport` / `… Airport`
- no airline / flight-number / carrier / confirmation
- not user-locked (`locked` or `isLocked`)

Once the user adds flight data, the predicate stops firing and the (now enriched) card returns.

### 2. Future-proof the generator

Add a comment + a one-line guard in `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (the `!hasArrivalFlight` block around 837) so the synthetic flight/transfer cards are skipped when the trip-level flight context is missing — the UI banner will own that surface. The compile-prompt arrival sequence in `compile-day-schema.ts` (lines 285–311 and 316–340) is reworded to *not* emit an "Arrival" placeholder when flight is missing; it still emits the hotel transfer + check-in steps so the day has structure.

### 3. Verification

- Open a trip without flights → the "Add Your Flight" banner appears; no orphan "Arrive at Airport" card below.
- Add a flight via the prompt → the enriched arrival activity appears with airline + airport code + correct time.
- Existing trips with the placeholder already persisted in `itinerary_data` show the cleaned view immediately (read-time filter, no migration needed).

## Files touched

- `src/components/itinerary/EditorialItinerary.tsx` — wrap `days` useMemo with placeholder filter (~25 lines)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — gate synthetic arrival flight on real flight context (~3 lines)
- `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts` — drop step 1 ("Arrival") from the no-flight prompt blocks; keep transfer + check-in (~15 line edits)

## Why this is safe

- Filter is read-only and explicitly bypasses any user-locked card, so manually-added arrival activities (Universal Locking memory) are preserved.
- No DB writes; no cost-row impact (these placeholders are already $0).
- Generator changes only affect *future* generations where flight is missing; trips with real flight data are untouched.

Approve to ship.