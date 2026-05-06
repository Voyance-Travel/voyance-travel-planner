# Fix: "the's historic mosque" — orphan possessive in client sanitizer

## What's happening

The hammam description renders as "A sensory retreat at the's historic mosque". Same family of orphan-article AI dropouts as the previous "Explore the of Paris Museum" bug.

Server-side sanitizer (`supabase/functions/generate-itinerary/sanitization.ts:1069`) already repairs `the's` / `the' s` → `the city's` unconditionally. But this description was written to the DB before that repair was active, and the **client-side** `sanitizeActivityText` in `src/utils/activityNameSanitizer.ts` only repairs the `the of <Proper>` orphan — not `the's`. So persisted broken data still slips through to every read view.

## Fix

In `src/utils/activityNameSanitizer.ts` `sanitizeActivityText` (line 180), add two more orphan-article repairs that mirror the server's unconditional set:

- `\bthe'\s?s\b` (case-insensitive) → `the city's`  — handles "the's historic mosque", "the' s old quarter"
- `,\s*the\s+of\b` → `, the City of` — handles ", the of Lisbon" comma-prefixed variant

Both repairs run before the existing strip/regex chain.

Add corresponding test cases to `src/utils/__tests__/activityNameSanitizer.test.ts`:
- `"A sensory retreat at the's historic mosque"` → `"A sensory retreat at the city's historic mosque"`
- `"Walk the' s old quarter"` → `"Walk the city's old quarter"`
- `"Settle in, the of Lisbon awaits"` → `"Settle in, the City of Lisbon awaits"`

## Files

- `src/utils/activityNameSanitizer.ts`
- `src/utils/__tests__/activityNameSanitizer.test.ts`

No server change needed (already repairs this server-side). No DB migration. No memory change — the existing **Text Sanitization Layer** memory covers this.
