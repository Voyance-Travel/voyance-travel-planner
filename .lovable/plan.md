## Bug 7: Transport mode change doesn't persist

`handleTransportModeChange` (EditorialItinerary.tsx:3162–3325) updates React state in three branches (optimize success, optimize-returned-no-data, optimize threw) but never persists to the DB and never reflects the new transport cost in the budget ledger. It also relies on a hardcoded fallback cost map duplicated across two of those branches.

### Fix

**1. Persist after every successful state mutation**

Refactor the three `setDays(prev => …)` blocks to compute the new days array up-front (or capture it in a `let nextDays` via the updater), then after `setDays`:
- Call `syncBudgetFromDays(nextDays)` so `activity_costs` reflects the new transport cost.
- Call `safeUpdateItineraryData(tripId, { days: nextDays, status, optionSelections, savedAt: new Date().toISOString(), metadata: { ...parsedMetadata, lastUpdated: new Date().toISOString() } })` and on failure fall back to `setHasChanges(true)` (mirrors the pattern just added to `handleUpdateActivityTime`).

This applies to all three branches: optimize-success, optimize-no-data, and the catch block.

**2. Replace hardcoded fallback cost map with shared helper**

The two duplicated `modeCosts` maps (lines 3248-3250 and 3287-3289) are the only client-side estimator and silently disagree with server logic. Extract into a single helper `src/lib/itinerary/transportModeFallbackCost.ts`:

```ts
// Mirrors supabase/functions/_shared/transit-mode.ts tier costs.
// Used ONLY when optimize-itinerary returns no usable cost.
export function transportModeFallbackCost(mode: string): number { … }
```

Both fallback branches in `handleTransportModeChange` import and call this helper. Helper marks the cost with `basis: 'fallback_estimate'` on the activity's `transportation.estimatedCost` so a follow-up cost repair can re-price it.

**3. Lock-respect (consistency with bug 6)**

Add a guard at the top of `handleTransportModeChange`: if the activity is locked (`isLocked || locked || lock_state === 'locked'`), show a toast and return.

**4. Dependency array**

Add `parsedMetadata`, `safeUpdateItineraryData`, `syncBudgetFromDays` to the `useCallback` deps (the first two are already module-scope/stable; `syncBudgetFromDays` is the important addition).

### Verification

- Change a transport mode, hard-reload before global Save → mode + cost still applied.
- Locked transport activity → toast, no change.
- With network offline / optimize edge function down → fallback path still persists, cost shows on card and in PaymentsTab.
- `bunx vitest run no-raw-itinerary-writes` still passes (uses sanctioned `safeUpdateItineraryData`).

### Files

- `src/lib/itinerary/transportModeFallbackCost.ts` (new)
- `src/components/itinerary/EditorialItinerary.tsx` (handleTransportModeChange only)
