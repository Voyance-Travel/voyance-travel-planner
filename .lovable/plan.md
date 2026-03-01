

# Allow Re-joining After Leaving a Trip (Simple MVP)

## How It Works

The invite link system already supports multi-use tokens and re-joining. The `accept_trip_invite` database function handles users who were previously on a trip -- it uses `ON CONFLICT DO UPDATE` so clicking the same invite link again will re-add them. No new tables needed.

The only missing piece is giving collaborators a way to **leave** a trip themselves, and making it clear to owners they can re-send the invite link.

## Changes

### 1. Add "Leave Trip" button for non-owner collaborators

In `TripCollaboratorsPanel.tsx`, add a "Leave Trip" button visible to non-owner members. When clicked:
- Show a confirmation dialog ("Are you sure you want to leave this trip? The owner can send you the invite link to rejoin.")
- Call `removeTripCollaborator` with their own collaborator ID
- Redirect to the dashboard after leaving

### 2. Show a toast hint to owners when removing someone

When an owner removes a collaborator, show a toast like: "Member removed. You can re-send the invite link to let them rejoin."

This reminds the owner that the existing invite link (already in the Share dialog) is all they need.

---

## Technical Details

| File | Change |
|------|--------|
| `src/components/itinerary/TripCollaboratorsPanel.tsx` | Add "Leave Trip" button for non-owners with confirmation dialog; update owner remove toast to hint about re-inviting |

### How re-joining works (already built)
- Owner copies invite link from Share dialog (already exists)
- Sends it to the person who left
- Person clicks link, `accept_trip_invite` runs, re-adds them via `ON CONFLICT DO UPDATE`
- No new database tables, functions, or edge functions needed

