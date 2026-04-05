

## Strip "Popular with locals" — Debug & Expand Coverage

### Root cause

There are **two sources** of "Popular with locals" text:

1. **Hardcoded in `day-validation.ts` line 989**: The meal-guard fallback literally writes `"Popular with locals — check opening hours on the day."` into the `tips` field of every fallback dining activity. This is the primary source — every Boutique Caffé card inserted by the meal guard gets this exact string.

2. **Incomplete field coverage in `sanitization.ts`**: The stub description stripping (lines 381-397) only checks `activity.description` and `activity.restaurant.description`. It never checks `activity.tips`, `activity.notes`, or any other nested text fields.

The frontend renders `activity.tips` prominently via `VoyanceInsight` and `VoyancePickCallout` components in `EditorialItinerary.tsx`, which is exactly the "light gray box with pin icon" the user sees.

### Plan

**1. Fix the hardcoded source in `day-validation.ts`**
- Replace the `"Popular with locals — check opening hours on the day."` string on line 989 with a useful, non-stub tip like `"Check opening hours before heading over — some spots close for afternoon breaks."`.

**2. Expand stub stripping in `sanitization.ts` to cover all text fields**
- After the existing `STUB_DESC_RE` block (lines 384-397), add a walk over all string properties on each activity (including `tips`, `notes`, `summary`, `local_tip`, `insider_note`) and nested objects (`restaurant`, `venue`, `place`).
- For short strings (<80 chars), test against `STUB_DESC_RE` and clear if matched.
- Also strip inline occurrences in longer strings using a `replace()` pass for the embedded pattern (same regex already used on line 168, but applied to `tips` and other fields too).

**3. Add inline stripping in `sanitizeActivityText` (frontend catch-all)**
- In `src/utils/activityNameSanitizer.ts`, add a `.replace()` to the `sanitizeActivityText` function that strips "Popular with locals" and sibling stub phrases even when embedded in longer text. This is the last-resort frontend guard since `EditorialItinerary.tsx` already pipes `activity.tips` through `sanitizeActivityText()`.

**4. Add temporary debug log in `sanitization.ts`**
- Before the stub stripping loop, add a `JSON.stringify` search for `"popular with locals"` to log which field contains it, for verification.

### Files to edit
- `supabase/functions/generate-itinerary/day-validation.ts` — fix hardcoded stub tip
- `supabase/functions/generate-itinerary/sanitization.ts` — expand field coverage
- `src/utils/activityNameSanitizer.ts` — add inline strip to `sanitizeActivityText`

### No changes to
- Generation pipeline architecture
- New files
- Frontend rendering components

### Verification
- Generate a Lisbon trip → search all rendered text for "Popular with locals" → zero instances
- Check console for the debug log confirming which field contained the text
- Confirm meal-guard fallback activities now show a meaningful tip instead of a stub phrase

