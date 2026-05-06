## Problem

"Café Matinal" still appears on Day 4 breakfast even though it matches our existing `AI_STUB_VENUE_PATTERNS`. The client-side mask in `sanitizeActivityName` only triggers when `opts.category` is provided AND contains `dining|restaurant|food|meal`. Breakfast slots commonly come through with `category` values like `"breakfast"`, `"cafe"`, `"coffee"`, or undefined, so the guard never fires and the stub leaks to the UI.

## Fix (frontend-only, presentation layer)

Update `src/utils/activityNameSanitizer.ts` so the stub-venue mask is applied whenever we can confidently identify the slot as a meal — not just when `category` literally contains "dining".

1. **Broaden `isDining`** to also match `breakfast | brunch | lunch | dinner | cafe | café | coffee | bar | drinks | bakery | bistro | brasserie`.
2. **Fall back when `category` is missing**: if `inferMealTypeFromTitle(name)` or `inferMealTypeFromTime(opts.startTime)` returns a meal type, treat the slot as dining for masking purposes.
3. Keep the existing behavior for non-dining categories (e.g. `cultural`) — only mask when we have evidence it's a meal slot.

No business-logic changes; backend stub filtering already exists and stays as-is.

## Tests

Extend `src/utils/__tests__/stubVenueDetection.test.ts`:
- `Café Matinal` with `category: 'breakfast'` → `Breakfast — find a local spot`
- `Café Matinal` with `category: 'cafe'`, `startTime: '08:30'` → `Breakfast — find a local spot`
- `Breakfast at Café Matinal` with no category → masked via title-inferred meal
- Regression: `Café Matinal` with `category: 'cultural'` and no meal hint → unchanged

## Files

- `src/utils/activityNameSanitizer.ts` — broaden dining detection + meal-inference fallback
- `src/utils/__tests__/stubVenueDetection.test.ts` — new cases