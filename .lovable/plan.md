

## Plan: Port 8 Critical Post-Generation Safeguards to Schema Path

### Problem
The schema path (`USE_SCHEMA_GENERATION = true`, lines 8700-9200) only has schema-level validation, gap filling, departure timeline, buffer enforcement, and meal dedup. It's missing **8 safeguards** from the old path (lines 2335-2750) that prevent weird/broken itineraries.

### Current Schema Path Post-Generation Pipeline (what exists)
1. Schema validation + auto-corrections (8700-8766)
2. Activity normalization (8771-8814)
3. Pre-arrival time filter on Day 1 (8816-8842)
4. Locked activity merge (8844-8900)
5. Gap filler (8902-8934)
6. Departure timeline validation (8936-8959)
7. Buffer enforcement — static 15min (8961-9035)
8. Meal dedup (9037-9096)
9. Final sort (9098-9109)
10. Enrichment (9112-9184)
11. Opening hours validation (9186+)

### What's Missing (port from old path)

**Gap 1 — Retry with validation feedback**: The schema path has no content validation retry loop. If AI produces 2 activities instead of 8, it ships. The old path (lines 1570-2731) retries up to `maxRetries` times, feeding `validateGeneratedDay()` errors back to the AI.

**Gap 2 — Hotel address correction** (old path 2335-2368): Overwrite AI-hallucinated hotel addresses on accommodation activities with actual booking data. Insert after normalization (~line 8814).

**Gap 3 — Departure day sequence fix** (old path 2468-2538): Ensure checkout comes BEFORE airport transfer on the last day. Swap and re-anchor times if wrong order. Insert after locked activity merge (~line 8900).

**Gap 4 — Departure day dedup** (old path 2540-2568): Remove duplicate airport/transfer/departure activities (AI sometimes generates 3+ airport blocks). Insert right after Gap 3.

**Gap 5 — Arrival day stripping** (old path 2571-2591): Strip "Arrival at Airport" / "Baggage Claim" activities by title on Day 1 since those are handled by the Arrival Game Plan UI. The current pre-arrival time filter (line 8816) only filters by time, not by title. Insert right after the existing time filter (~line 8842).

**Gap 6 — Activity deduplication** (old path 2731-2737): Call `deduplicateActivities(generatedDay, mustDoActivities)` to strip same-title/near-identical activities. Insert after all post-processing, before enrichment.

**Gap 7 — User preference validation** (old path 2620-2685): Validate that user-requested activities (skiing, surfing, hiking, etc.), budget, and light-dining preferences are honored. Currently no retry mechanism in schema path, so log warnings for now; full retry loop is Gap 1.

**Gap 8 — Transit-time enforcement** (old path 2379-2466): Replace the static 15-min buffer (lines 8961-9035) with smarter logic that uses each activity's `transportation.duration` field and applies venue-type-specific arrival buffers.

### Implementation Order

All changes go into `supabase/functions/generate-itinerary/index.ts`, in the schema path post-generation section.

1. **Insert Gap 2** (hotel address correction) — after normalization, before pre-arrival filter (~line 8814). Port the block from lines 2341-2368, adapting variable names (`generatedDay.activities` → `normalizedActivities`, hotel data from `flightContext`).

2. **Insert Gap 5** (arrival day title stripping) — right after the existing pre-arrival time filter (~line 8842). Port from lines 2574-2591.

3. **Insert Gap 3 + Gap 4** (departure sequence fix + departure dedup) — after locked activity merge (~line 8900). Port from lines 2468-2568.

4. **Replace Gap 8** (transit-time enforcement) — replace the static 15-min buffer block (lines 8961-9035) with the smarter transit-duration-based logic from lines 2379-2466.

5. **Insert Gap 6** (activity dedup) — after meal dedup, before final sort (~line 9096). Call `deduplicateActivities()` with `mustDoActivities`.

6. **Insert Gap 7** (user preference validation) — after Gap 6. Port from lines 2620-2685. Log warnings since there's no retry loop yet.

7. **Insert Gap 1** (retry loop) — wrap the AI call + all post-processing in a `for (attempt = 0; attempt <= maxRetries; attempt++)` loop. On validation failure, rebuild prompt with error feedback and retry. This is the largest change and touches the most code.

### Files Changed: 1
- `supabase/functions/generate-itinerary/index.ts` — add ~300 lines of ported safeguards to schema path

