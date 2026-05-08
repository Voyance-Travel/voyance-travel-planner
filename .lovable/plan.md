# Closing the Three Intermittent Leaks

## Diagnosis

Tracing each symptom back to its source code, two of the three share **one root cause** (raw `itinerary_data` writes that bypass the server boundary), and the third (Payments) requires a different lens because no current code renders the "Reconciling…" / "Totals differ" badges — only comments documenting prior fixes do.

### Leak 1 + 2 — Prompt artifacts AND wrong-city restaurants

`supabase/functions/_shared/persist-itinerary.ts` is the **single backend boundary** that runs:
1. `stripPromptArtifactsInTitles` — kills `(slot)`, `(AESTHETIC slot)`, `(FLEX_WINDOW)`, `(INTEREST_SLOT)`, `(NARRATIVE_MOOD)`, etc.
2. `enforceContractOnDays` — drops ghost rows + cross-city venues (per-day cityName preferred, falls back to `ctx.destination`).
3. `terminalCleanup` (called from `action-save-itinerary.ts`) — runs `nuclearCrossCitySweep` to downgrade Tartine/Vinaio/Comptoir-style leaks to `needsVenuePick` sentinels.

Three client paths in `src/pages/TripDetail.tsx` skip this entirely:

- **Line 613** — `supabase.from('trips').upsert({ ...tripData, itinerary_data })` on the trip-restore / cache-replay flow.
- **Line 2010** — `supabase.from('trips').update({ itinerary_data: updatedItinerary })` in `handleDateChange`.
- **Line 2090** — `supabase.from('trips').update(updatePayload)` where `updatePayload.itinerary_data = itineraryData` in the second date-change variant.

Whenever one of these runs against a freshly-generated trip that still has a `(FLEX_WINDOW)` token or an All'Antico-Vinaio leak that the *generator* repaired in memory but hadn't yet flushed through the boundary, the raw write **lands the dirty days back into `itinerary_data`**, undoing every prior strip. That perfectly matches the 30–50% intermittency: the bug only shows up when the user (or auto-save) edits dates, restores from cache, or triggers the upsert path within the same session as a generation that left a stripable artifact.

### Leak 3 — Payments "Totals differ" / "Reconciling…"

No current component renders those literal strings — they exist only in code comments documenting prior fixes (`PaymentsTab.tsx`, `useTripFinancialSnapshot.ts`, `usePayableItems.ts`, `EditorialItinerary.tsx`). The dev-only assertion at `PaymentsTab.tsx:450` fires when `bucketSumCents − estimatedTotal > 200`, but in production it just `console.assert`s — no visible badge.

Two possibilities, can't disambiguate without a screenshot:

- **(a) Stale build / cached bundle**: an older bundle still containing the badge code is being served from cache to some sessions. Resolution = bump the build hash and force-refresh.
- **(b) Live drift symptom under a different label**: the underlying `bucketSumCents ≠ estimatedTotal` race still happens (e.g., when activity_costs lags the itinerary write by >600ms after a multi-day regen), but is now silent in production. Resolution = block paint until both queries settle.

## Fix

### Layer 1 — Force every client `itinerary_data` write through `safeUpdateItineraryData` (closes Leaks 1+2)

`src/services/safeUpdateItineraryData.ts` already proxies into the `save-itinerary` edge action, which runs `terminalCleanup` + `persistTripItinerary`. Replace the three raw writes:

- **TripDetail.tsx:613 (upsert)** — Split into (i) `supabase.from('trips').upsert(tripDataWithoutItinerary)` for non-itinerary fields, then (ii) `safeUpdateItineraryData(tripId, localTrip.itinerary_data)` if `itinerary_data` is non-null. Preserves the upsert semantics for new-trip insertion while routing dirty JSON through the boundary.
- **TripDetail.tsx:2010 (handleDateChange)** — Replace with `safeUpdateItineraryData(tripId, updatedItinerary, { start_date, end_date, hotel_selection })`. The wrapper accepts `extraFields` for sibling columns.
- **TripDetail.tsx:2090 (second date-change variant)** — Same pattern: route `itinerary_data` through `safeUpdateItineraryData`, keep `start_date`/`end_date`/`hotel_selection` as `extraFields`.

Add an ESLint rule (or a simple grep test in `src/services/__tests__/`) that fails CI if anyone introduces `.update({ ... itinerary_data ...})` or `.upsert({ ... itinerary_data ...})` outside `safeUpdateItineraryData.ts` and the edge functions.

### Layer 2 — Belt-and-braces server defense (catches anything that still slips through)

Add a Postgres `BEFORE UPDATE` trigger on `trips` that, when `itinerary_data` changes, runs the **same** prompt-artifact regex (the two-regex `test`/`replace` pair) over every `activities[].title|name|description` and refuses (`RAISE EXCEPTION`) if a `(slot)` / `(<LABEL> slot)` / `(<ALLCAPS_TOKEN>)` survives. Server-side last gate, language-agnostic, works for any future write path we forget. This already exists in fragmentary form for some patterns (per the "Stateful Regex Strip Bug" memory) — extend it to cover the FLEX_WINDOW / INTEREST_SLOT / AESTHETIC_SLOT family.

For cross-city, add the same trigger pattern: if any activity's `location.address` contains a known city token that doesn't match the day's resolved city or the trip's destination, raise. Use the existing `detectCrossCityMention` logic ported to PL/pgSQL with a hardcoded city-token list (Florence, Venice, Rome, Paris, etc. — same set as `REGIONAL_EMERGENCY_FALLBACK`).

### Layer 3 — Payments badge clarification

Before coding anything, ask the user to confirm whether they actually still see the literal "Totals differ" / "Reconciling…" UI badges in production, or only the underlying numeric drift. If literal badges, it's a stale-cache problem (force version bump). If numeric drift, gate the bucket render on `snapshotReady && !activityCostsFetching && !financialSnapshot.loading` (already partially done at line 448) AND add a 600ms post-write debounce on the `booking-changed` listener so the bucket sums don't read mid-flight `activity_costs` rows.

## Files to edit

- `src/pages/TripDetail.tsx` — 3 raw-write replacements
- `src/services/safeUpdateItineraryData.ts` — verify `extraFields` carries `start_date`/`end_date`/`hotel_selection` correctly (already supports `extraFields`)
- `src/services/__tests__/no-raw-itinerary-writes.test.ts` — new lint-style test
- `supabase/migrations/<new>_itinerary_data_artifact_guard.sql` — BEFORE UPDATE trigger
- `src/components/itinerary/PaymentsTab.tsx` — only if user confirms numeric-drift case (not if stale cache)

## Memory

Update `mem://constraints/itinerary/no-raw-itinerary-fallback-writes` (already exists) with the three TripDetail.tsx leak paths now closed, and reference the new DB trigger as the final safety net.

## Out of scope

- Rewriting the date-change flow's optimistic UI (the `setTrip(...)` calls that update local state — those are fine).
- Touching the canonical-cost reconciliation contract (memory already covers it).
