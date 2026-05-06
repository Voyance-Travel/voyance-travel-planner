## Problem

The Petit Palais activity is being rendered with a broken title: **"Explore the of Paris Museum"**. The AI dropped the word "City" between "the" and "of".

## Root cause

We already have a repair for this pattern (`\bthe\s+of\s+(?=[A-Z])` → `the City of `) in two places:

- `supabase/functions/generate-itinerary/sanitization.ts` (server-side, line 1075)
- `src/utils/activityNameSanitizer.ts` → `sanitizeActivityText()` (description sanitizer, line 182)

But it is **missing from `sanitizeActivityName()`** in the same file — the function used to render activity *titles* throughout the itinerary (`EditorialItinerary`, `LiveActivityCard`, `BookableItemCard`, `MyLockedActivities`, `ItinerarySummaryCard`, etc.).

So when the server-side repair fails to fire (legacy data, alternative-fetch, refresh-day, or any path that bypasses the main sanitization), the title leaks straight to the UI even though the description would have been repaired.

## Fix

Add the same orphan-article repair (and the `the's` → `the city's` repair) to `sanitizeActivityName()` so titles get the same protection as descriptions and server output.

### Code change (single file)

`src/utils/activityNameSanitizer.ts` — inside `sanitizeActivityName()`, before the duplicate-word logic, add:

```ts
// Repair orphaned "City" gap in titles (e.g. "Explore the of Paris Museum")
sanitized = sanitized.replace(/\bthe\s+of\s+(?=[A-Z])/g, 'the City of ');
sanitized = sanitized.replace(/,\s*the\s+of\b/gi, ', the City of');
sanitized = sanitized.replace(/\bthe'\s?s\b/gi, "the city's");
```

### Tests

Extend `src/utils/__tests__/activityNameSanitizer.test.ts` with a `sanitizeActivityName` case asserting:

- `"Explore the of Paris Museum"` → `"Explore the City of Paris Museum"`
- `"Walk the of dogs"` (lowercase next word) → unchanged

## Out of scope

- No backend / generation pipeline changes — server already repairs this on new generations. This is a defense-in-depth client patch covering legacy rows and any path that skips server sanitization.
- No DB migration to rewrite existing stored titles (the renderer fix covers all surfaces).
