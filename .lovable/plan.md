# Persistent Budget Delta Toast / "Reconciling…" never resolves

## Root causes

Two adjacent UI signals can latch on indefinitely:

1. **`TripTotalDeltaIndicator` ("−$306 just now")** — `useTripFinancialSnapshot.lastDelta` is set inside `fetchData` whenever the new total differs from the previous one, but is only cleared by (a) the user clicking ✕ (`acknowledgeDelta`) or (b) a `tripId` change. There is no auto-dismiss, no max age, and the "just now" copy keeps lying for the whole session. On Bali the delta survived because no later fetch produced a matching total, so the state stayed populated.

2. **"Reconciling…" hint (header strip + Payments tab badge)** — purely derived from `snapshotUnderChips || snapshotOverChips` (header) and `|estimatedTotal − displayedTotalCents| > $1` (Payments). When the two independent fetches genuinely disagree (stale `activity_costs`, regression-blocked write, etc.), the predicate stays true forever. There is no completion condition, no timeout fallback, and no recovery action.

3. **Trigger inconsistency across cities** — Payments-tab mount already dispatches a silent `booking-changed`, but the silent flag only suppresses the *toast* path inside the snapshot hook; it does NOT suppress `lastDelta` itself, so a tab switch can still latch a delta indicator into the header.

## What to change

### A. `useTripFinancialSnapshot` — bound the delta lifetime

`src/hooks/useTripFinancialSnapshot.ts`

- Add a `DELTA_AUTO_DISMISS_MS = 8_000` constant.
- After `setLastDelta(delta)` (≈ line 532), schedule a `setTimeout` (tracked in a ref so each new delta cancels the prior timer) that calls `setLastDelta(null)` after 8s. Clear on unmount and on `tripId` change.
- Inside the silent-event branch (`suppressed === true`), do **not** call `setLastDelta(delta)` at all — silent system reconciliations should never populate the header indicator. Move the `setLastDelta` call below the suppress check.
- Inside `fetchData`, when the new total **equals** `prevTotalRef.current`, also call `setLastDelta(null)` — convergence is the natural completion condition.

### B. `TripTotalDeltaIndicator` — defensive auto-fade

`src/components/itinerary/TripTotalDeltaIndicator.tsx`

- Add an internal `useEffect` that auto-dismisses after 8s using `onDismiss()`, keyed on `delta?.at`. Belt-and-braces alongside (A) — the component is stateless about its own age today.
- After 4s, swap "just now" for a static "recent" label so we stop lying about freshness even if the indicator is still on screen mid-fade.

### C. "Reconciling…" hint — completion condition + timeout

`src/components/itinerary/EditorialItinerary.tsx` (header strip ~L6259) and `src/components/itinerary/PaymentsTab.tsx` (~L1197).

- Extract a small `useReconcilingState(active: boolean, tripId)` hook (new file `src/hooks/useReconcilingState.ts`) that:
  - returns `{ visible, attemptedResolve }`.
  - while `active === true`, starts a 6s timer; on timer fire, dispatches **one** `sync-trip-cost-table` invocation (silent `booking-changed`) and waits another 4s.
  - if `active` is still true after the 10s total budget, returns `visible: false` and logs `[RECONCILING_TIMEOUT] tripId=… site=header|payments` once.
  - if `active` flips to false at any point, resets cleanly.
- Header strip: render the "Reconciling…" line only when `useReconcilingState(snapshotUnderChips || snapshotOverChips, tripId).visible` is true.
- Payments tab: same gate around the amber "Reconciling…" badge. When the hook returns `visible: false` post-timeout AND totals still disagree, render **nothing** (no green "Matches itinerary" badge — the existing equality check already prevents the lie; we just suppress the amber badge instead of leaving it stuck).

### D. Trigger consistency

- Payments-tab mount silent event already exists (~L271). Verify it lands before the snapshot's first delta computation by also setting `suppressNextToastRef` synchronously in the snapshot hook on `'payments-tab-mount'` — already covered once (B) lifts `setLastDelta` above the suppress check, since the mount event fires before any state-changing fetch.

### E. Telemetry

One-line `console.warn` sentinels (no toast):
- `[DELTA_AUTO_DISMISS] tripId=… ageMs=…`
- `[RECONCILING_RESOLVE_ATTEMPTED] tripId=… site=…`
- `[RECONCILING_TIMEOUT] tripId=… site=… totalsCents={a,b}`

These let us see in production whether the timeout is rare (good) or routine (means bug #4 still needs work).

### F. Tests

- `src/hooks/__tests__/useTripFinancialSnapshot.deltaLifetime.test.ts` — covers auto-dismiss after 8s, silent-event no-set, equal-total clear.
- `src/hooks/__tests__/useReconcilingState.test.ts` — covers fast-resolve, timeout-resolve attempt, post-timeout silent drop.

### G. Memory

Add `mem://constraints/finance/reconciling-and-delta-bounded-lifetime` and reference from index Core (one liner: "Delta indicator + Reconciling hint MUST self-dismiss within ≤10s; never latch across sessions.").

## Files touched

- `src/hooks/useTripFinancialSnapshot.ts` (delta lifetime + suppress reorder)
- `src/components/itinerary/TripTotalDeltaIndicator.tsx` (auto-fade + freshness label)
- `src/hooks/useReconcilingState.ts` (new)
- `src/components/itinerary/EditorialItinerary.tsx` (gate header hint)
- `src/components/itinerary/PaymentsTab.tsx` (gate amber badge)
- two new tests
- one new memory + index touch

## Out of scope

- The underlying disagreement between snapshot and chip sums (bug #4 territory — stale `activity_costs`, decomposition residuals). This plan only guarantees the *indicators* never lie; bug #4's reverse-resync work converges the numbers.
