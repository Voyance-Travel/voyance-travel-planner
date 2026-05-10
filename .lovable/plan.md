## RS.L9 — Bounded airport search query

Note: RS.L8 was already completed in the previous turn (cleanup_rate_limits hardened + cron rescheduled). This plan covers RS.L9 only.

### File: `src/services/locationSearchAPI.ts` (lines 160-165)

The current "regular search" branch in `searchAirports` does a triple-column `ilike '%q%'` against the `airports` table, which forces a full table scan on every keystroke. Adding a length guard plus a prefix-match path for short queries keeps the call cheap and lets the `code` index do the work.

### Change

Replace the body at lines 160-165 with:

```ts
// Otherwise, regular search.
// Reject queries shorter than 2 chars — single-letter wildcards match
// thousands of airports and force a full table scan.
const trimmed = (query ?? '').trim();
if (trimmed.length < 2) {
  return [];
}

// 2-char queries: prefix-match the code column only (uses the index on `code`).
// 3+ char queries: also match name/city via contains.
const filter = trimmed.length === 2
  ? `code.ilike.${trimmed}%`
  : `code.ilike.${trimmed}%,name.ilike.%${trimmed}%,city.ilike.%${trimmed}%`;

const { data, error } = await supabase
  .from('airports')
  .select('*')
  .or(filter)
  .limit(limit);
```

Notes:
- Existing `limit` param (default 20) is preserved — do not hardcode 20.
- The early-return covers empty/whitespace queries too, replacing the implicit "match everything" behavior.
- `searchDestinations` already filters to parts with `length >= 2`, so it's not in scope.

### Verification

- `grep -c "trimmed.length === 2" src/services/locationSearchAPI.ts` ≥ 1
- Manual: 1-char input → empty array, no network round-trip. 2-char "JF" → matches "JFK". 3+ char "lon" → matches LHR/LCY plus "London"/"Londrina" etc.

### Out of scope

- Touching the `metroArea` branch above (already uses `.in('code', …)`).
- Touching `searchDestinations` or any other function.
- Adding a debounce or client cache.
