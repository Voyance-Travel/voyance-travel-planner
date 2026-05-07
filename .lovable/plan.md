## What's happening

The visible tip — `"for the late-night. ☔ Rain: Stay for an extra treatment."` — starts mid-sentence because an earlier regex pass stripped the opening clause but left a dangling preposition fragment. The likely original was:

> "Advance booking required for the late-night. ☔ Rain: Stay for an extra treatment."

In `supabase/functions/generate-itinerary/sanitization.ts`, three patterns target booking-prefix language:

- **L1014** — `/\b(?:BOOK|RESERVE|SECURE)\s+\d[\d-]*\s*(?:WEEKS?|MONTHS?|DAYS?)\s*(?:AHEAD|IN ADVANCE|...)?\b/gi`
- **L1018** — `/\b(?:BOOK|RESERVE|SECURE)\s+(?:ASAP|IMMEDIATELY|NOW|IN ADVANCE|WELL AHEAD|EARLY)\b/gi`
- **L1019** — `/\b(?:Advance|advance)\s+(?:booking|reservation)\s+(?:required|recommended|essential|necessary)\b/gi`

Each removes the verb phrase but **not the preposition + object that follows it**, leaving fragments like " for the late-night.", " at the venue.", " before 8pm." stuck onto the next sentence.

This is systemic — applies to any tip whose AI output started with one of these bookable-urgency prefixes.

## Plan

Two layers: extend the existing strippers to consume the trailing orphan fragment, plus a defensive post-pass that catches anything similar that gets through. Server-only fix; the client just renders what the server stores.

### 1. Make booking-prefix strippers consume the trailing fragment

In `supabase/functions/generate-itinerary/sanitization.ts`, extend the three regexes so they also swallow an optional trailing `\s+(?:for|at|in|before|after|around|during|by|until|on)\b[^.]*\.?` clause. Example for the L1019 pattern:

```ts
.replace(
  /\b(?:Advance|advance)\s+(?:booking|reservation)\s+(?:required|recommended|essential|necessary)(?:\s+(?:for|at|in|before|after|around|during|by|until|on)\b[^.]*?)?\.?\s*/gi,
  ''
)
```

Apply the same `(?:\s+<prep>\b[^.]*?)?\.?` tail to L1014 and L1018. The non-greedy `[^.]*?` keeps the consume bounded to the current sentence and never crosses into the next one (so `☔ Rain: …` is preserved).

### 2. Generic orphan-fragment post-pass

After all the existing replaces in `sanitizeAITextField` (right before the orphan-article repairs around L1067), add a small post-pass that catches the same shape from any future stripper:

```ts
// Drop orphan opening fragments left by prefix strippers:
// " for the late-night. ☔ Rain: ..." → "☔ Rain: ..."
// Pattern: leading whitespace, lowercase preposition, short clause ending
// in a period, then continue with the rest.
result = result.replace(
  /^\s*(?:for|at|in|before|after|around|during|by|until|on|with|to|from)\b[^.]{0,80}\.\s*/i,
  ''
);
```

The `{0,80}` cap and trailing `.` requirement keep this conservative — it won't eat an intentional sentence that happens to start with a lowercase preposition (because real first words are capitalized).

### 3. Tests

Extend the nearest existing test file for `sanitizeAITextField` (likely `supabase/functions/generate-itinerary/sanitization.test.ts` — confirm during impl). New cases:

- `"Advance booking required for the late-night. ☔ Rain: Stay for an extra treatment."` → `"☔ Rain: Stay for an extra treatment."`
- `"BOOK 2 WEEKS AHEAD for the chef's table. Try the tasting menu."` → `"Try the tasting menu."`
- `"Reserve in advance at the rooftop. Sunset views are unbeatable."` → `"Sunset views are unbeatable."`
- Regression: `"Advance booking required."` (no trailing prep) still strips cleanly to `""`.
- Regression: `"Sunset views are unbeatable."` (no leading prefix) untouched.

## Out of scope

- Backfilling stored tips. Sanitization runs every save, so on the next regen/edit the tip self-heals. Listing legacy data isn't worth the migration cost for a copy bug.
- Client-side mirror. `sanitizeActivityText` doesn't run booking-prefix strips, so it isn't producing fragments — no need to touch.

## Files touched

- `supabase/functions/generate-itinerary/sanitization.ts` — extend 3 regexes, add post-pass
- `supabase/functions/generate-itinerary/sanitization.test.ts` (or nearest) — new cases
