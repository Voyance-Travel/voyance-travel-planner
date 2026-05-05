# Fix: "Explore the of Paris Museum" — orphaned-article copy reaching the UI

## What's happening

The Petit Palais description renders as "Explore the of Paris Museum". This is a known orphaned-article artifact (the AI dropped "City" between "the" and "of"). Two repair sites already exist:

- `supabase/functions/generate-itinerary/sanitization.ts:1077` (server, write-time)
- `src/utils/activityNameSanitizer.ts:182` (client, read-time, via `sanitizeActivityText`)

Both regexes (`/\bthe\s+of\s+(?=[A-Z])/g` → `'the City of '`) work — verified with a node repl on the exact string.

So why did this slip through? Two real gaps:

1. **The server-side repair sits inside an `if (destination)` block** (sanitization.ts line 1072–1098). If the per-day sanitize call is invoked without a destination string (which happens in some sub-flows and in tests), the orphan-article repair is skipped entirely. The Petit Palais description was written to the DB without ever being repaired.
2. **The customer-facing day card renders `activity.description` raw**, with no client-side sanitization fallback. Specifically `src/components/planner/CustomerDayCard.tsx:249` outputs `{activity.description}` directly. Same in `ItinerarySummaryCard.tsx:229`, `TripActivityCard.tsx:87`, `FullItinerary.tsx:514`, `ItineraryPreview.tsx:151`, `SampleItinerary.tsx:623`, `ConsumerTripShare.tsx:228`. `EditorialItinerary.tsx` already wraps in `sanitizeActivityText` — that's why the bug is visible in some views and not others.

The result: any itinerary generated before the server repair was added — or generated when the destination param wasn't passed — keeps shipping the broken copy to every non-Editorial view.

## Fix

### 1. Server: make the orphan-article repairs unconditional

In `supabase/functions/generate-itinerary/sanitization.ts`, move the four destination-agnostic repairs out of the `if (destination)` block so they always run:

- `\bthe\s+of\s+(?=[A-Z])` → `the City of ` (line 1077)
- `,\s*the\s+of\b` → `, the City of` (line 1080)
- `\bthe'\s?s\b` → `the city's` (already unconditional at 1069, leave as is)

The destination-dependent rewrites ("in the of X" → "in Lisbon, the City of X", trailing "in the." → city name, etc.) stay inside the `if (destination)` block.

### 2. Client: wrap raw description renders in `sanitizeActivityText`

Add `sanitizeActivityText` import and wrap `{activity.description}` in:

- `src/components/planner/CustomerDayCard.tsx` (line 249) — primary fix for the reported view
- `src/components/planner/TripActivityCard.tsx` (line 87)
- `src/components/planner/ItinerarySummaryCard.tsx` (line 229)
- `src/components/planner/steps/ItineraryPreview.tsx` (line 151)
- `src/components/itinerary/FullItinerary.tsx` (line 514)
- `src/pages/ConsumerTripShare.tsx` (line 228)
- `src/pages/SampleItinerary.tsx` (line 623)

These are all defensive — the server repair is the source of truth, but client wrapping ensures already-persisted broken data is repaired on read until it's regenerated.

### 3. Test

Add a unit test in `src/utils/activityNameSanitizer.ts`'s sibling test (or co-located) covering:
- "Explore the of Paris Museum" → "Explore the City of Paris Museum"
- "Visit the of Lisbon palace" → "Visit the City of Lisbon palace"
- "Walk the of dogs" (lowercase after "of") → unchanged (regex requires `[A-Z]`)

If no test file exists for `activityNameSanitizer.ts`, create `src/utils/__tests__/activityNameSanitizer.test.ts`.

## Files

- `supabase/functions/generate-itinerary/sanitization.ts`
- `src/components/planner/CustomerDayCard.tsx`
- `src/components/planner/TripActivityCard.tsx`
- `src/components/planner/ItinerarySummaryCard.tsx`
- `src/components/planner/steps/ItineraryPreview.tsx`
- `src/components/itinerary/FullItinerary.tsx`
- `src/pages/ConsumerTripShare.tsx`
- `src/pages/SampleItinerary.tsx`
- `src/utils/__tests__/activityNameSanitizer.test.ts` (new)

No DB migration. No memory change — the existing **Text Sanitization Layer** memory already covers this category.
