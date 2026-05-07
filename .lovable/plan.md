## Problem

User-visible prose on Day 2 of the Venice trip:

> "A kinetic and stylish way to see **the from the water**. Explore the hidden back canals…"

The intended sentence was "…to see **the city** from the water…". The literal word "city" was stripped from the description by an over-aggressive sanitizer.

## Root cause

`supabase/functions/generate-itinerary/sanitization.ts` line 962:

```ts
const TEXT_SCHEMA_LEAK = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay|type|slot|isVoyancePick|optionGroup|isOption)(?:\s*[:;|]\s*[^,;|]*)?/gi;
```

The intent is to strip leaked JSON schema fragments like `,duration:4,practicalTips;|`. But:

1. The trailing `(?:\s*[:;|]\s*[^,;|]*)?` group is **optional**. So a bare English word in the keyword list (`city`, `country`, `name`, `location`, `description`, `cost`, `category`, `type`, `kind`, `slot`, `tags`, etc.) is matched and deleted on its own — no `:` required.
2. The leading `[,;|]*` is also `*` (zero or more), so the regex fires inside normal prose.

Result: "to see the city from the water" → "to see the from the water".

The same pattern exists in **two more places**:
- `src/utils/textSanitizer.ts` line 14 (`SCHEMA_LEAK_RE`)
- `src/utils/activityNameSanitizer.ts` (similar inline schema-leak regex if present in this file's set — verify)

Other words at risk in normal prose: "cost", "category", "name", "location", "highlights", "city", "country", "type". This is why we periodically see truncated descriptions across the app, not just Venice.

## Fix

### 1. Require the separator in the schema-leak regex

In all three files, change the separator group from optional to required, and require at least one separator character at the front. Replace:

```ts
/[,;|]*\s*(?:KEYWORD|...)(?:\s*[:;|]\s*[^,;|]*)?/gi
```

with:

```ts
/[,;|]+\s*(?:KEYWORD|...)\s*[:;|]\s*[^,;|]*/gi
```

This means the regex only fires when the keyword is preceded by a `,` / `;` / `|` AND followed by a `:` / `;` / `|` value — i.e. genuine JSON-fragment leakage like `,duration:4,city:Paris;`. A standalone "city" or "name" inside a sentence is preserved.

Files to update with the same edit:
- `supabase/functions/generate-itinerary/sanitization.ts` (`TEXT_SCHEMA_LEAK`)
- `src/utils/textSanitizer.ts` (`SCHEMA_LEAK_RE`)
- `src/utils/activityNameSanitizer.ts` if it has an equivalent constant (audit before touching).

### 2. Add a defensive repair pass

In `sanitization.ts` (and `src/utils/textSanitizer.ts`), after the schema-leak strip, repair the most common leftover damage from sentences mauled by the old regex. Mirror the existing `the of` / `the's` repairs:

```ts
// Repair "see the from the water" / "in the of the city" gaps caused by
// legacy aggressive schema-leak stripping that ate the noun.
result = result
  .replace(/\bsee the from the\b/gi, 'see the city from the')
  .replace(/\bin the from the\b/gi, 'in the city from the')
  .replace(/\bthe from the (water|street|river|canal|sea|sky|air|ground|inside|outside|rooftop)\b/gi, 'the city from the $1');
```

Lightweight, scoped to the leak pattern, won't touch valid prose.

### 3. One-time DB scrub

Run an UPDATE on `trips.itinerary_data` to repair existing damaged descriptions. Use a JSONB walker (mirroring the recent ghost-activity and meal-sentinel scrubs) that runs the small repair regex on `activities[].description` only. Skips locked / user / extracted / pinned items. Verify the Venice row reads cleanly after.

### 4. Test coverage

Add unit tests in `src/utils/__tests__/textSanitizer.test.ts` (create if missing) asserting:
- "to see the city from the water" round-trips unchanged.
- Real schema fragments like `",duration:4,city:Paris;|"` are still stripped.
- Standalone words "city", "name", "location" inside English sentences are preserved.
- Repair pass converts "see the from the water" back to "see the city from the water".

## Verification

- Reload trip `38f81fab…`, Day 2 kayak description reads "…way to see the city from the water…".
- DB query `select count(*) from trips, jsonb_each(...) where description ~* '\bthe from the\b'` → 0 after scrub.
- All existing sanitization tests still pass.

## Out of scope

- Auditing every other regex in `sanitization.ts` for similar permissive groups (separate hardening pass; this PR fixes the known active leak).
