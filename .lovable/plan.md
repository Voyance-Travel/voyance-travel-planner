## Problem

`ItineraryAssistant.handleActionApply` shows `toast.success('Action applied')` (line 528) whenever `executeAction(...)` resolves with `result.success === true`. But the persistence inside the executor silently swallows failures, so the user can see the success toast even when nothing reached the database.

Two leak paths:

1. **Executor swallows save errors.** `updateTripItinerary` (`src/services/itineraryActionExecutor.ts:868`) is `void`. It calls `save-itinerary` via `supabase.functions.invoke`, and on error just `console.error`s. All five callers (`executeRewriteDayAction`, `executeSwapAction`, `executeRegenerateAction`, `executeFilterAction`, `executePacingAction`) `await updateTripItinerary(...)` then return `success: true` regardless of whether the row was written.
2. **Some action types have no executor-side persistence at all.** They hand `updatedDays` back to the caller and rely entirely on the parent. The parent (`TripDetail.tsx:3626` `onItineraryUpdate`) only calls `setTrip(...)` — no DB write. If the user navigates away before another save, the change is lost.

The user-visible symptom is identical in both cases: green toast, no persisted change.

## Fix

Treat persistence as part of the action contract. Surface failures all the way back to the toast.

### 1. `src/services/itineraryActionExecutor.ts`

- Change `updateTripItinerary` signature to `Promise<{ success: boolean; error?: string }>`.
  - Return `{ success: true }` after a successful `save-itinerary` invocation.
  - Return `{ success: false, error }` on `saveError`, fetch error, or thrown exception. Keep the existing `console.error`s.
  - Keep the existing "no raw fallback" comment intact.
  - Local trips (no row in `trips`) detected via `fetchError` of code `PGRST116` or empty `trip` → treat as `{ success: true, local: true }` so the local‑storage write path stays unaffected.
- In every caller that currently does `await updateTripItinerary(tripId, updatedDays)`, capture the result. If `!success`, return:
  ```
  { success: false, message: 'Changes could not be saved. Please try again.', error: persistResult.error, updatedDays }
  ```
  Affected functions: `executeRewriteDayAction`, `executeSwapAction`, `executeRegenerateAction`, `executeFilterAction`, `executePacingAction` (all 5 sites at lines 379, 510, 572, 686, 819).
- Keep `updatedDays` on the failure result so the UI can still reflect the optimistic change but mark the message as failed (consistent with the existing "failed" status the message gets).

### 2. `src/components/itinerary/ItineraryAssistant.tsx`

- In `handleActionApply`, after `executeAction`, only run the success branch (sortedDays state update, cost sync, "Action applied" toast, diff message) when `result.success === true`. The structure already branches on this; today the bug is upstream — the executor lies. Once the executor returns `success: false` on persistence failure, this branch flips automatically and the existing `toast.error('Action failed', { description: result.message })` fires.
- Add a small explicit guard: if the executor returns `success: false` but still includes `updatedDays`, do **not** call `setCurrentDays`, `updateLocalTripItinerary`, `onItineraryUpdate`, or the activity-cost sync — we don't want optimistic UI to mask an unsaved state. The user retries via the existing retry button on line 779.
- Refund the credits already spent for `creditAction` (REGENERATE_DAY / SWAP_ACTIVITY) when persistence fails, since the failure is on our side. Use the existing `spendCredits` mutation; refund is done by emitting the inverse via the established refund helper if one exists, otherwise fall back to a `console.warn` — confirm pattern by checking whether `refundCredits` / `spendCredits.refund` exists in `useCredits` before wiring (see clarification below).

### 3. `src/pages/TripDetail.tsx`

No code change required. The existing `onItineraryUpdate` parent callback stays as a sibling-state sync. Persistence is now the executor's responsibility, and on failure the executor will not have set `success: true`, so the parent state update simply won't happen (per item 2).

## Out of scope

- Direct UI mutations elsewhere in `EditorialItinerary.tsx` already flow through `safeUpdateItineraryData` per the established constraint; that path is untouched.
- The executor's `save-itinerary` call itself is unchanged — same backend pipeline, same meal guard / sweep / normalization.
- No DB migration.

## Verification

- Unit-style: simulate `save-itinerary` returning an error and confirm `executeRewriteDayAction` returns `{ success: false, message: 'Changes could not be saved...' }`.
- Manual: in chat, trigger a swap on a trip whose `save-itinerary` is failing (e.g. offline). Expect red "Action failed" toast and the message status badge flipping to "failed", **not** "Action applied".
- Lint: existing `no-raw-itinerary-writes` test still passes (no new raw writes added).

## Memory

Add `mem://constraints/itinerary/chat-action-persistence-contract` and reference it from the index Core block: "AI chat actions: executor must surface DB save failures; never toast success on a silent persistence drop."

## Clarification needed

Does `useCredits` (or whatever hook `spendCredits` comes from) already expose a refund path for failed actions? If yes, I'll wire it; if no, I'll leave a `[CREDIT_REFUND_PENDING]` console warning and skip refund this pass — your call.