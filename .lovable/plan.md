# Lock down cross-day venue dedup against Louvre regression

## Problem

In two earlier sessions the Louvre appeared as the same product on consecutive days. Today's protection is the inline `canonVenue` + `venueNamesMatch` filter in `action-generate-trip-day.ts` (lines 1144–1191), which strips activity qualifiers ("Exploration", "Priority Visit", "Tour"…) and fuzzy-matches against `usedVenues`. There are also alias entries in `generation-utils.ts` (`musee du louvre`, `louvre museum`, `the louvre` → `louvre`).

The logic looks sound, but:

- It lives as a closure inside a 2,700-line file — not unit-tested.
- The exact "Louvre on consecutive days" variants have no regression test, so a future refactor can silently regress.
- The `ledger-check.ts` "repeat_already_done" pass uses a much weaker `fuzzyMatch` (substring only) and doesn't share the canonicalizer, so if `usedVenues` ever drops out of the pipeline the second line of defense doesn't catch "Louvre Museum Priority Visit" vs "Louvre Museum Exploration" reliably.

## Plan

### 1. Extract canonicalization into `generation-utils.ts`

Add `canonicalActivityVenueName(title)` exporting the regex chain currently inlined in `action-generate-trip-day.ts`:

```ts
export function canonicalActivityVenueName(s: string): string {
  if (!s) return '';
  let v = String(s).trim()
    .replace(ACTIVITY_PREFIX_RE, '')
    .replace(ACTIVITY_VERB_PREFIX_RE, '');
  let prev = '';
  while (prev !== v) { prev = v; v = v.replace(ACTIVITY_QUALIFIER_RE, '').trim(); }
  return normalizeVenueName(v);
}
```

Plus `crossDayVenueDuplicate(activityCandidates: string[], priorVenues: string[]): { isDuplicate: boolean; matchedPrev?: string; matchedCandidate?: string }` that wraps the canonicalize → `venueNamesMatch` loop.

### 2. Use it from `action-generate-trip-day.ts`

Replace the inline `canonVenue` + nested loops with `crossDayVenueDuplicate(...)`. Behavior unchanged; the log line stays.

### 3. Use the same canonicalizer in `ledger-check.ts`

`ledger-check.ts` step 2 ("Repeat-of-alreadyDone") currently uses substring-only `fuzzyMatch`. Harden it with `canonicalActivityVenueName` before comparing, so even when `usedVenues` is empty (e.g. on a single-day regen) we still catch "Louvre Museum Priority Visit" against an `alreadyDone` of "Louvre Museum Exploration".

### 4. Regression test suite

New `supabase/functions/generate-itinerary/cross-day-dedup.test.ts` covering the Louvre case + neighbors:

- `canonicalActivityVenueName('Louvre Museum Exploration')` → `'louvre museum'` (after strip)
- `canonicalActivityVenueName('Morning at Louvre Museum')` → matches above
- `crossDayVenueDuplicate(['Louvre Museum Priority Visit'], ['Louvre Museum Exploration'])` → duplicate
- `crossDayVenueDuplicate(['Skip-the-Line Louvre Tour'], ['Musée du Louvre'])` → duplicate (alias path)
- Non-duplicate sanity: `'Musée d'Orsay Visit'` vs `'Louvre Museum Exploration'` → not duplicate
- Restaurants explicitly skipped (category branch is in caller, but the helper itself should not over-match `'Café Marly'` vs `'Louvre Museum'`)

Plus a focused test on the patched `ledger-check.ts`: feed a Day 2 with "Louvre Museum Priority Visit" and an `alreadyDone` of "Louvre Museum Exploration", assert the Day 2 entry is removed with a `repeat_already_done` warning.

### 5. Stack-overflow note (database-level dedup)

The lovable-stack-overflow snippet suggests a unique DB index on (`source_id`, `date`, `amount`). That doesn't apply here — itinerary rows aren't identity-keyed by venue, and venues legitimately recur (Eiffel viewing point at sunset vs. tower climb). Sticking with the canonicalizer + alias map is correct.

## Files

- `supabase/functions/generate-itinerary/generation-utils.ts` — add `canonicalActivityVenueName`, `crossDayVenueDuplicate`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — use new helpers
- `supabase/functions/generate-itinerary/ledger-check.ts` — canonicalize before `fuzzyMatch`
- `supabase/functions/generate-itinerary/cross-day-dedup.test.ts` — new (Deno)

## Out of scope

- Restructuring the Day Truth Ledger / `usedVenues` plumbing.
- Adding a DB unique index — not the right shape for itinerary venue dedup.
