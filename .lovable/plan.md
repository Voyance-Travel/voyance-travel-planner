## Root Cause

The wrong-city restaurants (Tartine Bakery / SF, All'Antico Vinaio / Florence, Le Comptoir du Relais / Paris, Sant'Eustachio / Rome) are **not coming from the AI** at all. They are baked into the **emergency fallback database** at `supabase/functions/generate-itinerary/fix-placeholders.ts`:

- `GLOBAL_EMERGENCY_FALLBACK` (lines 271-275) — always returns Tartine (SF), All'Antico Vinaio (Florence), Le Comptoir (Paris) regardless of destination.
- `REGIONAL_EMERGENCY_FALLBACK['italy']` (lines 207-211) — uses Sant'Eustachio (Rome), All'Antico Vinaio (Florence), Trattoria Sostanza (Florence) for *any* Italian city, including Venice.

The MEAL FINAL GUARD in `day-validation.ts` lines 1119-1128 calls `resolveAnyMealFallback`, which falls through to `regionalEmergencyFallback` → `GLOBAL_EMERGENCY_FALLBACK`. Each fallback ships its **original out-of-city address** (`Via dei Neri 65, Florence`, `600 Guerrero St, San Francisco`) pasted directly into `activity.location.address` via `applyFallbackToActivity`.

The cross-city hallucination filter in `pipeline/enrich-day.ts` runs **before** this final meal-injection step, and the meal guard never re-runs cross-city validation, so the wrong-city venues sail straight into the saved itinerary.

This explains the exact pattern in your bug report — Venice runs keep recycling Florence/Rome/Paris/SF venues because Venice's specific INLINE pool gets exhausted (the meal guard requires unique names across the trip), the regional pool returns Florence/Rome venues, and the global pool returns SF/Paris venues. None are filtered.

## Fix Plan

### 1. Strip wrong-city venues out of the regional/global fallback tables

In `supabase/functions/generate-itinerary/fix-placeholders.ts`:

- **Delete** `GLOBAL_EMERGENCY_FALLBACK` entirely. A globally-shared "real venue" pool is fundamentally incompatible with the cross-city integrity requirement.
- **Restructure** `REGIONAL_EMERGENCY_FALLBACK` so each country entry is a **map of city → venues** (or a list of venues each tagged with their city). Lookup must only return a venue whose `city` token matches the destination city.
- If no city-matching regional venue exists, return a **needsVenuePick sentinel** (the existing `needsVenuePick: true` path that forces `$0` and a "find a local spot" unverified label) — never a wrong-city real venue. This is consistent with the "Wellness Venue Integrity" memory rule already applied to spas.

### 2. Cross-city safety net on meal injection

In `fix-placeholders.ts → applyFallbackToActivity` and `day-validation.ts → MEAL FINAL GUARD`:

- Before applying a fallback, run `isCrossCityAddress({ location: { address: fallback.address }, venue_name: fallback.name }, destination)` from `cross-city-filter.ts`.
- If it trips, discard the fallback and fall through to the next tier (or to the `needsVenuePick` sentinel). Add a `[CROSS-CITY FALLBACK BLOCKED]` warn log.

### 3. Final post-injection cross-city sweep

In `pipeline/enrich-day.ts` (or a new sweep called from `universal-quality-pass.ts → terminalCleanup`):

- After meal injection completes, run `isCrossCityAddress` over every dining/wellness/sightseeing/etc. activity again. Anything wrong-city gets converted to an unverified placeholder ($0, "Lunch — find a local spot") rather than being shipped with a foreign address.

### 4. Regression tests

Add to `supabase/functions/generate-itinerary/fix-placeholders.test.ts` (and a new test file if needed):

- Resolving a Venice meal fallback when the Venice pool is exhausted **must not** return Tartine, All'Antico Vinaio, Le Comptoir, Sant'Eustachio, or Trattoria Sostanza.
- `applyFallbackToActivity` rejects a fallback whose address resolves to a different city via `isCrossCityAddress`.
- Snapshot test: every entry in `REGIONAL_EMERGENCY_FALLBACK` and any per-city pool has an address whose city token matches the country's allowed list — and is the *intended* city, not just any city in that country.

### 5. Memory update

Append a Core rule to `mem://index.md`:

> **Cross-City Fallback Integrity:** Meal/venue fallback DBs must never return a real venue from a different city than the destination. Exhausted pools downgrade to unverified `needsVenuePick` ($0) sentinels — never to a famous-but-foreign venue. Enforced in fix-placeholders.ts (no GLOBAL pool), applyFallbackToActivity (cross-city guard), and a post-injection sweep in enrich-day/terminalCleanup.

## Files to Edit

- `supabase/functions/generate-itinerary/fix-placeholders.ts` — remove `GLOBAL_EMERGENCY_FALLBACK`, restructure `REGIONAL_EMERGENCY_FALLBACK` to city-keyed entries, add cross-city guard in `applyFallbackToActivity` and `resolveAnyMealFallback`.
- `supabase/functions/generate-itinerary/day-validation.ts` — guard the MEAL FINAL GUARD TRY 4 path; if emergency returns a sentinel, write the unverified placeholder with $0 instead of a wrong-city real address.
- `supabase/functions/generate-itinerary/pipeline/enrich-day.ts` (or `universal-quality-pass.ts → terminalCleanup`) — add post-injection cross-city sweep.
- `supabase/functions/generate-itinerary/fix-placeholders.test.ts` — new regression tests.
- `mem://index.md` — add Core rule.

## Out of Scope

- AI prompt changes (the AI is not the source of these specific bugs — the fallback DB is).
- UI/sanitizer changes.
- Cost engine changes (already correctly snapshots $0 for `needsVenuePick`).