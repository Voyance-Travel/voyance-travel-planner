## Fix: Run `pruneOrphanLateNightlifeBookend` before the cascade loop

### Problem
On Day 2 render, a stale "00:30 Return to Hotel" bookend (orphaned from a Day 1 nightcap) sorts to the head. `enforceTimingAndBuffers`'s cascade then anchors Day 2 chronology to 00:30 and pushes every real activity into 1–7 AM (Budapest: Parliament 1:47 AM, lunch 4:47 AM, dinner 11:02 AM).

### Fix
Single-line insertion in `supabase/functions/_shared/timing-cascade.ts`. Add a Pre-walk #3 call to the already-existing `pruneOrphanLateNightlifeBookend` (defined at line 637) immediately after Pre-walk #2 (line 431), so orphan bookends are removed *before* the cascade loop sees them.

### Change
After line 431 (`assignFloatingMealTimes(...)`), insert:

```ts
// Pre-walk #3: remove orphan late-nightlife hotel-return bookends BEFORE the
// cascade loop sees them. Otherwise a stale 00:30 "Return to Hotel" card
// anchors Day 2's chronology and the cascade pushes every real activity into
// 1-7 AM (Budapest Day 2: Parliament @ 1:47 AM, lunch @ 4:47 AM).
pruneOrphanLateNightlifeBookend(input as any[], { path: 'enforceTimingAndBuffers' } as any);
```

### Out of scope
- No changes to the cascade loop, cutoff filter, `pruneOrphanLateNightlifeBookend` itself, or any other function/file.

### Acceptance
1. `grep -n "pruneOrphanLateNightlifeBookend(input" supabase/functions/_shared/timing-cascade.ts` → 1 hit
2. `grep -c "pruneOrphanLateNightlifeBookend" supabase/functions/_shared/timing-cascade.ts` → ≥3
3. `grep -n "Pre-walk #3" supabase/functions/_shared/timing-cascade.ts` → 1 hit

### Manual test
Generate a trip with Day 1 nightcap ending past midnight. Day 2 must not show the 00:30 "Return to Hotel" card at the top, and subsequent activities must keep 7–9 AM start times.