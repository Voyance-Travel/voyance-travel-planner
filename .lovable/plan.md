# Fix: "Needs Regeneration" False Alarm on Page Load (Paris)

## Root cause

On page load, `TripDetail` fires several self-heal `safeUpdateItineraryData` calls (`self-heal-predawn-cascade`, `self-heal-rebuild-from-tables`, `self-heal-local-sync`, `self-heal-empty-day-placeholder`, etc.). These hit `action-save-itinerary`, which runs `validateItineraryForPersist`. When the persisted JSON snapshot is mid-reconciliation (e.g. dining cards not yet enriched in JSON, or `meal_policy_at_generation` cached for a different policy than `detectMealSlots` now sees), the validator emits `MISSING_REQUIRED_MEAL` and the backend returns HTTP 422 with `code: 'NEEDS_REGENERATION'`.

`safeUpdateItineraryData` then dispatches `itinerary-persist-issues` for every 422, regardless of whether the save was user-initiated or a silent self-heal. `PersistIssuesListener` turns each into a "Day N needs regeneration — regenerate this day to fix" toast. Meanwhile `TripHealthPanel` reads the live render state and correctly reports 100/0 — the two systems disagree because the validator runs on a transient persisted snapshot, the health engine on the rendered view.

This is the same desync class as the reload-loses-dining bug, surfaced as a misleading toast instead of silent content loss.

## What changes

### 1. `src/services/safeUpdateItineraryData.ts` — suppress on self-heal

In the 422 / `NEEDS_REGENERATION` branch (around lines 211–227):

- If `options.reason` starts with `self-heal-`, OR `options.skipLedgerCheck === true`, **do not** dispatch `itinerary-persist-issues`. Log a `[safeUpdateItineraryData] persist gate flagged issues (suppressed: self-heal)` warn instead.
- Still trigger the canonical `dispatchTripPersisted` resync (so the view heals from DB) and still return `{ error: null, persistVerdict: body }`.
- For non-self-heal saves, dispatch as today, but include `source: options.reason ?? 'user'` in the event detail so the listener can apply additional filtering.

Rationale: every page-load save uses a `self-heal-*` reason. User-initiated mutations (chat actions, manual edits, drag/drop, regenerate-day button) do not. Suppressing self-heal removes the entire class of false alarms in one chokepoint.

### 2. `src/components/itinerary/PersistIssuesListener.tsx` — load-complete gate + source filter

- Read an in-memory `Set<tripId>` `loadedTrips` populated when `TripDetail` dispatches a `voyance:trip-loaded` event (added in step 3). Until the trip is in the set, buffer incoming `itinerary-persist-issues` events (cap: latest 5 per trip).
- On flip to loaded, drop any buffered events whose `detail.source` starts with `self-heal-` or is `'integrity-blocked-resync'`. Keep user-initiated ones.
- For events that arrive **after** load, also drop self-heal sources as a belt-and-braces (already filtered upstream in step 1 — this is defense in depth).
- Keep the existing 5-second dedupe window.

### 3. `src/pages/TripDetail.tsx` — emit `voyance:trip-loaded`

Once both conditions hold:
- The trip's canonical `itinerary_data` has been read (existing `parsedDays` is non-empty), AND
- The first post-mount `TRIP_PERSISTED_EVENT` from a self-heal cycle has settled (or 1.5s after first render if no self-heal fires)

…dispatch `window.dispatchEvent(new CustomEvent('voyance:trip-loaded', { detail: { tripId } }))` exactly once per mount. Use a `useRef` flag.

This is the "load-complete gate" the user asked for. It mirrors how the health engine waits for the live render state.

### 4. Test

Add `src/components/itinerary/__tests__/PersistIssuesListener.suppress.test.ts`:
- Dispatching `itinerary-persist-issues` with `source: 'self-heal-predawn-cascade'` produces no toast.
- Dispatching with `source: 'user'` produces a toast.
- Events fired before `voyance:trip-loaded` are buffered; self-heal ones are dropped on flip, user ones surface.

## Out of scope

- No changes to the backend validator or `validateItineraryForPersist` — the validator is correct, it just shouldn't be user-visible during silent reconciliation.
- No changes to the health engine, generation pipeline, or freeze/`fully_persisted` work from the previous task.
- Real "needs regeneration" surfaces (when a user actually edits or regenerates a day and it fails) continue to fire as today.

## Files touched

- `src/services/safeUpdateItineraryData.ts` (1 branch + event detail field)
- `src/components/itinerary/PersistIssuesListener.tsx` (buffer + filter)
- `src/pages/TripDetail.tsx` (one `useEffect` to emit `voyance:trip-loaded`)
- `src/components/itinerary/__tests__/PersistIssuesListener.suppress.test.ts` (new)

## Memory

Add `mem://constraints/itinerary/persist-issues-toast-user-only`:
> `itinerary-persist-issues` toasts must only fire on user-initiated saves AND only after `voyance:trip-loaded`. Self-heal reasons (`self-heal-*`, `integrity-blocked-resync`) suppressed at `safeUpdateItineraryData` chokepoint + filtered again in `PersistIssuesListener`. Closes Paris page-load "3 days need regeneration" false alarm.
