

## Extend Cross-Day Dedup to Cover Attractions & Museums

### Current State

The validation and repair layers already handle cross-day attraction dedup — `validateDay` flags "TRIP-WIDE DUPLICATE" for non-dining repeats, and `repairDay` removes them. However, two gaps allow duplicates like "Louvre Museum" (Day 2) / "Louvre Museum Exploration" (Day 4) to slip through:

1. **Prompt-level prevention is weak for attractions**: `previousActivities` only sends activity titles from the last 3 days. The AI doesn't receive venue/location names separately, so "Louvre Museum" as a title and "Louvre Museum Exploration" look different enough to the AI.

2. **Removed duplicates aren't replaced**: When repair strips a duplicate attraction, the day just loses an activity — no replacement is injected. This can leave a gap in the schedule.

### Changes

#### 1. Build and pass `usedVenues` list alongside `usedRestaurants` in `action-generate-trip-day.ts` (~line 392)

After building `previousActivities` from titles, also build a `usedVenues` list from `location.name` fields of all non-logistical activities across ALL previous days (not capped to 3 days like titles):

```typescript
const usedVenues: string[] = [];
for (const day of existingDays) {
  for (const act of (day?.activities || [])) {
    const cat = (act.category || '').toUpperCase();
    if (['STAY', 'TRANSPORT', 'TRAVEL', 'LOGISTICS'].includes(cat)) continue;
    const locName = (act.location?.name || '').trim();
    if (locName && locName.length > 3) usedVenues.push(locName);
  }
}
```

Pass `usedVenues` to the `compilePrompt` call alongside `usedRestaurants`.

#### 2. Add venue blocklist to prompt in `compile-prompt.ts` (~line 1035)

After the existing "Avoid repeating these specific venues/activities" block, add a dedicated venue blocklist:

```
VENUE DEDUP — DO NOT REVISIT THESE LOCATIONS:
The following venues/locations have already been scheduled on previous days. 
Do NOT include any of them again, even under a different activity title:
${usedVenues.join(', ')}

This applies to ALL activity types — museums, landmarks, parks, attractions, and restaurants.
If you need a museum, choose a DIFFERENT museum. If you need a landmark, choose a DIFFERENT one.
```

This is separate from the restaurant blocklist and covers ALL venue types.

#### 3. Add `usedVenues` param to `CompilePromptParams` type

Add `usedVenues?: string[]` to the params interface so it flows through cleanly.

### Files to edit

| File | Change |
|------|--------|
| `action-generate-trip-day.ts` | Build `usedVenues` from all previous days' `location.name` fields; pass to `compilePrompt` |
| `pipeline/compile-prompt.ts` | Add `usedVenues` param; inject venue blocklist into prompt after the activity avoid list |

### What we're NOT changing

- The validation layer (already catches dupes correctly)
- The repair layer (already removes non-dining dupes)
- Restaurant dedup (untouched, this extends it)
- Hotel/transport/logistics activities (excluded from venue tracking)

