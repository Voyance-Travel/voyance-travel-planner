# Plan: Stop the false "Itinerary is missing activities" banner

## What's actually wrong (confirmed by reading code)

Your analysis is right about the **classifier threshold**, but the user-facing trigger is one hop further back. Here's the precise chain:

1. **Backend** `supabase/functions/generate-itinerary/day-validation.ts:1397`
   ```ts
   if (dayCount >= 2 && paidMeaningfulCount <= 1) → 'incomplete'
   ```
   `paidMeaningfulCount` only counts activities whose `cost` is a numeric field (`cost: number` or `cost: {amount: number}`) AND title is not a placeholder. Approximate `~$35` strings, ledger-only costs, and costs that live only in `activity_costs` table all read as `0` here.

2. `action-save-itinerary.ts:1511-1517` → on `'incomplete'`, stamps `metadata.generation_failure_reason = 'incomplete_itinerary'` and flips `itinerary_status` to `'failed'`.

3. `action-save-itinerary.ts:1734` only writes `generation_failure_reason` inside the `emptyItineraryDetected ?` branch — **nothing clears the stamp** on a subsequent healthy save.

4. **Frontend** `EditorialItinerary.tsx:6259` → `pickBannerVariant` reads `generationFailureReason` from `trip.metadata` (`integrityBannerCopy.ts:103`):
   ```ts
   if (reason === 'incomplete_itinerary' && meaningful !== 0) → red banner
   ```
   So even a fully-populated 4-day trip with a stale tag from one bad earlier save shows the banner forever.

The FE mirror in `src/utils/itineraryCompleteness.ts:95` has the same flaw but isn't the rendering trigger here — the metadata stamp is.

## The fix — three small, scoped changes

### Change 1: Loosen the classifier in both copies

`supabase/functions/generate-itinerary/day-validation.ts:1395-1399` and `src/utils/itineraryCompleteness.ts:94-97`:

Replace the paid-count gate with a meaningful-count gate that actually maps to "skeleton hotel-only trip":

```ts
// Old:  if (dayCount >= 2 && paidMeaningfulCount <= 1) → 'incomplete'
// New:  if (meaningfulCount < Math.max(2, dayCount))   → 'incomplete'
```

Rationale: a real trip has at least ~1 meaningful activity per day; a skeleton has 0–1 total. This survives the approximate-cost / ledger-only-cost case completely. Keeps the original intent ("catch hotel-only output") without depending on cost shape.

### Change 2: Clear the stamp on a healthy save

`action-save-itinerary.ts:1732-1743` — extend the metadata patch so a save whose probe returns `'ok'` actively nulls the stale fields:

```ts
metadata: {
  ...(callerExtraUpdate?.metadata || {}),
  ...(emptyItineraryDetected
    ? { ...existingMetadataForEmpty, generation_failure_reason: failureReason, empty_itinerary_detected_at: new Date().toISOString() }
    : { generation_failure_reason: null, empty_itinerary_detected_at: null }),
  …
}
```

Same one-liner mirrored in `generation-core.ts:3160-3165` Stage-6 metadata patch so the chain-final write also self-heals legacy trips on next successful generation.

### Change 3: One-shot backfill (optional but recommended)

A single migration that nulls `metadata.generation_failure_reason` for trips where `itinerary_status IN ('ready','generated')` AND `(metadata->>'fully_persisted')::bool IS TRUE`. Heals already-stuck trips without waiting for the next save.

## Files touched

- `supabase/functions/generate-itinerary/day-validation.ts` (1-line threshold)
- `src/utils/itineraryCompleteness.ts` (1-line threshold, FE mirror)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (clear-on-ok branch)
- `supabase/functions/generate-itinerary/generation-core.ts` (clear-on-ok branch, Stage 6)
- One SQL migration (backfill)

No FE banner-render code changes; no `EditorialItinerary.tsx` edits.

## Out of scope (deliberately)

You raised two other findings — they're real but they're separate root causes and shouldn't be bundled into this fix:

- **Anne Frank House dropped.** Must-do coverage already exists (`mem://constraints/itinerary/must-do-coverage-injection`) with clock-gated scheduler + `injectMissingMustDos` + `MUST_DO_INJECTION_FAILED` health code. Either (a) the POI was seeded as a `should` not a `must`, or (b) `trip_day_intents` upsert silently wrote 0 rows (the JS dedupe bug closed earlier — `mem://constraints/itinerary/intent-upsert-expression-index`). Needs a trace of THIS trip's `metadata.quality.must_do_repair_attempted` + `trip_day_intents` rows before patching.
- **"Walk to airport" on departure.** A shared airport-transit classifier (`_shared/airport-transit-classifier.ts`) is already wired at repair-day §15z AND save-time STEP 2.67 (see `mem://constraints/itinerary/airport-transit-must-be-taxi`). If a departure-day card slipped through, the classifier's `isAirportTransitCard` predicate didn't match it — needs the actual offending card's `{category, subcategory, title}` to see which signal it lacked. Patching blind risks over-broadening the predicate and re-firing on legit short walks to nearby transit hubs.

Happy to spin both into their own plans once you confirm — they need 5–10 minutes of trace-reading first, not a guess.
