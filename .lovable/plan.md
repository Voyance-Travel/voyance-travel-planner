# L3 — Cost contract comment for refresh-day

Add an explicit "COST CONTRACT" block to the existing JSDoc header at the top of `supabase/functions/refresh-day/index.ts` (lines 1-15) so future contributors don't accidentally wire AI/LLM calls into this no-cost function.

## Change

Extend the existing header (don't replace — the POST/Returns shape doc is still useful) with:

```ts
/**
 * refresh-day — Lightweight validation pass for a single itinerary day.
 *
 * Re-validates timing, transit, operating hours, buffer gaps, and flags conflicts.
 * Returns issues AND proposed changes that users can accept/reject individually.
 *
 * COST CONTRACT: This function MUST NOT call AI/LLM gateways or billable
 * external services. It only:
 *   - Re-validates the day via validate-day
 *   - Re-runs deterministic repair-day normalizations
 *   - Applies the validation gate
 *   - Adjusts timing buffers
 *
 * If you need to call AI here, you must:
 *   1. Add a credit-spend gate (mirror useGenerationGate)
 *   2. Update the UI to surface the cost
 *   3. Update billing docs
 *
 * Skipping these steps will silently bill users — DON'T.
 *
 * POST { ... }  // (unchanged)
 * Returns { ... }  // (unchanged)
 */
```

## Verification

- `grep -c "COST CONTRACT" supabase/functions/refresh-day/index.ts` ≥ 1.
- No code paths change — comment-only.
