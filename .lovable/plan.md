## Goal
Stop the misleading "$400 → $700 → $900 → $1,100" climb during itinerary generation. The numbers are correct snapshots of a partial trip — we just need to label them as in-progress so the user understands.

## Source of truth
`trips.itinerary_status` (existing enum: `not_started | queued | generating | partial | ready | failed`).
`isGenerating === true` ⇔ status ∈ `{queued, generating, partial}`. Everything else (including `not_started` and `failed`) is `false`.

Why this over an activity-cost row count: the status field is already authoritative, set by `itineraryAPI.ts` at start/end of generation, and avoids guessing "expected" totals on multi-city/manual trips.

## Changes

### 1. `src/services/tripBudgetService.ts` — `getBudgetSummary` (~lines 614-683)
- Add `isGenerating: boolean` to the `BudgetSummary` return type (and the interface declaration above the function — find with rg).
- Inside `getBudgetSummary`, after fetching settings & ledger, do a lightweight read:
  ```ts
  const { data: tripRow } = await supabase
    .from('trips')
    .select('itinerary_status')
    .eq('id', tripId)
    .maybeSingle();
  const isGenerating = ['queued', 'generating', 'partial'].includes(tripRow?.itinerary_status ?? '');
  ```
- Include `isGenerating` in the returned object.
- One extra query per summary fetch is acceptable; summary is React-Query–cached.

### 2. `src/hooks/useTripBudget.ts` (lines 76-96, return shape)
- Extend `UseTripBudgetReturn` with `isGenerating: boolean`.
- Derive `isGenerating = summary?.isGenerating ?? false` and include it in the returned object.
- Also: shrink the React Query `staleTime` for the summary to ~5 s while `isGenerating` is true, by passing `refetchInterval: isGenerating ? 4000 : false` so the flag (and totals) refresh as generation progresses. Stop polling once status flips to `ready`.

### 3. UI — `src/components/planner/budget/BudgetTab.tsx`
The visible climbing total is on the progress bar / "used / remaining" row in this tab. Two surgical edits:

- Pull `isGenerating` from `useTripBudget`.
- Where the trip total / used amount is rendered (the progress bar block — find by ripgrep on `formattedBudget` / `usedPercent`):
  - When `isGenerating` is `true`, render a small inline pill **"Calculating…"** next to the total and apply `animate-pulse` + `opacity-70` to the numeric values, plus dampen the progress-fill color to `bg-muted` instead of the warning gradient.
  - Suppress the over-budget warning banner (`isOverBudget`) while `isGenerating` so we don't fire a red alert on a half-built itinerary. Also gate the Coach (`isCoachEligible(…)` block) on `!isGenerating`.
- Leave the "Loading budget…" full-page spinner alone — it's for the initial fetch, not generation.

Other consumers (`EditorialItinerary.tsx` only reads `settings`, so no change there. `tripBudgetCompanionsAPI.ts` does not consume `summary`.) are unaffected.

### 4. Verification
- Start a fresh trip generation: BudgetTab progress bar dims, "Calculating…" pill appears, no over-budget toast fires.
- After `itinerary_status='ready'`: pill disappears, totals stable, polling stops (verify no recurring `tripBudgetSummary` queries in the network tab).
- Manual / build-myself trips (status stays `not_started`): pill never shown — pre-existing behavior preserved.
- Failed generation (`failed`): pill cleared, totals shown as final.

### Out of scope
- Adding new DB columns or migrations (the enum already exists).
- Smoothing the climb itself (it's correct data, just unlabeled).
- Touching budget Coach internals beyond the eligibility gate.

## Files touched
- `src/services/tripBudgetService.ts` (return type + 1 query)
- `src/hooks/useTripBudget.ts` (return shape + conditional `refetchInterval`)
- `src/components/planner/budget/BudgetTab.tsx` (pill + dim + gates)