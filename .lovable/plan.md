
The issue is still the same class of failure: a render-time `.toLowerCase()` is being called on a value that is sometimes missing or malformed in itinerary data.

What I found:
- `ActivityRow` is still the failing area in `src/components/itinerary/EditorialItinerary.tsx`.
- The last sweep fixed several transport/title cases, but there are still unguarded normalization paths nearby.
- In particular:
  - `src/components/itinerary/EditorialItinerary.tsx:10458` uses `activityType.toLowerCase()`
  - `src/components/itinerary/EditorialItinerary.tsx:1168-1170` returns `activity.category || activity.type || 'activity'` without coercion, so a non-string truthy value can flow into render and then crash on `.toLowerCase()`
  - `src/lib/cost-estimation.ts` still has older bare calls in the estimation path:
    - `title.toLowerCase()`
    - `city.toLowerCase()`
    - `country.toLowerCase()`
    - `category.toLowerCase()`

Do I know what the issue is?
Yes. The previous fix was incomplete. Some `.toLowerCase()` calls were guarded, but the code still assumes certain backend fields are always strings. If the AI/backend sends an object, number, or other truthy non-string value for `category`, `type`, `city`, `country`, or `title`, the render/estimation path can still crash.

Implementation plan:
1. Harden `getActivityType` in `EditorialItinerary.tsx`
- Make it return a guaranteed lowercase-safe string using `safeLower` or `String(...)`.
- This prevents downstream render code from receiving non-string `activityType`.

2. Fix the remaining render-path crash in `ActivityRow`
- Replace `activityType.toLowerCase()` with a safe normalized value derived once from `safeLower(activityType)`.
- Reuse that normalized value in the non-reviewable activity logic.

3. Finish the defensive sweep in `cost-estimation.ts`
- Guard remaining bare `.toLowerCase()` calls in:
  - `inferMealTypeFromTitle`
  - `getCostIndex`
  - `estimateCost`
- Normalize `category`, `title`, `city`, and `country` with safe coercion before string operations.

4. Keep the fix narrow and consistent
- Reuse the existing `src/utils/safeLower.ts` helper instead of mixing new ad hoc patterns.
- Do not change feature behavior; only harden inputs so malformed itinerary payloads fall back to safe defaults.

Expected result:
- No more itinerary white-screen/render crash from undefined or non-string values hitting `.toLowerCase()`.
- Bad backend data will degrade to default behavior (`activity`, empty string matching, default cost heuristics) instead of crashing the page.

Technical details:
- Files to update:
  - `src/components/itinerary/EditorialItinerary.tsx`
  - `src/lib/cost-estimation.ts`
- Likely code changes:
  - import and use `safeLower`
  - sanitize `getActivityType`
  - replace remaining direct `.toLowerCase()` calls on uncertain values
