

## Enforce Minimum Timing Gaps Between Activities

### Problem
Generated days sometimes have 11–15 activities with overlapping times (e.g., lunch at 12:30 + dinner at 1:00, nightcap at 12:30 PM). No post-generation enforcement exists to fix overlaps or mislabeled meals.

### Changes

**1. `supabase/functions/generate-itinerary/day-validation.ts` — Add `enforceTimingConstraints`**

Add a new exported function at the end of the file:

- Sort activities by `startTime` (using existing `parseTimeToMinutesLocal`)
- Enforce a 15-minute minimum gap: if activity N starts before activity N-1 ends + 15 min, shift N forward (preserving its duration)
- Relabel meal mismatches:
  - "Dinner" before 17:00 → "Lunch"
  - "Nightcap" before 20:00 → "Cocktails"
- Add a `minutesToTimeString` helper (24h format `HH:MM` to match the existing time format convention used throughout the codebase — NOT 12h)
- Operates on `StrictActivityMinimal[]`, returns the corrected array
- Skips shifting for transport/accommodation categories (these are anchored)

**2. `supabase/functions/generate-itinerary/index.ts` — Wire into post-validation pipeline**

Insert the call at ~line 3147, right after `sanitizeActivityTitles` and before the chain restaurant filter:

```typescript
// POST-VALIDATION: Enforce minimum gaps and fix meal-time labels
generatedDay.activities = enforceTimingConstraints(generatedDay.activities || []);
```

Also add it to the `action-generate-trip-day.ts` single-day generation path for consistency.

Import `enforceTimingConstraints` from `./day-validation.ts` in both files.

**3. Redeploy** the `generate-itinerary` edge function.

### Design Notes
- Uses 24h `HH:MM` format (e.g., `"14:30"`) matching the existing `timeRegex` validation at line 289–291
- Leverages the existing `parseTimeToMinutesLocal` already in `day-validation.ts`
- Meal relabeling complements the client-side `mealTimeCoherence.ts` utility but catches issues at generation time
- Activities past midnight (after shifting) are clamped to 23:45 to avoid invalid times

