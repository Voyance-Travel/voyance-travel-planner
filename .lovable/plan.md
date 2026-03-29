

## Phase 3: Extract `generate-full` Pipeline

### Current State
After Phase 2, `index.ts` is 6,431 lines. The largest remaining block is the `generate-full` handler (lines 3567–6350, ~2,800 lines). The rest is shared infrastructure used by both `generate-full` and `generate-day`.

### Strategy

Extract in two steps — shared infrastructure first, then the handler.

---

**Step 1: Extract shared generation infrastructure into `generation-core.ts`**

Move these functions (used by generate-full, and potentially reusable):

| Function | ~Lines | Purpose |
|---|---|---|
| `prepareContext` | 473–824 (~350 lines) | Context preparation (Stage 1) |
| `generateSingleDayWithRetry` | 826–2511 (~1,685 lines) | Core AI day generation + retry |
| `generateItineraryAI` | 2514–2723 (~210 lines) | Batch orchestrator |
| `earlySaveItinerary` | 2725–2805 (~80 lines) | Early checkpoint save |
| `generateTripOverview` | 2807–2886 (~80 lines) | Overview builder |
| `triggerNextJourneyLeg` | 2888–2982 (~95 lines) | Journey chaining |
| `finalSaveItinerary` | 2984–3391 (~407 lines) | Full save with costs |

Total: ~2,900 lines into `generation-core.ts`

All these are pure functions that take `supabase` + data as arguments — no implicit scope.

---

**Step 2: Extract `generate-full` handler into `action-generate-full.ts`**

Move lines 3567–6350 (~2,800 lines) into a new file exporting `handleGenerateFull(supabase, userId, params)`.

It imports from:
- `generation-core.ts` (prepareContext, generateItineraryAI, finalSaveItinerary, etc.)
- `preference-context.ts`, `flight-hotel-context.ts`, `venue-enrichment.ts`
- `generation-types.ts`, `generation-utils.ts`, `action-types.ts`
- All other existing extracted modules

Update `index.ts` routing:
```typescript
if (action === 'generate-full') {
  return handleGenerateFull(supabase, authResult.userId, params);
}
```

---

### Result

| File | Before | After |
|---|---|---|
| `index.ts` | 6,431 lines | ~700 lines (routing + auth + rate limiting) |
| `generation-core.ts` | — | ~2,900 lines |
| `action-generate-full.ts` | — | ~2,800 lines |

`index.ts` becomes a thin router — imports, auth, rate limiting, and action dispatch only. All business logic lives in dedicated modules.

### Risk Mitigation
- Step 1 is pure extraction of standalone functions — no logic changes
- Step 2 is a block move identical to the Phase 2 generate-day extraction
- Smoke tests validate both steps
- `action-generate-day.ts` is unaffected (already extracted, imports from shared modules)

