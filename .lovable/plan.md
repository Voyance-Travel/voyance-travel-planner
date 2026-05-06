## Root cause

Real double-entry, not a render glitch. Day 2 of trip `a5f41a2b…` has **two** `activity_costs` rows tagged `dining` × $15:

| activity_id | in itinerary JSON? |
|---|---|
| `7834bb8d…` | ✅ live "Lunch at Mordi e Vai" |
| `44c1ae94…` | ❌ orphan — no matching activity in `itinerary_data` |

`usePayableItems` (`src/hooks/usePayableItems.ts:358-449`) iterates `activityCosts` in DB order. The two rows happen to be processed like this:

1. Row `44c1ae94` (orphan) → no direct id match → falls into orphan-rescue → pops the next unconsumed `(day=2, dining)` JSON activity, which is **"Lunch at Mordi e Vai"** (`7834bb8d`). It pushes a row using the live name + $15.
2. Row `7834bb8d` (legit) → direct id match in `activityNameById` → pushes a *second* row using the live name + $15.

Result: two identical "Lunch at Mordi e Vai @ $30" rows in All Costs and Payments, inflating the total by $30. (Compose IDs differ — `44c1ae94_d2` vs `7834bb8d_d2` — so the existing `presentItemIds` dedupe at the bottom doesn't catch them.)

The orphan-rescue's `rescueConsumed` set only blocks the *same JSON id* from being rescued twice; it doesn't block the *direct lookup path* from later claiming a JSON id that orphan-rescue already consumed.

There's a secondary, lower-urgency question of *why* an orphan `activity_costs` row even exists when generation does `DELETE+INSERT` per pass — likely a refresh-day / repair path that mints a new activity uuid without rewriting its cost row. Worth tracing but not required to stop the duplicate.

## Plan

### 1. Hook fix — make direct matches win, orphan-rescue fill in only

Refactor the loop in `src/hooks/usePayableItems.ts` (lines ~336-449) into two passes over `activityCosts`:

**Pass 1 — direct matches.** For every row whose `row.activity_id` is in `activityNameById`, push the payable item and add the JSON id to a new `claimedJsonIds: Set<string>`.

**Pass 2 — orphan-rescue.** For every row that did NOT direct-match in pass 1, attempt `popRescue`, but skip any candidate already in `claimedJsonIds`. Update `popRescue` to take `claimedJsonIds` as a guard (or filter the queue at pop time):

```ts
const popRescue = (dayNum: number, mappedCat: string): RescueEntry | null => {
  const queue = orphanRescueByDayCat.get(`${dayNum}|${mappedCat}`);
  if (!queue) return null;
  let cursor = rescueCursors.get(k) ?? 0;
  while (cursor < queue.length) {
    const entry = queue[cursor++];
    if (!rescueConsumed.has(entry.id) && !claimedJsonIds.has(entry.id)) {
      rescueCursors.set(k, cursor);
      return entry;
    }
  }
  return null;
};
```

Transit grouping (`transitByDay`) stays as-is; the same two-pass split applies because direct matches still beat rescue.

This fully resolves the user-visible duplicate without any DB changes — even if the orphan row keeps existing, it'll be silently dropped (no live JSON slot to rescue into).

### 2. Tests

Add a test in `src/hooks/__tests__/usePayableItems.test.ts`:

- One day with one live dining activity (id `B`).
- Two `activity_costs` rows: one stale (id `A`, no JSON match), one live (id `B`).
- Assert `items.filter(i => i.name === 'Lunch at Mordi e Vai').length === 1`.
- Assert `totalCents === 1 × $30`.

### 3. Backstop — prune orphan rows on next sync (deferred / out of scope)

The right long-term fix for the orphan is in the writer. Stage 6 generation already does `DELETE + INSERT`, so the orphan was written by another path. Candidates: `syncBudgetFromDays` (`EditorialItinerary`) and `budgetLedgerSync`. If we want to guarantee a clean ledger, add a "trim" step that deletes any `activity_costs` row for `trip_id` whose `activity_id` is not in the current `itinerary_data` after every save. **Skipping in this plan** — call it out so the user can decide whether to schedule it next.

## Files touched

- `src/hooks/usePayableItems.ts` — two-pass refactor + `claimedJsonIds` guard.
- `src/hooks/__tests__/usePayableItems.test.ts` — new test for stale-row dedupe.

## Out of scope

- Deleting / migrating the existing orphan row in this trip (they'll silently drop with the hook fix; user can also wait for the next save sweep if we add #3 later).
- DB-level unique constraints — the existing `(trip_id, activity_id)` index is correct; the duplicate isn't a unique-constraint violation, it's two *different* activity_ids resolving to the same JSON activity.
