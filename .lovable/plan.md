# Fix: Floating untimed card on departure day (Katsukura pattern)

## What's actually happening

`enforceDepartureDayLogistics` (§15z) in `supabase/functions/generate-itinerary/pipeline/repair-day.ts` has two prune branches for departure-day cards:

1. **Untimed drop** — fires only when `s < 0 && isDiningRow(a)`
2. **Post-cutoff drop** — fires only when `s >= cutoffMin` (and `s = -1` on untimed rows, so this branch never catches them)

When the generator emits a real restaurant like *Katsukura Sanjo Honten* but mislabels its `category` as `cultural` / `experience` / empty (common path: venue-search recycle, fallback-DB hit, AI hallucination on category), `isDiningRow` returns `false`, the untimed branch skips it, and the post-cutoff branch can't see it because it has no time. The card lands at the bottom of the day's sort with no timestamp — the exact Day 3 / Katsukura symptom the user has hit on 10 cities.

There's no good reason to keep ANY untimed non-logistics, non-locked, non-exempt card on a true departure day. Sort can't place it, §15z can't reason about it, the user always sees a floating card "after the airport transfer."

## Scope

Frontend/UI: none.
Backend repair-pipeline only. Two files. Already-tested gates (locked / userAdded / userEdited / isManual / extracted / pinned / preserveAsManualPick) preserved.

## Changes

### 1. `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — §15z

In the prune loop (around line 4070–4110), change the untimed-drop branch to fire on **any** non-logistics, non-locked, non-exempt card without a parsable time:

```ts
// BEFORE
if (s < 0 && isDiningRow(a)) {
  repairs.push({ ..., action: 'final_enforce_dropped_untimed_dining', ... });
  console.log(`[DEPARTURE_UNTIMED_DINING_PRUNED] ...`);
  continue;
}

// AFTER
if (s < 0) {
  // Untimed non-logistics card on a departure day is always wrong:
  // sort can't place it, §15z can't reason about it, the user sees a
  // floating card after the airport transfer. Drop regardless of
  // (mislabeled) category. Locked / userAdded / preserveAsManualPick
  // exemptions are already handled above.
  const action = isDiningRow(a)
    ? 'final_enforce_dropped_untimed_dining'
    : 'final_enforce_dropped_untimed_activity';
  const sentinel = isDiningRow(a)
    ? 'DEPARTURE_UNTIMED_DINING_PRUNED'
    : 'DEPARTURE_UNTIMED_ACTIVITY_PRUNED';
  repairs.push({
    code: FAILURE_CODES.LOGISTICS_SEQUENCE,
    action,
    before: `${a.title} @ <no-time> cat=${a.category || a.type || 'n/a'}`,
  } as any);
  console.log(`[${sentinel}] day=${dayNumber} dropped "${a.title}" cat="${a.category || a.type || ''}" (no startTime/start_time/time)`);
  continue;
}
```

Two sentinels (one per branch) so telemetry can distinguish "miscategorised dining" from "actually-non-dining" leaks — both should trend to zero, but they tell us where to harden the generator next.

### 2. Test — `supabase/functions/generate-itinerary/__tests__/normalize-start-time.test.ts` (or new `departure-untimed-prune.test.ts`)

Add two regression cases mirroring the Katsukura shape:

- **Case A:** Last day with a `category: 'cultural'` row titled "Katsukura Sanjo Honten" and no `startTime` / `start_time` / `time` → asserts row is removed and a repair with `action: 'final_enforce_dropped_untimed_activity'` is emitted.
- **Case B:** Same shape but `userAdded: true` → asserts row survives (universal-locking parity).

### 3. Memory update

Extend `mem://constraints/itinerary/canonical-time-field-promotion` with a one-liner noting §15z drops **any** untimed non-logistics non-locked non-exempt card on departure days, not just dining. Sentinels: `DEPARTURE_UNTIMED_DINING_PRUNED` (legacy, mislabeled) + `DEPARTURE_UNTIMED_ACTIVITY_PRUNED` (new).

## What this does NOT change

- The save-time net call site in `action-save-itinerary.ts` STEP 2.65 is unchanged — it already imports the same function, so the broadened prune flows through automatically.
- `isLogisticsRow`, `isLockedRow`, `isExempt`, the post-cutoff branch, the meal-near-transfer branch, checkout/transfer retiming — all untouched.
- Non-departure days, transition days, and `isHotelChange` days remain skipped (existing `(isLastDay || …) && !isHotelChange` gate).
- No FE changes; no schema changes.

## Verification

- New test passes; existing departure-day tests (`departure-day-combined.test.ts`, `save-itinerary-departure-day.test.ts`, `normalize-start-time.test.ts`) still pass.
- After deploy, grep edge logs for `[DEPARTURE_UNTIMED_ACTIVITY_PRUNED]` over a 24-hour window — frequency tells us how often the generator is mislabeling restaurants and points at the next root-cause fix upstream (category coercion in venue-search recycle).
