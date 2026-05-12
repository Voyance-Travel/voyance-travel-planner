# Permanently freeze the itinerary after generation

## Problem

A hard refresh of a finished trip still mutates the saved itinerary (prices change, activities disappear, hotel-return doubles, meals get scrubbed). Root cause is that several "self-heal" code paths run on page load and write to `trips.itinerary_data`. Even when the in-memory payload is logically equivalent to disk, server-side normalization (cascade, bookend verification, scrubbers, dedup, cost-table sync) makes the post-save bytes differ from the pre-save bytes, which the next listener treats as the new truth.

The existing no-op fingerprint gate, no-regression guard, and `skipLedgerCheck` flag are defenses but do not stop the write from happening — they only soften it. We need a hard rule: **once a trip's itinerary is `ready`/`generated`, page-load and navigation events cannot write to it. Only explicit user-initiated mutations may.**

## Goal

After this change, opening or refreshing a ready trip results in **zero** writes to `trips.itinerary_data`, `itinerary_days`, `itinerary_activities`, or `activity_costs` from any self-heal path. The user sees exactly what the DB contains. User-initiated actions (chat tools, manual edits, regen, version restore from UI button, Fix Timing, etc.) keep working untouched.

## Approach

Introduce a single "frozen" gate at the persistence boundary, and remove (not just guard) the page-load write call sites.

### 1. Mark the freeze point

When `action-save-itinerary` flips a trip to `ready`/`generated` for the first time, also stamp `metadata.itinerary_frozen_at = <ISO>`. This is the canonical signal that no more page-load writes are allowed. Subsequent legitimate user saves leave the stamp in place — it is a "has ever been ready" flag, not a "currently ready" flag.

### 2. Hard gate inside `safeUpdateItineraryData`

Add an `allowFrozenWrite?: boolean` option. At the top of the function, if the on-disk trip has `itinerary_frozen_at` set (or `itinerary_status in ('ready','generated')`) and the caller did NOT pass `allowFrozenWrite: true`, log `[safeUpdateItineraryData] FROZEN write blocked (reason=…)` and return `{ error: null }` (silent success — no DB write, no resync dispatch). This converts every self-heal call site into a no-op without needing to touch each one individually.

### 3. Mirror gate inside `action-save-itinerary` (defense in depth)

If the request body has `saveReason` starting with `self-heal-` AND the on-disk trip is frozen, short-circuit with a 200 `{ skipped: true, reason: 'frozen' }`. Catches direct invokes that bypass the client wrapper (the two `supabase.functions.invoke('generate-itinerary', { action: 'save-itinerary', saveReason: 'self-heal-*' })` calls in TripDetail).

### 4. Remove the write paths in `TripDetail.tsx` instead of leaving them as no-ops

For frozen trips, the rebuild-from-tables, version-restore, empty-day-placeholder, and local-sync self-heal blocks should not even attempt the save — purely guard early. Concretely:

- `syncLocalTripToDatabase` (≈L671): skip the `safeUpdateItineraryData` step when trip is already on the server with `itinerary_frozen_at`.
- Self-heal rebuild-from-tables (≈L1271): only fires when `jsonDayCount > 0 && itineraryDaysDbCount > jsonDayCount`. Add explicit `if (frozen) { return; }`.
- Self-heal version-restore + empty-day-placeholder (≈L1361 onwards): already gated to `!isReadyTrip`, but `isReadyTrip` and `frozen` are now the same flag; tighten the condition and remove the placeholder write-back entirely (banner is enough).

This is belt + braces with the boundary gate but makes the intent obvious in the code.

### 5. Read-time normalizers stay display-only

`ensureHotelReturnBookend`, ghost filter, dedup, parser-side cleanups already only mutate the in-memory parsed view. Audit once to confirm none of them dispatch saves. The recent duplicate-hotel-return fix is unaffected — the dedup runs at parse time, not at save time.

### 6. Allow-list the legitimate writers

These call sites must opt in with `allowFrozenWrite: true`:
- EditorialItinerary explicit save / Fix Timing / dedup-on-save
- Chat action executor (rewrite/swap/regenerate/pacing/filter)
- Version restore triggered by the UI restore button
- Date-change handlers (`handleDateChange`, `handleUndoDateChange`)
- Manual paste / ItineraryEditor save
- Optimistic patch fallback

These are all user-initiated and must continue to function.

### 7. Tests

- New test `safeUpdateItineraryData.frozen.test.ts`: with `itinerary_frozen_at` set, a self-heal call returns silently and no `functions.invoke` is fired. With `allowFrozenWrite: true`, the call goes through.
- New test `action-save-itinerary.frozen.test.ts`: `saveReason: 'self-heal-rebuild-from-tables'` + frozen trip returns `{ skipped: true }` and does not touch `trips.itinerary_data`.
- Extend `itineraryParser.dining-preservation.test.ts` to assert no save dispatch happens during parse (already implicit but worth a guard).

### 8. Validation

- Hard refresh a ready trip in preview, watch network tab: expect zero `POST .../generate-itinerary` calls and zero `PATCH .../trips`.
- Open browser console: expect `[safeUpdateItineraryData] FROZEN write blocked` for any path that tries.
- Navigate away and back: same expectation.
- Regression: chat "swap dinner", confirm action still persists (passes `allowFrozenWrite`).

## Files touched

- `src/services/safeUpdateItineraryData.ts` — add frozen gate + `allowFrozenWrite` option.
- `src/pages/TripDetail.tsx` — early-return frozen branches in 4 self-heal blocks; thread `allowFrozenWrite` into the legitimate user-initiated saves at L1929 / L2140 / L2230 / L2294 / L2327.
- `src/components/itinerary/EditorialItinerary.tsx` and chat `itineraryActionExecutor` — pass `allowFrozenWrite: true` on user-initiated saves.
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — stamp `metadata.itinerary_frozen_at` on first ready transition; mirror frozen gate for `saveReason: 'self-heal-*'`.
- New tests under `src/services/__tests__/` and `supabase/functions/generate-itinerary/__tests__/`.
- Memory: add `mem://constraints/itinerary/frozen-after-ready` to the index Core section.

## Out of scope

- Backfilling `itinerary_frozen_at` on existing ready trips. The gate also accepts `itinerary_status in ('ready','generated')` so older trips are covered immediately; the stamp only matters for trips that may transition back to `partial` later.
- Read-time display fixes (already shipped: hotel-return dedup, ghost filter, late-nightlife bookend).
