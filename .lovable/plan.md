## Status check — most of this already shipped

Tracing the request against the current code:

| Step | Where | Status |
|---|---|---|
| 1. Add `isGenerating` to `getBudgetSummary` | `src/services/tripBudgetService.ts:652-660`, type at line 133 | **Already done** — reads `trips.itinerary_status` and treats `queued / generating / partial` as in-progress. Cleaner than the proposed `expected_activity_count` heuristic because activity counts are a noisy proxy. |
| 2. Pass through hook | `src/hooks/useTripBudget.ts:46, 92, 236` | **Already done** — exposed on the hook's return, and the summary query polls every 4s while generating so the indicator clears promptly when status flips. |
| 3a. Indicator on the Budget tab | `src/components/planner/budget/BudgetTab.tsx:938-1015` | **Already done** — applies `opacity-70 animate-pulse` to the total + remaining, and shows a "Calculating…" label in place of the budget bar. |
| 3b. Indicator on the prominent **Trip Total header** | `src/components/itinerary/EditorialItinerary.tsx` ROW 1 (lines ~6028–6126) | **Missing** — this is the $400 → $700 → $900 → $1,100 number the user is complaining about. |

So the real gap is **only the Trip Total header in `EditorialItinerary.tsx`**. The Budget tab is fine; the home/itinerary header is not.

## What's wrong with the header today

`EditorialItinerary.tsx:6036` renders:
```tsx
<span className="text-2xl font-bold text-foreground truncate">
  {formatCurrency(displayCost(totalCost), tripCurrency)}
</span>
```
…which reads from `financialSnapshot.tripTotalCents` (a separate snapshot built from `activity_costs`). It re-renders on every poll while activity_costs rows are still being inserted, but has no visual hint that the number is provisional. Same for the reconciliation chip strip at lines 6107-6124 ("Days (group) + Hotel + Flights + Reserve = Trip Total") — those numbers also climb silently.

## Plan — minimal scope, header-only

### Step A — Source `isGenerating` in `EditorialItinerary`
`useTripBudget` is already called on line 3333 for `settings`. Pull `isGenerating` off the same call:
```ts
const { settings: budgetSettings, isGenerating: isBudgetCalculating } =
  useTripBudget({ tripId, totalDays: days.length, enabled: true });
```
No new query, no extra round-trip. Single source of truth for "still calculating" already lives in the hook.

Edge case: when `budgetSettings === null` (user hasn't set a budget) the hook still returns `isGenerating` from the summary, so this works regardless of whether the user opened the Budget tab.

### Step B — Visual indicator on Trip Total (Row 1)
Wrap the existing total-and-tooltip block (line 6034-6056) so:
- The total digits get `tabular-nums opacity-70 animate-pulse` while `isBudgetCalculating`
- A small inline pill renders next to the number: *"Calculating…"* (uses `Loader2` from lucide with `animate-spin h-3 w-3`, `text-muted-foreground text-xs`). Identical pattern to the BudgetTab indicator so the two views feel consistent.
- The `TripTotalDeltaIndicator` (the "+$340 just now" toast) is suppressed during calculation — those are noise, not real user-facing deltas. Pass `isGenerating` to it and have it render `null` when true. Avoids the surprise-swing label memory entry firing on every poll.

### Step C — Soft the reconciliation chip strip (Row 1, lines 6087-6125)
Apply `opacity-60` to the whole `<div>` inside the IIFE while calculating, so the "Days (group) + Hotel + Flights = Trip Total" chips visibly de-emphasise. Don't hide them — users still want to see the running breakdown.

### Step D — `aria-live` and a11y
Wrap the total in `aria-live="polite"` and `aria-busy={isBudgetCalculating}`. Screen readers currently re-announce the number on every poll; this lets AT decide.

### Step E — Don't touch
- `financialSnapshot.tripTotalCents` math is unchanged.
- BudgetTab is unchanged.
- `getBudgetSummary` is unchanged. The plan's proposed `expected_activity_count` heuristic is **rejected** in favour of the existing `itinerary_status` check — counts can lag by minutes when post-gen passes are still writing cost rows, which would leave the indicator stuck on after the trip is actually done.

## Verify
- Start a trip generation → Trip Total in the header pulses + "Calculating…" pill, reconciliation chips dim, no delta toasts fire.
- Generation completes → pill disappears within one 4s poll, total snaps to crisp.
- Reload page mid-generation → indicator shows correctly because `itinerary_status` is fetched server-side.
- Manual mode (no generation) → pill never appears (confirmed: `itinerary_status` is `'ready'` by `isManualMode`).
- BudgetTab indicator behaves exactly as before.

## Risk

Low. Touching one component, one new boolean, no math changes. The fact that `isGenerating` is already wired through means we're just consuming an existing signal.