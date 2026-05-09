## RS.7 — Locked activity flag preservation

Three different parts of the pipeline check three different spellings of the locked flag (`locked`, `isLocked`, `is_locked`). When only one is set, downstream sanitizers silently treat the activity as unlocked and regenerate over user pins. Fix by stamping all three spellings at every read/write boundary.

### Changes

**1. `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts`** — three locked-load branches all need all three flag spellings:

- Branch 1 (lines ~349–371): DB load from `itinerary_activities`. Add `locked: true, is_locked: true` alongside the existing `isLocked: true`.
- Branch 2 (lines ~391–402): JSON fallback from `trips.itinerary_data`. Same triple stamp.
- Branch 3 (lines ~413–430): legacy keepActivities fallback. Same triple stamp.

**2. `supabase/functions/generate-itinerary/action-save-itinerary.ts`** — add a "STEP 2.93: NORMALIZE LOCKED FLAGS" pass just before the existing timing-cascade sweep (~L737). Walks every day's activities; if any of `locked`, `isLocked`, or `is_locked` is truthy, sets all three to `true`. Preserves explicit unlocked state (no flag → no flag).

```ts
for (const day of itineraryDays) {
  if (!Array.isArray(day?.activities)) continue;
  for (const act of day.activities as any[]) {
    if (act?.locked || act?.isLocked || act?.is_locked) {
      act.locked = true;
      act.isLocked = true;
      act.is_locked = true;
    }
  }
}
```

This guarantees the JSON snapshot persisted by `persistTripItinerary` AND the rows synced to `itinerary_activities` (via `action-sync-tables.ts` which already reads `a.isLocked || a.locked` at L140) carry consistent flags.

### Verify
- `grep -c "locked: true.*isLocked\|isLocked: true" supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts` → ≥ 1 (will be 3, one per branch).
- `grep -c "act.locked = true\|act.isLocked = true\|act.is_locked = true" supabase/functions/generate-itinerary/action-save-itinerary.ts` → 3.

### Notes / decisions
- Spec assumed a single DB-load block; the actual file has three separate locked-load branches. Patching all three since they all feed the same `lockedActivities` array.
- No DB schema change needed — `itinerary_activities.is_locked` already exists.
- Keeping the change additive (sets when truthy, never clears) so it can't accidentally unlock anything.