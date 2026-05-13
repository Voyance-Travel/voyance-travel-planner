## Plan: Fix P0a — Stop deleting activities past 23:30 in enforceTimingAndBuffers

### Scope
Single-file, single-block change in `supabase/functions/_shared/timing-cascade.ts`, lines 451-468.

### What changes
The current `activities.filter(...)` block drops (deletes) activities whose `startTime` exceeds the 23:30 cutoff after the cascade shifts compound. Meals and late activities get silently removed on every regenerate/save.

Replace the filter with an in-place clamp that preserves the activity:
- Clamp `startTime` to 23:29
- Recompute `endTime` preserving original duration (capped at 23:59)
- Emit an `overlap_fix` repair log instead of `dropped_past_midnight`
- Keep the `dropped_past_midnight` type in the union for backward compatibility, but remove it from the active code path

### Exact replacement
```typescript
// Clamp activities pushed past the cutoff back to 23:29 (was: drop). Content
// preservation is non-negotiable — users paid for these activities and meals
// and we never delete them on save/regen. UI can surface a warning that the
// day is overbooked, but cards stay visible.
const droppedIds: string[] = []; // intentionally empty — kept for return-shape compatibility
for (const act of activities) {
  const s = parseTime(act.startTime);
  if (s === null) continue;
  if (s <= cutoff) continue;
  if (lockedIds.has(act.id)) continue;
  if (isEndOfDayBookend(act)) continue;
  const e = parseTime(act.endTime);
  const originalDur = e !== null ? Math.max(15, e - s) : (Number(act.durationMinutes) || 30);
  const clampedStart = cutoff - 1; // 23:29
  const clampedEnd = Math.min(23 * 60 + 59, clampedStart + originalDur);
  const newStart = minutesToTime(clampedStart);
  const newEnd = minutesToTime(clampedEnd);
  repairs.push({
    type: 'overlap_fix',
    activityId: act.id,
    activityTitle: act.title,
    before: `${act.title} @ ${act.startTime}`,
    after: `${act.title} @ ${newStart}`,
    message: `"${act.title}" was pushed past ${minutesToTime(cutoff)} — clamped to ${newStart} to avoid deletion. Day may be overbooked.`,
  });
  act.startTime = newStart;
  (act as any).start_time = newStart;
  act.endTime = newEnd;
  (act as any).end_time = newEnd;
}
```

### Acceptance greps (run after apply)
1. `grep -n "Drop activities pushed past" supabase/functions/_shared/timing-cascade.ts` → 0 hits
2. `grep -n "Clamp activities pushed past" supabase/functions/_shared/timing-cascade.ts` → 1 hit
3. `grep -n "dropped_past_midnight" supabase/functions/_shared/timing-cascade.ts` → 1 hit (type union only)
4. `grep -n "return false" supabase/functions/_shared/timing-cascade.ts` → 0 hits in `enforceTimingAndBuffers` body
5. `grep -c "act.startTime = newStart" supabase/functions/_shared/timing-cascade.ts` → 1 hit

### Post-deploy verification
Regenerate a day that previously lost dinner/cocktail cards. Confirm dining count is preserved. No `dropped_past_midnight` log lines appear.