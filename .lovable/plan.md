

## Fix Cross-Day Restaurant Repetition (Time Out Market Lisboa on Day 1 and Day 4)

### Root Cause

The cross-day restaurant deduplication uses `extractRestaurantVenueName()` which produces an exact normalized string. If the AI generates "Time Out Market Lisboa" on Day 1 but "Time Out Market" on Day 4 (or vice versa), the normalized keys differ ("time out market lisboa" vs "time out market") and the dedup misses the match.

The existing architecture has THREE dedup layers, all using exact string matching:
1. **Prompt blocklist** (compile-prompt.ts) — tells AI not to reuse restaurants
2. **Per-day dedup** (action-generate-trip-day.ts ~line 901) — checks against `usedRestaurants` from metadata
3. **Failsafe sweep** (action-generate-trip-day.ts ~line 1375) — re-scans all days post-assembly

All three use `extractRestaurantVenueName()` with exact `Set.has()` comparisons, so name variations slip through.

### Plan

#### 1. Add fuzzy venue matching to `generation-utils.ts`

Add a `venueNamesMatch(a, b)` function that returns true if:
- Exact match (current behavior), OR
- One name contains the other (substring match for cases like "Time Out Market" vs "Time Out Market Lisboa"), OR
- Word-overlap ≥ 80% (catches minor word additions/removals)

```typescript
export function venueNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const smaller = Math.min(wordsA.size, wordsB.size);
  return smaller > 0 && intersection / smaller >= 0.8;
}
```

#### 2. Replace `Set.has()` with fuzzy matching in the failsafe sweep

In `action-generate-trip-day.ts` at the failsafe dedup (~line 1486), replace:
```typescript
if (allUsedRestaurants.has(venue)) {
```
with a helper that checks if `venue` fuzzy-matches any entry in `allUsedRestaurants`.

Similarly update:
- The per-day dedup at ~line 915
- The `usedRestaurants` extraction at ~line 1692 (to avoid adding near-duplicates)
- The `usedSet` checks in repair-day.ts

#### 3. Add `venue_name` and `location.name` to the per-day dedup check

At line 914, the per-day dedup only checks `act.title` and `act.location?.name`. Update it to also check `act.venue_name` and `act.restaurant?.name`, matching the failsafe sweep's broader field coverage.

#### 4. No new files, no prompt changes needed

The prompt blocklist is already comprehensive. The issue is the post-generation matching, not the prompt.

### Files to edit

| File | Change |
|------|--------|
| `generation-utils.ts` | Add `venueNamesMatch()` fuzzy comparison function |
| `action-generate-trip-day.ts` | Use fuzzy matching in per-day dedup (~line 915), failsafe sweep (~line 1486), and restaurant extraction (~line 1692) |

### Verification

- Generate a 4-day Lisbon trip — no restaurant should appear on more than one day
- Check console for "CROSS-DAY DEDUP" logs
- Specifically verify Time Out Market Lisboa doesn't repeat

