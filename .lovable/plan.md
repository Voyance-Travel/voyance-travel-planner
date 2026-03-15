

## Multi-User Itinerary Gaps: Audit Results

### Current Architecture

Two parallel systems track trip participants:
- **`trip_collaborators`** — Authenticated friends linked via user_id (used for DNA blending, permissions, generation)
- **`trip_members`** — Email-based budget/payment participants (used for expense splitting, payments tab)

These are merged in the UI (PaymentsTab, EditorialItinerary color map) but are **not kept in sync** during key operations.

---

### Gaps Found

#### GAP 1: Adding Collaborator Doesn't Create `trip_members` Row (HIGH)

When `addTripCollaborator()` is called (via TripCollaboratorsPanel or LinkToTripModal), it inserts into `trip_collaborators` only. It does **not** create a corresponding `trip_members` row. This means:
- The new collaborator won't appear in the Payments/Budget tab until manually added there
- Expense splitting excludes them
- The PaymentsTab has a workaround that merges collaborators into members at render time, but this is read-only — expenses assigned to synthetic IDs need resolution

By contrast, `removeTripCollaborator()` correctly cleans up both tables.

**Fix**: In `addTripCollaborator()`, after inserting into `trip_collaborators`, also upsert into `trip_members` with the collaborator's email and name from their profile.

#### GAP 2: Journey Legs Not Updated When Collaborator Added Post-Split (HIGH)

`splitJourneyIfNeeded` copies collaborators/members to all legs at split time. But when a collaborator is added **after** the journey has been split, `addTripCollaborator()` only inserts into the parent trip's `trip_collaborators`. The journey legs never receive the new collaborator.

This means: the new person's DNA won't be blended into leg generations, they won't have permissions on leg trips, and their attribution dots won't appear on leg itineraries.

**Fix**: In `addTripCollaborator()`, after the main insert, check if the trip has a `journey_id`. If so, query all sibling legs and insert the collaborator into each leg's `trip_collaborators` (and `trip_members`).

#### GAP 3: `BlendRecalcBanner` Not Rendered in EditorialItinerary (MEDIUM)

The `BlendRecalcBanner` component exists and correctly detects when companions have changed since the last blend. However, it is **never rendered** anywhere — `EditorialItinerary.tsx` does not import or use it despite importing the component. The banner that would prompt users to regenerate after adding/removing members is dead code.

**Fix**: Render `<BlendRecalcBanner tripId={tripId} onRegenerate={handleRegenerate} />` in the EditorialItinerary layout, likely above the day cards.

#### GAP 4: `trip_members` Not Propagated to Journey Legs on Post-Split Add (MEDIUM)

Same as GAP 2 but for the `trip_members` table. When a member is added via TripMembersPanel (email invite) after journey split, only the parent trip gets the row. Expense tracking on individual legs won't include them.

**Fix**: In `addTripMember()` (tripBudgetAPI), check for `journey_id` and propagate to sibling legs.

#### GAP 5: Removing Collaborator Doesn't Clean Journey Legs (MEDIUM)

`removeTripCollaborator()` deletes from the parent trip's `trip_collaborators` and `trip_members`, but does **not** cascade to journey leg trips. The removed person retains access and DNA influence on all legs.

**Fix**: In `removeTripCollaborator()`, after the main delete, query sibling legs by `journey_id` and delete matching rows.

---

### Implementation Plan

| Priority | Gap | File | Change |
|----------|-----|------|--------|
| 1 | GAP 1 | `src/services/tripCollaboratorsAPI.ts` | After inserting collaborator, fetch their profile email and upsert into `trip_members` |
| 2 | GAP 2+4 | `src/services/tripCollaboratorsAPI.ts` | After add, check `journey_id` on the trip, query sibling legs, insert collaborator + member into each |
| 3 | GAP 3 | `src/components/itinerary/EditorialItinerary.tsx` | Render `BlendRecalcBanner` above day cards when itinerary exists |
| 4 | GAP 5 | `src/services/tripCollaboratorsAPI.ts` | In `removeTripCollaborator`, cascade delete across journey legs |
| 4b | GAP 5 | `src/services/tripBudgetAPI.ts` | In `removeTripMember`, cascade delete across journey legs |

### Files to Edit
- `src/services/tripCollaboratorsAPI.ts` (GAPs 1, 2, 5)
- `src/services/tripBudgetAPI.ts` (GAPs 4, 5b)
- `src/components/itinerary/EditorialItinerary.tsx` (GAP 3)

