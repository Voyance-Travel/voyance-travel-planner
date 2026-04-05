

## Fix Cross-Day Dedup Regression — Never Remove Primary Meals Without Replacement

### Root Cause

There are two locations where dining activities get removed without checking if they're primary meals (breakfast/lunch/dinner):

1. **`action-generate-trip-day.ts` lines 918-925**: The "ZERO-TOLERANCE" path — when a cross-day duplicate restaurant has no pool replacement, it nulls the activity and filters it out. No check for whether it's a primary meal. No meal guard runs after this point.

2. **`generation-core.ts` lines 2196-2205**: The last-attempt trip-wide duplicate strip — removes activities by title match without checking if they're primary meals. The meal guard at line 2232 runs after this, so it *should* catch gaps, but only on the last attempt.

3. **`repair-day.ts` lines 522-523**: When a dining dupe has no pool replacement, it marks it for removal. This is less likely the culprit since the meal guard runs after repair, but it's still unsafe.

The most likely cause of the Day 2 missing dinner is location #1 (`action-generate-trip-day.ts`), because it runs **after** all pipeline guards and there's no subsequent meal check.

### Plan (3 files)

**File 1: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`** (lines 918-922)

Change the ZERO-TOLERANCE removal to protect primary meals. When no pool replacement exists:
- If the activity is a primary meal (`/\b(?:breakfast|lunch|dinner|brunch)\b/i` in title), **keep it** and log a warning instead of removing
- If it's non-essential dining (cocktails, nightcap, snacks), remove as before

```ts
// Replace lines 918-922
} else {
  const isPrimaryMeal = /\b(?:breakfast|lunch|dinner|brunch)\b/i.test(act.title || '');
  if (isPrimaryMeal) {
    console.warn(`[generate-trip-day] ⚠️ CROSS-DAY DEDUP: "${act.title}" repeats but is PRIMARY MEAL — KEEPING (duplicate > missing meal)`);
  } else {
    console.warn(`[generate-trip-day] 🚫 CROSS-DAY DEDUP: "${act.title}" repeats with no replacement — REMOVING`);
    dayResult.activities[i] = null;
  }
}
```

**File 2: `supabase/functions/generate-itinerary/generation-core.ts`** (lines 2196-2205)

Add primary meal protection to the last-attempt duplicate strip:

```ts
generatedDay.activities = generatedDay.activities.filter(a => {
  const title = (a.title || '').toLowerCase();
  const isDupe = duplicateTitles.some(dt => title.includes(dt) || dt.includes(title));
  if (!isDupe) return true;
  // Never strip primary meals
  if (/\b(?:breakfast|lunch|dinner|brunch)\b/i.test(a.title || '')) {
    console.warn(`[Stage 2] Keeping duplicate primary meal "${a.title}" — meal > uniqueness`);
    return true;
  }
  return false;
});
```

**File 3: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (lines 520-523)

Add the same primary meal guard:

```ts
// Non-dining or no pool replacement: mark for removal — BUT protect primary meals
const isPrimaryMeal = /\b(?:breakfast|lunch|dinner|brunch)\b/i.test(act.title || '');
if (isDining && isPrimaryMeal) {
  console.warn(`[Repair] Keeping duplicate primary meal "${act.title}" — no pool replacement, but meal > uniqueness`);
  continue;
}
indicesToRemove.push(vr.activityIndex);
```

### Files to edit
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — protect primary meals from zero-tolerance removal
- `supabase/functions/generate-itinerary/generation-core.ts` — protect primary meals from last-attempt duplicate strip
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — protect primary meals from repair duplicate removal

### Verification
Generate a 4-day Lisbon trip. Every full day should have breakfast, lunch, and dinner. Check edge function logs for "KEEPING" warnings to confirm the guard fires when needed.

