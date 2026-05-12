## Goal

Close the **timing-shift** branch of the divergence bug that the previous resync fix missed. After verifying, the resync helper, listener, and dispatchers are all wired correctly — but the `EditorialItinerary` sync gate ignores time changes, so the post-cascade times never reach the rendered `days` state until the user refreshes.

## Root Cause (Verified)

`src/components/itinerary/EditorialItinerary.tsx` lines 2228–2243:

```ts
const initialDaysFingerprint = useMemo(() => {
  return JSON.stringify(initialDays.map(d => ({
    n: d.dayNumber,
    d: d.date,
    a: d.activities.map(a => a.id),   // ← only IDs, no times
  })));
}, [initialDays]);
```

Activity IDs are stable across the timing cascade. So:
- Bali symptom (Metis 8:42 PM → 7:22 PM, same id): fingerprint unchanged → `setDays` skipped → stale times stick.
- Bruges/Istanbul symptom (Sisterfields breakfast id present → absent): fingerprint changes → `setDays` runs → meal disappearance propagates correctly.

The previous fix's resync, listener, dispatch, and `parseEditorialDays(trip.itinerary_data)` recomputation all work. The blockage is just this fingerprint.

## Plan

### 1. Extend the sync fingerprint to include timing

Replace the activity-id-only fingerprint with one that also catches time changes from the cascade:

```ts
a: d.activities.map(a => `${a.id}@${a.startTime || ''}-${a.endTime || ''}#${a.durationMinutes ?? ''}`),
```

This adds zero new state, no new effects — just a tighter equality check on the same `useMemo`. After a resync that shifted Metis from 8:42 PM to 7:22 PM, the fingerprint will differ → `setDays(initialDays)` fires → user sees post-cascade times immediately.

### 2. Resync after INTEGRITY_BLOCKED writes

In `src/services/safeUpdateItineraryData.ts`, when `detectShrinkage` blocks the write, the DB is *healthier* than the session, so the session is the one carrying stale/dropped data. Currently we return `{ error: INTEGRITY_BLOCKED }` and never dispatch — which leaves the session diverged.

Add a dispatch on the BLOCKED path too (with a `source: 'integrity-blocked-resync'` tag) so the listener pulls the canonical days and the user's view heals to match the DB. The integrity guard's behavior is unchanged — we still don't write — we just stop hiding the truth from the user.

### 3. Eliminate the `hasChanges` race for resync

The current sync gate `if (!hasChanges) setDays(initialDays)` exists to avoid clobbering unsaved edits. But after a successful save, `hasChanges` is set false, then the dispatch fires, then the DB read resolves — so there's a small window where the listener could arrive before `setHasChanges(false)` flushes. To make this robust:

- Switch `hasChanges` to `useRef`-backed truth read inside the effect (`const hasChangesRef = useRef(false); … if (!hasChangesRef.current) setDays(initialDays);`), or
- Equivalently: gate on `hasChanges && !justSaved` where `justSaved` is set by the save handlers immediately around the persist call.

Pick whichever matches the existing pattern in this file. The simpler ref approach is preferred unless `hasChanges` is read elsewhere as state.

### 4. Verification

- Add a test extending `resyncItineraryFromDb.test.ts` with the **Bali timing-shift** scenario: same activity ids, shifted startTime/endTime, asserts fingerprint comparison would change.
- Add a test for the **integrity-blocked resync dispatch**: mock a session-vs-DB shrink, assert dispatch fires with `integrity-blocked-resync` source, assert `error.code === 'INTEGRITY_BLOCKED'` is still returned (behavior preserved).
- Manual: re-run the Bali generation flow in preview, watch console for `[ITIN_RESYNC_DRIFT] kinds:['terminal_end']` immediately after generation completes, and confirm the times rendered match what a hard-refresh would show.

### 5. Out of Scope

- Not changing `parseEditorialDays`, the cascade itself, or any backend pass.
- Not removing the `hasChanges` guard for cases where the user has actively edited and not saved — that protection stays.
- Not extending the fingerprint to include category/title/cost — only timing, which is the verified gap. Extending further risks false positives that would clobber in-flight edits.

## Files Touched

- `src/components/itinerary/EditorialItinerary.tsx` — fingerprint extension; small ref/justSaved adjustment.
- `src/services/safeUpdateItineraryData.ts` — dispatch on INTEGRITY_BLOCKED path.
- `src/lib/itinerary/__tests__/resyncItineraryFromDb.test.ts` — Bali timing scenario + integrity-blocked dispatch test.
- `mem://constraints/itinerary/db-is-source-of-truth.md` — append a "Verified gap & fix" note so the next reviewer doesn't repeat the regression.

No DB migrations. No new edge functions. Roughly 30 lines of code.