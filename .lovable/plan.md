## Problem

Petit Palais description renders as:

> "Explore **the of** Paris Museum of Fine Arts, housed in a magnificent 1900 building…"

The official venue name is *"City of Paris Museum of Fine Arts"* — the AI dropped the word "City". The existing repair patterns in `supabase/functions/generate-itinerary/sanitization.ts` only fix this when the orphan phrase is prefixed by `,` or by `in `. Verbs like `Explore`, `Visit`, `Discover` are not covered, so the broken text reached the database (confirmed via query on activity `4712a5b4-7846-4dab-92e2-18b11b80d657`).

## Fix

### 1. Generation-time: broaden the "the of" repair (`supabase/functions/generate-itinerary/sanitization.ts`)

Add a single generic rule **before** the existing narrow ones, applied whenever the next token is a capitalised noun (so we never corrupt valid prose like "the of-the-moment"):

```ts
// "Explore the of Paris …", "Visit the of Light", etc. — orphaned "City"
result = result.replace(/\bthe\s+of\s+(?=[A-Z])/g, 'the City of ');
```

Keep the existing comma/`in`-prefixed rules as-is for backward compatibility.

### 2. Read-time safety net (`src/utils/activityNameSanitizer.ts`)

Add the same regex inside `sanitizeActivityText` so any legacy data already persisted (or content that bypasses the generator, e.g. manual paste, alt-providers) is also cleaned at render time. This is the same defensive layering the file already uses for "Voyance Pick", em-dash, etc.

### 3. One-shot DB backfill

Run a SQL migration that walks `trips.itinerary_data` and rewrites any activity `description`, `title`, `name`, or `tips` matching `\bthe of [A-Z]` → `the City of `. Scope: trips updated in the last 180 days (the only ones the user can realistically still be looking at). This removes the broken Petit Palais string and any siblings without forcing a regeneration.

### 4. Verification

After the migration, re-query the affected trip and confirm:
- `description` reads `"Explore the City of Paris Museum of Fine Arts, housed in…"`
- No remaining rows match `description ~ '\bthe of [A-Z]'`.

## Files touched

- `supabase/functions/generate-itinerary/sanitization.ts` — 1 new regex above line 1077
- `src/utils/activityNameSanitizer.ts` — 1 new replace call inside `sanitizeActivityText`
- New migration: `fix_orphan_city_of_descriptions.sql`

## Why this is safe

- The regex only fires when followed by a capital letter, so prose like "the of-record entity" is untouched.
- Read-time sanitizer runs through the same `sanitizeActivityText` already wrapping every description, tip, and location in `EditorialItinerary.tsx` — no new call sites needed.
- DB backfill is read-modify-write on JSON only; no schema change, no cost-row impact.

Approve to ship the fix and clean up the existing trip.