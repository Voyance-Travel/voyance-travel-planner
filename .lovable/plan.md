## Bug 8: AI chat doesn't verify lock preservation

The chat path silently violates locks because three things are wrong:

1. **Flag mismatch.** Every lock check in `itineraryActionExecutor.ts` reads only `a.isLocked`. The Universal Locking Protocol uses `isLocked`, `locked`, `is_locked`, `lock_state === 'locked'`, plus source flags `user/manual/extracted/pinned`. A row locked via the editor's "Lock" toggle (which sets `locked: true` and/or `lock_state: 'locked'`) is invisible to the chat executor → swap/filter/regenerate happily replaces it.
2. **AI sees the wrong shape.** `ItineraryAssistant.tsx:130` only forwards `isLocked: a.isLocked` to the model. The system prompt asks the AI to "preserve_locked" but the AI literally cannot tell which rows are locked when only `lock_state` is set.
3. **No post-write verification.** `executeRewriteDayAction` and `executeRegenerateAction` send `keepActivities` IDs to the edge function and trust the response. If the backend drops or mutates a locked row, nothing notices.

### Fix

**1. Single shared lock helper.** Export `isActivityLocked(act)` from `src/lib/itinerary/persistDayContract.ts` (the existing `isLockedRow` already covers all flags + sources — promote it to an exported `isActivityLocked` and re-use). The signature: `(a: any) => boolean`.

**2. Replace every flag check in `itineraryActionExecutor.ts`** with `isActivityLocked`:
- Line 241 (`rewrite_day` keepActivities filter)
- Line 378 (`swap` pre-check)
- Line 486 (`regenerate_day` keepActivities filter)
- Line 546 (`pacing more_relaxed` removal pick)
- Line 681 (`filter` per-activity skip)

**3. Forward full lock state to the AI.** In `ItineraryAssistant.tsx`, the per-activity payload becomes:
```ts
isLocked: isActivityLocked(a),
```
so the AI's `preserve_locked` instruction has correct ground truth across all three lock representations.

**4. Post-write lock-violation guard for day-level rewrites.** Add a shared verifier in the executor:

```ts
function verifyLocksPreserved(
  before: Activity[],
  after: Activity[],
  dayNumber: number,
): { restored: Activity[]; violations: number } {
  const lockedBefore = before.filter(isActivityLocked);
  let violations = 0;
  const matched = new Set<number>();
  const result = [...after];

  for (const locked of lockedBefore) {
    const idx = result.findIndex(a =>
      (locked.id && a.id === locked.id) ||
      (activityTitle(a) === activityTitle(locked) && (a.startTime || a.time) === (locked.startTime || locked.time))
    );
    if (idx === -1) {
      // Backend dropped a locked row — re-insert verbatim.
      result.push({ ...locked });
      violations++;
    } else if (matched.has(idx)) {
      violations++;
    } else {
      // Force the original locked snapshot to win over any AI mutation.
      result[idx] = { ...locked };
      matched.add(idx);
    }
  }
  if (violations > 0) {
    console.warn(`[LOCK_VIOLATION] day=${dayNumber} restored=${violations} (chat executor)`);
  }
  return { restored: result, violations };
}
```

Call it inside `executeRewriteDayAction` and `executeRegenerateAction` immediately after the backend returns and before `mergeAccommodationActivities` / `updateTripItinerary`. When `violations > 0`, append to the result message: `"(restored N locked item${plural} the AI tried to change)"` so the toast user-facing text surfaces silently dropped rows.

**5. Also harden `executeFilterAction`** — its `if (activity.isLocked) continue` is the only guard inside the loop; switching to `isActivityLocked` is sufficient (no post-write needed since each swap is per-activity).

### Verification

- Lock an activity via UI (sets `lock_state: 'locked'` only). Ask chat "rewrite Day 2." Expect: locked item still in place, toast notes restoration if backend tried.
- Lock via legacy `isLocked: true`. Same flow. Same outcome.
- Manual/extracted rows (`source: 'user'/'extracted'`) — chat "swap my dinner on Day 3" returns "is locked and cannot be swapped".
- Filter "make it vegan" with one locked dining row — that row is skipped, others swap.
- Console shows `[LOCK_VIOLATION] day=N restored=K (chat executor)` if and only if backend tried to drop a locked row.
- `bunx vitest run no-raw-itinerary-writes` still passes.

### Files

- `src/lib/itinerary/persistDayContract.ts` (export `isActivityLocked`)
- `src/services/itineraryActionExecutor.ts` (5 flag-check replacements + `verifyLocksPreserved` in two executors)
- `src/components/itinerary/ItineraryAssistant.tsx` (single line: payload uses `isActivityLocked(a)`)

### Memory

After implementation, save a constraint memory `mem://constraints/itinerary/chat-executor-lock-preservation` describing the helper + post-write verifier so future chat-action additions don't re-introduce the bug.
