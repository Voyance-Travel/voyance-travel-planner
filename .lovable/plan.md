

## Decomposing the Monolith: Incremental Pipeline Architecture

### Phase 1: Kill Inline Duplicates ✅ DONE

Replaced the inline `generate-trip` (lines 12292-12903) and `generate-trip-day` (lines 12910-13465) blocks in `index.ts` with 3-line delegation calls to the already-extracted `action-generate-trip.ts` and `action-generate-trip-day.ts` handlers.

**Key finding**: The handlers were imported but never actually called — the inline duplicates were the ONLY active code path. This was the root cause of restaurant pool and hotel rotation bugs (the inline version didn't pass restaurant pools).

**Result**: ~1,170 lines removed. index.ts dropped from 13,491 → 12,322 lines. All 17 smoke tests pass.

---

### Phase 2: Extract `generate-day` to Action File — PENDING

**Scope**: Lines 7812-12248 (~4,436 lines) — the `generate-day`/`regenerate-day` handler.

**Blocker**: This handler has deep implicit dependencies on utility functions defined inline in index.ts (e.g., `parseTimeToMinutes`, `minutesToHHMM`, `addMinutesToHHMM`, `normalizeTo24h`, `filterChainRestaurants`, and many more). These must first be extracted into a shared utils module before the handler can be moved.

**Next steps**:
1. Audit all utility functions used by generate-day that are defined in index.ts
2. Extract them into `generation-utils.ts` (or similar)
3. Move the generate-day handler into `action-generate-day.ts`
4. Replace inline block with delegation call

---

### Phase 3: Extract `generate-full` to Action File — PENDING

**Scope**: Lines 5028-7810 (~2,782 lines) — the legacy `generate-full` handler.

Same dependency issue as Phase 2. Should be done after Phase 2 since the utility extraction will already be complete.

---

### Phase 4: Split `generate-day` Into Focused Steps — PENDING (after Phase 2)

Break `action-generate-day.ts` into:
- `steps/build-day-context.ts` — Hotel resolution, flight context, meal policy, restaurant pool
- `steps/build-day-prompt.ts` — Prompt assembly (archetype, DNA, dietary, weather)
- `steps/call-ai-and-parse.ts` — AI call, JSON extraction, retry logic
- `steps/post-process-day.ts` — Sanitization, dedup, enrichment, route optimization

---

### Phase 5: Dedicated Post-Generation Checks — PENDING (after Phase 4)

Clean post-processing pipeline:
1. sanitizeText → strip AI commentary, phantoms
2. checkDuplicateActivities → trip-wide dedup
3. checkDuplicateRestaurants → meal repeat swap from pool
4. validatePreferences → budget, dietary, pacing
5. addBuffersAndRoutes → travel times, reorder by proximity
6. enforceMealCompliance → inject missing meals
