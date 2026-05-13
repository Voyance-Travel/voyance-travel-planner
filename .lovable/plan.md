## Day-2 Pre-Dawn Cascade — Defense Layer

The midnight-orphan prevention work (`stripBookendsForPrompt`, parser stale-head drop, `dayChronoKey` wrap-aware sort, `Late Night` band) cures the *bookend* leak path and reorders display, but it does **not** cure the visible symptom for either of these two cases:

1. **Fresh generations**: the LLM, even with a clean prompt, can independently emit pre-dawn timestamps for a real activity (`Moco Museum 01:33`, `Walk through Jordaan 03:26`). Nothing currently rejects/normalizes that on the way in.
2. **Legacy persisted trips** (Amsterdam, etc.): the bad timestamps are already on disk. `dayChronoKey` only re-sorts them to the day's tail under a "Late Night" header — the user still sees "Moco Museum · 1:33 AM" on Day 2.

This plan adds a single normalization layer that catches both.

### Approach

Add `normalizeDay2PredawnCascade(day, dayIndex)` (`supabase/functions/_shared/predawn-cascade-normalize.ts` + frontend mirror at `src/lib/itinerary/normalizePredawnCascade.ts`).

For Day N ≥ 2, identify the **leading pre-dawn block** = consecutive non-bookend, non-locked, non-departure-logistics activities whose `startTime` is in `[00:00, 05:00)` AND whose `source` is **not** in the bookend allowlist (`bookend-readtime` / `bookend-overnight` / `bookend-validator` / `bookend-synthesized` / `late_nightlife_bookend`).

If the block exists and has ≥ 1 card:
- Compute `shiftMin = 9*60 − firstStartMin` (round so the first card lands at 09:00).
- Apply the same shift to every card in the block, preserving relative spacing.
- For the LAST card of the block: if its end overlaps the next non-shifted card's start, leave the cascade rule (`enforceTimingAndBuffers`) to settle the seam — no special-casing here.
- Stamp `metadata.normalized_predawn_cascade = { dayNumber, count, shiftMin }` on the day for telemetry.
- Sentinel: `[PREDAWN_CASCADE_NORMALIZE] day=N count=K shiftMin=±M`.

Locked / `manual` / `extracted` / `pinned` / `user_added` / `bookend-*` source / departure-logistics rows are **always exempt** (mirrors universal locking + bookend allowlist).

### Wire-in points

1. **Save-time, fresh-write net** — call inside `action-save-itinerary` `normalizeDays` step, immediately before `enforceTimingAndBuffers`. Catches any LLM output that slipped past prompt prevention.
2. **Generate-time, per-day repair** — call at end of `repairDay` in `repair-day.ts`, after `§16` cascade. Belt-and-braces.
3. **Read-time, legacy heal** — call inside `parseItineraryDays` Step 4 (after the existing stale-head bookend drop). Returns the normalized day for display **and** triggers a one-shot `safeUpdateItineraryData('self-heal-predawn-cascade')` from `TripDetail` when any day reports `normalized.count > 0`, so legacy persisted trips heal on first load (mirrors the existing sparse-JSON resync trigger).

### Out of scope (explicit)

- No prompt changes.
- No change to `stripBookendsForPrompt`, parser stale-head drop, `dayChronoKey`, or the `Late Night` band — they stay.
- No touching of `late_nightlife_bookend` source rows (those are legitimate 00:16 / 00:55 hotel-returns and are explicitly allowlisted).
- No backfill migration — heal happens lazily on first load via the parse-time path.

### Files

- new: `supabase/functions/_shared/predawn-cascade-normalize.ts`
- new: `src/lib/itinerary/normalizePredawnCascade.ts`
- edit: `supabase/functions/generate-itinerary/action-save-itinerary.ts` (call in `normalizeDays`)
- edit: `supabase/functions/_shared/repair-day.ts` (call after §16)
- edit: `src/utils/itineraryParser.ts` (call inside Step 4 map; expose `__predawnNormalizedDays` count on the parser result)
- edit: `src/pages/TripDetail.tsx` (one-shot self-heal trigger when count > 0)

### Tests

- new: `src/lib/itinerary/__tests__/normalizePredawnCascade.test.ts` — Amsterdam Day 2 fixture (Moco 01:33 + walks 03:26 / 06:31) → first card at 09:00, ~94-min relative spacing preserved; locked rows untouched; `late_nightlife_bookend` 00:55 untouched; departure-day untouched.
- new: parity test in `supabase/functions/generate-itinerary/__tests__/predawn-cascade-normalize.test.ts` — same fixture.

### Memory

Update `mem://constraints/itinerary/late-nightlife-no-next-day-bleed` with the 5th defense layer and add a Core line summarizing the heal contract.
