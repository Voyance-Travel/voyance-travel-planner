## Root cause

The "scrub" layer added in the last 2 fix passes (DB trigger + JS persist-day contract + edge contract) is dropping legitimate activities, which makes generation finish and then immediately flip `itinerary_status` to `failed` (because `emptyItineraryDetected` fires once the days collapse).

I confirmed it on the live DB:

```sql
select public.scrub_itinerary_activities('[
  {"title":"Lunch at Pizzeria","description":"Find a local spot near the river"},
  {"title":"Museum Visit","description":"Explore the (venue) at noon"},
  {"title":"Coffee","description":"Pick a cafe nearby"},
  {"title":"Real Activity","description":"A great time"}
]'::jsonb);
-- → returns ONLY "Real Activity"
```

Three of four real activities get nuked because their **descriptions** contain phrases the AI uses constantly:
- "find a local spot…", "find a cafe nearby"
- "pick a restaurant", "pick a cafe"
- parenthesised words like "(venue)" / "(name)" inside description prose

Same bug in `src/lib/itinerary/persistDayContract.ts` and `supabase/functions/_shared/persist-day-contract.ts` — they build a `placeholderBlob` that includes `description`, then run the union regex over the whole blob.

Trip evidence (last 24h):
- `38f81fab` — completed 3/3 days, `itinerary_status: failed`, `itinerary_data.days = 0` (save dropped them).
- `5f095e65` — 1/5 days, also `failed`.
- 6 hours with zero new `itinerary_days` writes after the trigger went live.

## Fix scope (3 surgical changes — no business logic touched)

### 1. DB trigger (migration)
Rewrite `public.scrub_itinerary_activities` so:
- **Description is no longer scanned.** Only `title`, `name`, `venue_name`, `venue.name`, `restaurant.name`, `location.name` participate.
- The placeholder regex only fires when the field **is** the placeholder, not when it merely contains the words. Use anchored matches like `^\s*find\s+(a\s+)?(venue|local\s+spot|restaurant|cafe|café|bar|spot)\s*(in\s+.+)?\s*$`.
- Drop the lone `(name)` / `(venue)` alternatives. Keep only `(slot)`, `(aesthetic slot)`, `(placeholder)` and `(<UPPERCASE_TAG> slot)` patterns.
- Pre-dawn ghost rule unchanged.

### 2. JS contracts (frontend + edge shared)
In both `src/lib/itinerary/persistDayContract.ts` and `supabase/functions/_shared/persist-day-contract.ts`:
- Remove `description` from the `placeholderBlob`.
- Switch `PLACEHOLDER_NAME_RE` to anchored / field-equality semantics matching the trigger.
- Keep the cross-city sweep, ghost-row sweep, and locked-row exemption exactly as they are.

### 3. One-shot data repair
Migration step that re-saves every recently-failed trip's `itinerary_data.days` from the surviving `itinerary_days` rows, then resets `itinerary_status` from `failed` → `ready` for trips whose `itinerary_days` are non-empty (limited to trips updated in the last 48h to avoid disturbing legitimately failed older runs).

## Tests

Add cases to `persist-day-contract.test.ts` and `persistDayContract.test.ts`:
- "Lunch at Pizzeria" with description "find a cafe nearby" → **kept**.
- "Museum Visit" with description "(venue) info" → **kept**.
- Title literally `"Find a venue"` → **dropped**.
- Title `"Spa Time — find a venue"` → **dropped**.
- Title `"Day 1 (AESTHETIC slot)"` → **dropped**.
- Pre-dawn "Return to Hotel" at 00:30 → **dropped**.

DB-side: after migration, re-run the SELECT above and assert all 4 rows survive except the literal-placeholder ones.

## What this does NOT change

- Universal locking (locked / user / manual / extracted / pinned rows still bypass everything).
- Pre-dawn hotel ghost stripping.
- Cross-city venue guard.
- Any generator prompts, costs, payments, or UI.

## Files

- New migration: tightened `scrub_itinerary_activities` + 48h backfill of `itinerary_data.days` and `itinerary_status`.
- Edit `src/lib/itinerary/persistDayContract.ts`.
- Edit `supabase/functions/_shared/persist-day-contract.ts`.
- Edit `src/lib/itinerary/__tests__/persistDayContract.test.ts`.
- Edit `supabase/functions/_shared/persist-day-contract.test.ts`.

## Memory update after fix

Add `mem://constraints/itinerary/placeholder-scrub-field-scope` recording: placeholder scrubbers must only inspect short identifier fields (title/name/venue.name), never description, and must use anchored equality — substring matches on prose were the cause of the 2026-05-08 "generation failed" outage.