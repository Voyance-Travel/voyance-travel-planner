## Problem

The Split Bill UI in `PaymentsTab.tsx` only shows real members from `trip_members` plus collaborators. For a 2-guest trip with no invited collaborators, only the trip owner appears, so all 32 items default to "Unassigned" until the second person accepts an email invite. The trip's `travelers` count (which the user has already confirmed) is ignored.

## Plan

### 1. Pre-populate placeholder guests from the trip's `travelers` count

In `src/components/itinerary/PaymentsTab.tsx`, in the `tripMembers` `useMemo` (line 116) that already merges owner + collaborators, append synthetic placeholder rows so the merged list length equals `travelers`:

- Synthetic ID format: `guest-2`, `guest-3`, … (deterministic across renders so split assignments stay stable).
- Display: "Guest 2", "Guest 3", with a subtle "Placeholder" hint badge in the assignment UI.
- `userId: null`, `acceptedAt` set to `new Date()` so they pass any "accepted" filters.
- Add `travelers` to the `useMemo` dependency array.

### 2. Materialize a real `trip_members` row on first assignment

Extend `resolveRealMemberId` (line 465) to handle `guest-N` IDs the same way it handles `owner-` and `collab-` IDs:

- Check if a `trip_members` row already exists with `email = 'guest-N@placeholder.local'` (deterministic email keyed on tripId + index so re-assigning the same guest reuses the row).
- If not, call `addTripMember({ tripId, email: 'guest-N@placeholder.local', name: 'Guest N', role: 'attendee' })`. The existing upsert on `(trip_id, email)` makes this safe.
- Return the new member's real ID so the assignment writes correctly.

This means the UI works instantly with no email invite, and the persistence layer "graduates" the placeholder into a real row only when the user actually splits a bill onto them. No phantom rows for unused seats.

### 3. Allow renaming a placeholder in-place

In the assign-member dialog, if a placeholder guest is shown, render an inline rename pencil icon that calls `updateTripMember({ name })` after first-assign materializes the row. This lets the user turn "Guest 2" into "Sarah" without going through the email invite flow at all. Email invite remains an optional path (e.g. for actually sharing the trip), not a prerequisite for splitting bills.

### 4. Default-split toggle

Add a small "Split evenly across all guests" quick action above the items list. When clicked, it assigns every unassigned item to all `tripMembers` (including placeholders, materializing them on demand). This addresses the "32 items all unassigned" friction in one click for the common case where the user just wants a 50/50 trip.

## Files

- `src/components/itinerary/PaymentsTab.tsx` — placeholder generation in `tripMembers` memo; extend `resolveRealMemberId` to handle `guest-N`; add inline rename + bulk split-evenly button.

No DB migrations, no edge functions, no schema changes — `trip_members` already supports arbitrary email values via upsert on `(trip_id, email)`.

## Expected outcome

- A 2-guest trip immediately shows "Trip Owner" + "Guest 2" in the Split Bill picker — no email invite required.
- One-click "Split evenly" assigns all unassigned items across both seats.
- "Guest 2" can be renamed inline to a real name without sending any emails.
- Email invites still work, and if the second person later accepts, the placeholder row is reconciled by name/email match (logic already in place at lines 154–158).