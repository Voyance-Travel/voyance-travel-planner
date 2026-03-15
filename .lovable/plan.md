

## Fix: Multi-City Journey Trips Don't Blend DNA or Show Attribution Dots

### Root Cause

When a multi-city trip is split into journey legs via `splitJourneyIfNeeded.ts`, it creates new trip rows for each leg but **never copies `trip_collaborators` or `trip_members`** from the original trip to the new leg trips (lines 204-212).

When each leg's generation runs, `getCollaboratorPreferences(supabase, tripId)` queries collaborators for that specific leg's trip ID — finding zero. Result: no blending, no `suggestedFor` attribution, no DNA dots.

Similarly, `triggerNextJourneyLeg()` (line 6550-6571) invokes generation for subsequent legs but doesn't pass any collaborator context — it only forwards basic trip fields.

### Fix Plan

**File: `src/utils/splitJourneyIfNeeded.ts`** — After inserting leg trips (line 213), copy collaborators and members from the original trip to each leg:

```typescript
// After leg trips are created (~line 213)
// Copy trip_collaborators from original trip to all legs
const { data: originalCollabs } = await supabase
  .from('trip_collaborators')
  .select('user_id, permission, include_preferences, accepted_at, invited_by')
  .eq('trip_id', originalTripId);

if (originalCollabs?.length) {
  const collabInserts = legs.flatMap(leg =>
    originalCollabs.map(c => ({
      trip_id: leg.id,
      user_id: c.user_id,
      permission: c.permission,
      include_preferences: c.include_preferences,
      accepted_at: c.accepted_at,
      invited_by: c.invited_by,
    }))
  );
  await supabase.from('trip_collaborators').insert(collabInserts);
}

// Copy trip_members from original trip to all legs
const { data: originalMembers } = await supabase
  .from('trip_members')
  .select('user_id, role')
  .eq('trip_id', originalTripId);

if (originalMembers?.length) {
  const memberInserts = legs.flatMap(leg =>
    originalMembers.map(m => ({
      trip_id: leg.id,
      user_id: m.user_id,
      role: m.role,
    }))
  );
  await supabase.from('trip_members').insert(memberInserts);
}
```

This single change fixes both issues because:
1. Each leg now has the same collaborators, so `getCollaboratorPreferences` finds them → **blending works**
2. The collaborator/member rows exist on each leg, so the `suggestedFor` attribution prompt and backfill logic → **DNA dots work**
3. The `triggerNextJourneyLeg` function already calls `generate-trip` which runs the full blending pipeline — it just needs the collaborator rows to exist on the leg's trip ID

### Files to Modify

| File | Change |
|------|--------|
| `src/utils/splitJourneyIfNeeded.ts` | After inserting leg trips, copy `trip_collaborators` and `trip_members` from original trip to all legs |

