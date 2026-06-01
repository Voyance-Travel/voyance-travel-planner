# AI Concierge Note Persistence Fix

## Problem
`persistDaysImmediately` in `EditorialItinerary.tsx` (line 2979) invokes `save-itinerary` with no `saveReason` and no `skipContract`. The note merges into local React state and a "Note saved" toast fires, but server-side `enforceContractOnDays` can rebuild/drop the activity (placeholder/phantom/cross-city rules), wiping `aiNotes` on the way through. After reload the note is gone.

Note saves are pure metadata writes on user-touched activities — they must never trigger contract row drops.

## Fix (one file, two-line body change)

`src/components/itinerary/EditorialItinerary.tsx` — `persistDaysImmediately` invoke body:

```ts
body: {
  action: 'save-itinerary',
  tripId,
  itinerary: itineraryData,
  saveReason: 'user-ai-note-save',  // whitelisted 'user-' prefix → passes frozen gate
  skipContract: true,                // bypass enforceContractOnDays row drops
}
```

Both flags are already first-class on the edge function (`USER_SAVE_REASON_PREFIXES` in `frozen-guard.ts`; `skipContract` documented in `persist-itinerary.ts`, already used by lock toggles). Duration normalization + artifact string scrubs still run.

This also makes the function future-proof: once the trip flips to `ready`/frozen, the whitelisted reason keeps note saves working instead of silently no-op'ing.

## Scope
- One file edited: `src/components/itinerary/EditorialItinerary.tsx`
- No backend changes, no schema changes, no UI changes

## Verification
- Save note on an activity → reload trip → note still attached (covered by existing `e2e/concierge-notes.spec.ts`)
- Delete note on an activity (same persist path) → reload → note gone
- No edge function logs show `enforceContractOnDays drop` for note-save reasons
