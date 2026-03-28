

## Fix: Duplicate Attractions Across Days

### Problem

"Imperial Palace East Gardens" appears on both Day 1 and Day 4 with different titles and prices. The system has dedup logic but two gaps allow this through.

### Root Causes

**Gap 1 — Parallel batch blindness (Days 1-3 generated together)**

Days within the same batch (e.g., 1-3) are generated in parallel with no visibility into each other. The post-batch dedup at line 3212 only checks **exact title matches** — "Stroll the Imperial Palace East Gardens" vs "Imperial Palace East Gardens Exploration" have different keys, so both survive.

**Gap 2 — Cross-batch last-attempt acceptance (Day 4 sees Day 1)**

Day 4 (batch 2) does have Day 1 in its `previousDays`, and `validateGeneratedDay` correctly flags it as `TRIP-WIDE DUPLICATE`. But after max retries, line 3060 accepts the day anyway with the duplicate still present. The generate-day (single day regen) path at line 10842 strips flagged duplicates — the full generation path does not.

### Fix — Two changes in `index.ts`

**Change 1: Post-batch dedup uses concept similarity (line ~3212)**

Replace the exact-title Map lookup with the existing `conceptSimilarity` function (already defined in `day-validation.ts`). When a concept-similar duplicate is found across batches, **remove** the later occurrence instead of renaming it with "(Day X version)".

```typescript
// Import conceptSimilarity from day-validation (or inline the logic)
// For each non-logistics activity, check against all previously seen concepts
// If concept-similar match found on a different day → splice/remove the duplicate
// Log: "[Stage 2] Cross-batch dedup: removed "Imperial Palace East Gardens Exploration" 
//       from Day 4 (similar to "Stroll the Imperial Palace East Gardens" on Day 1)"
```

**Change 2: Strip trip-wide duplicates on last-attempt acceptance (line ~3060)**

When `isLastAttempt && !smartFinishBlocksReturn` and validation has `TRIP-WIDE DUPLICATE` errors, strip those activities before returning — matching the existing logic from the generate-day path (line 10842).

```typescript
// After line 3060, before deduplicateActivities call:
if (isLastAttempt && validation.errors.length > 0) {
  // Strip activities flagged as TRIP-WIDE DUPLICATE
  const duplicateTitles: string[] = [];
  for (const err of validation.errors) {
    const titleMatch = err.match(/TRIP-WIDE DUPLICATE:\s*"([^"]+)"/i);
    if (titleMatch) duplicateTitles.push(titleMatch[1].toLowerCase());
  }
  if (duplicateTitles.length > 0) {
    const before = generatedDay.activities.length;
    generatedDay.activities = generatedDay.activities.filter(a => {
      const title = (a.title || '').toLowerCase();
      return !duplicateTitles.some(dt => title.includes(dt) || dt.includes(title));
    });
    console.log(`[Stage 2] Stripped ${before - generatedDay.activities.length} trip-wide duplicates on last attempt`);
  }
}
```

### Result

| Before | After |
|--------|-------|
| Day 1: "Stroll the Imperial Palace East Gardens" + Day 4: "Imperial Palace East Gardens Exploration" | Day 4 duplicate stripped; only Day 1 visit remains |
| Post-batch dedup only catches exact title matches | Catches concept-similar venues across parallel batches |
| Last-attempt acceptance keeps flagged duplicates | Strips `TRIP-WIDE DUPLICATE` activities before returning |

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Post-batch dedup: use concept similarity + remove duplicates |
| `supabase/functions/generate-itinerary/index.ts` | Last-attempt: strip TRIP-WIDE DUPLICATE flagged activities |

