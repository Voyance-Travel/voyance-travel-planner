## Diagnosis

Sharing is still corrupted because the app currently has two different share systems, and the main itinerary Share button is still using the collaborator-invite flow by default.

What I found:
- The generated invite link for the recent Paris trip is valid: `/invite/4qO9QB7CSOjh` loads the invite page correctly.
- But that link is not a seamless trip share. It asks the recipient to sign in/create an account and “join” the trip.
- The true read-only public share route is `/trip-share/:token`, but the current itinerary Share modal does not expose or enable that flow. It only shows “Invite to Collaborate.”
- The trip currently has `share_enabled=false` and no public share token, so a public share URL would show “Trip Not Found or sharing is disabled.”
- There is a newer `TripShareModal` with both “Public Link” and “Invite to Collaborate,” but the main itinerary page is not using it. Instead, `EditorialItinerary.tsx` has its own older share dialog.
- `TripRecap.tsx` also shares `window.location.href`, which is not a valid public share link for recipients.

## Fix Plan

### 1. Make public read-only sharing the primary share action
- Update the main itinerary Share button in `EditorialItinerary.tsx` so it uses the unified `TripShareModal` instead of the older embedded collaborator-only dialog.
- In that modal, make the “Public Link” the default/primary path: anyone with the link can view the itinerary without signing in.
- Keep “Invite to Collaborate” available, but label it clearly as the edit/join flow.

### 2. Auto-create a working public link when the user shares
- Add a shared helper for consumer public share links, e.g. `getOrCreatePublicTripShareLink(tripId)`.
- The helper will:
  - Check the trip’s existing `share_enabled` / `share_token`.
  - If missing or disabled, call `toggle_consumer_trip_share(tripId, true)`.
  - Return a canonical `https://travelwithvoyance.com/trip-share/{token}` link.
- Use this helper in all consumer “Share Trip” surfaces instead of copying the current private URL.

### 3. Repair Trip Recap sharing
- Replace both `TripRecap.tsx` share handlers that currently use `window.location.href`.
- They should generate/copy/native-share the public `/trip-share/:token` link.
- Optionally reuse `ShareTripCard` or the unified share modal if that fits cleanly, but the key behavior is that recipients get a working public link.

### 4. Fix stale/empty link behavior in the unified share modal
- Ensure Copy / native share / WhatsApp / X never fire with an empty link.
- If the public link is enabled but not loaded yet, create/load it before sharing.
- Show a loading/disabled state while the link is being created.
- Surface backend reasons like `not_authenticated`, `not_owner`, or `trip_not_found` with useful messages instead of generic “Failed to update sharing.”

### 5. Keep collaboration separate and explicit
- Keep `/invite/:token` for adding collaborators only.
- Adjust copy in the share UI so users understand:
  - “Public link” = view-only, no sign-in required.
  - “Invite collaborators” = recipient signs in and joins the trip.
- Avoid naming the collaborator link “share link” in user-facing UI.

### 6. Verify end-to-end
- Use the recent Paris trip as the test case.
- Generate a public share link from the app.
- Open the resulting `/trip-share/:token` URL as an unauthenticated visitor and confirm it loads the 6-day itinerary.
- Confirm `/invite/:token` still works separately for collaborator joining.
- Check console/network for RPC errors and confirm no “Trip Not Found or sharing disabled” on a freshly shared trip.

## Expected Result

When the user clicks Share, the app produces a public read-only itinerary URL that works immediately for anyone. Collaborator invites remain available, but they no longer hijack normal sharing or force recipients through sign-up just to view the trip.