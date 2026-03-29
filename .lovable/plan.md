

# Fix: Publish the fixes + guard remaining unguarded calls

## Root cause of the current error
The error `index-SuNP7A_H.js:2615:49429` is from the **old cached production bundle**. None of the guards or logging we've added over the last several messages are live yet. The production site must be republished.

## Remaining unguarded `.toLowerCase()` calls to fix before publishing

I found a few more spots that lack null guards:

| File | Line | Issue |
|------|------|-------|
| `EditActivityModal.tsx` | 53-54 | `currentValue.toLowerCase()` — safe by type but should be hardened |
| `ImportActivitiesModal.tsx` | 386 | `g.detectedLabel.toLowerCase()` — no null guard |

These are lower risk than the EditorialItinerary ones already fixed, but worth guarding for completeness.

## Implementation

### 1. `src/components/itinerary/EditActivityModal.tsx` (line 52-54)
Guard `currentValue` and `s` in the suggestion filter:
```typescript
const cv = (currentValue || '').toLowerCase().trim();
const filtered = suggestions.filter(s => {
  const sl = (s || '').toLowerCase();
  return sl !== cv && sl.includes(cv);
}).slice(0, 4);
```

### 2. `src/components/itinerary/ImportActivitiesModal.tsx` (line 386)
Guard `g.detectedLabel`:
```typescript
const cityIdx = days.findIndex(d => 
  (d.city || '').toLowerCase() === (g.detectedLabel || '').toLowerCase()
);
```

### 3. Publish
After these final guards, you need to click **Publish → Update** to push the new bundle to production and bust the stale PWA cache.

