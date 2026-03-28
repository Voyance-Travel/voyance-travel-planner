

## Table-Driven Cost Architecture — Implemented

### What Changed

**Phase 1: Seeded cost_reference** — 300+ rows across 14 destinations (Hong Kong, Tokyo, Shanghai, Beijing, Austin, Barcelona, Paris, London, Bangkok, New York, Rome, Dubai, Singapore) plus `_global` fallback rows. Each city has dining, transport, activity, nightlife, and shopping categories with low/mid/high USD ranges.

**Phase 2: Generation pipeline** — Rewrote Phase 4 in `generate-itinerary/index.ts` to:
- Look up `cost_reference` by `(destination_city, category, subcategory)` instead of using AI-hallucinated costs
- Select `cost_low/mid/high_usd` based on the user's budget tier
- Fall back to global defaults, then hardcoded minimums, only when no reference exists
- Round all costs to nearest $5 for clean display (no more $15.25 dinners)
- Link each `activity_costs` row to its `cost_reference_id` for traceability

**Phase 2b: Prompt update** — Removed "PRICES ON EVERYTHING" instructions from `prompt-library.ts`. AI no longer estimates costs; costs are assigned post-generation from the reference table.

**Phase 2c: Budget scaling** — Budget scaling now rounds to nearest $5 instead of nearest cent.

**Phase 3: Trip Summary header** — `EditorialItinerary.tsx` now uses the DB financial snapshot as the sole source of truth. JS fallback only runs while snapshot is loading.

**Phase 4: Budget Coach guardrails** — Added explicit rules to budget-coach system prompt: never modify costs directly, only suggest swaps, all costs must come from reference pricing data.

### Remaining Work

| Item | Status |
|------|--------|
| Backfill existing trips with corrected costs | Todo — invoke `backfill-activity-costs` edge function |
| Remove legacy `estimateCostSync()` paths | Todo — clean up `usePayableItems.ts`, `EditorialItinerary.tsx`, `cost-estimation.ts` |

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Rewrote Phase 4 cost-writing to use cost_reference lookups |
| `supabase/functions/generate-itinerary/prompt-library.ts` | Removed cost estimation instructions from AI prompt |
| `supabase/functions/budget-coach/index.ts` | Hardened system prompt with cost guardrails |
| `src/components/itinerary/EditorialItinerary.tsx` | Trip Summary uses DB snapshot only |
| `cost_reference` table | Seeded with 300+ rows for 14 destinations |
