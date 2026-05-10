## Auto re-blend itinerary when a collaborator's `include_preferences` toggles

**Problem.** `handleTogglePreferences` in `TripCollaboratorsPanel.tsx` (lines 212–225) only writes `include_preferences` to `trip_collaborators` and shows a toast that *implies* the itinerary will update. No regeneration ever fires. The trip keeps the old blend until the owner notices `BlendRecalcBanner` and clicks "Regenerate".

**Goal.** Toggling preferences ON or OFF should automatically re-blend the itinerary, with a clear toast and the existing in-flight UI taking over for the joiner/owner.

### Why we don't ship the literal snippet

Same constraints as the join-flow change we just landed:

1. `generate-itinerary` has no action `regenerate-trip-with-blend`.
2. The proof-of-charge gate would 403 the call (toggler isn't necessarily the owner; even when they are, no charge exists).
3. The trip-level status column is `trips.itinerary_status`, not `generation_status`.

We already built the right primitive last turn: **`supabase/functions/regenerate-on-blend-change`** validates the caller, flips `itinerary_status` to `generating`, then chains to `generate-trip` with the owner's `userId` via service-role bypass. We reuse it here.

### Implementation

**`src/components/itinerary/TripCollaboratorsPanel.tsx` — `handleTogglePreferences` only.**

Replace lines 212–225 with:

```ts
const handleTogglePreferences = async (collaborator: TripCollaborator) => {
  setUpdatingPreferences(collaborator.id);
  const newValue = !(collaborator.include_preferences ?? true);

  const { error } = await supabase
    .from('trip_collaborators')
    .update({ include_preferences: newValue })
    .eq('id', collaborator.id);

  if (error) {
    toast.error('Failed to update preference setting');
    setUpdatingPreferences(null);
    return;
  }

  // Both directions change the blend — toggling OFF must remove the influence too.
  const message = newValue
    ? 'Preferences included — re-blending itinerary now…'
    : 'Preferences excluded — re-blending itinerary now…';
  toast.success(message, { duration: 5000 });

  // Fire-and-forget. Server short-circuits if itinerary_status !== 'ready'
  // (e.g. trip not generated yet, or another regen in progress).
  supabase.functions
    .invoke('regenerate-on-blend-change', { body: { tripId } })
    .catch((err) => {
      console.error('[collaborators] blend regen invoke failed', err);
    });

  setUpdatingPreferences(null);
};
```

Notes:
- `tripId` is already a prop on this component (line 84/66).
- The fire-and-forget pattern matches `AcceptInvite.tsx`. We don't await — the existing trip-detail generation-progress UI takes over once `itinerary_status` flips to `generating`.
- No DB writes other than the existing `update`. No new edge function, no migration.
- If the trip was never generated (`itinerary_status !== 'ready'`), the server returns `{ skipped: true, reason }` and the toast is the only visible effect — appropriate, since there's nothing to re-blend yet.

### Verification

1. Trip already generated, two collaborators (B + C). Owner toggles B's preferences OFF → toast "Preferences excluded — re-blending itinerary now…", trip page shows generating progress, after regen `blended_dna.travelerProfiles` no longer contains B.
2. Toggle B back ON → toast with the include copy, regen runs, B reappears in the blend with even-split weight (matches the 1/N rule shipped earlier).
3. Toggle on a draft trip (`itinerary_status='not_started'`) → server returns skipped, no regen runs, no error surfaces.
4. Rapid double-toggle → second invoke hits the in-progress short-circuit (returns `{skipped:true, reason:'in_progress'}`); no double-spend, no double regen.

### Files touched

- **Edited:** `src/components/itinerary/TripCollaboratorsPanel.tsx` (one function)
- No backend changes — reuses `regenerate-on-blend-change` deployed last turn.
