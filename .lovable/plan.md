
Goal

- Fix the two real issues surfaced by Trip #22:
  1. Phantom pricing still appears in the logged-in experience, but the backend regex is not the current failure point.
  2. Consumer trip “sharing” is architecturally mixed with a separate agency share system, which can show the wrong itinerary.

What I found

- For Trip `3edfd845-7055-4dd6-a77b-7b114f39f66e`, the backend trip JSON already has:
  - `Golden Hour at the Miradouro` at `0`
  - so Prompt 36 did take effect in backend data.
- At the same time, another free venue (`Jardim Botânico`) still carries a small non-zero backend value while the UI can still render it as Free.
- That means pricing is still being decided in multiple places:
  - backend sanitization / generation
  - client display helpers
  - canonical `activity_costs` / sync paths
- So the remaining Miradouro bug is now a unification bug, not a missing regex bug.

- Sharing is also split across two incompatible systems:
  - consumer trip share surfaces (`ShareTripCard`, `TripShareModal`, `EditorialItinerary`) call `resolveInviteLink()` and generate `/invite/:token`
  - public `/share/:shareToken` loads `TripShare`, which reads `agency_trips` via `get_shared_trip_payload`
- Those are different products/data sources. That explains why a “shared URL” can show a different itinerary: the app currently treats collaborator invites and public shared itineraries as if they were the same thing.

Implementation plan

1. Make one pricing source authoritative in the logged-in UI
- Audit the final activity-card price renderer and totals pipeline in `EditorialItinerary`/related helpers.
- Ensure free-venue detection is applied before any fallback estimation or ledger-derived display.
- Stop showing a paid estimate when the trip JSON already says the activity is free.

2. Remove pricing drift between JSON, UI, and ledger
- Normalize the client so free-venue logic uses one shared decision path everywhere:
  - itinerary cards
  - payments/budget surfaces
  - payable item aggregation
  - any activity-cost sync/rebuild path
- Add a final guard so a free public venue never becomes payable again in client reconciliation.

3. Separate “Invite collaborators” from “Public share”
- Keep `resolveInviteLink()` for collaboration only (`/invite/:token`).
- Stop presenting invite links as generic/public share links in consumer trip UI.
- Rename labels/copy so users know this is a join/invite flow, not a public itinerary mirror.

4. Add a real consumer public-share path if public sharing is required
- Create a dedicated consumer-trip read-only share flow backed by consumer trip data, not `agency_trips`.
- Sanitize server payload the same way the agency share flow does.
- Use a separate route/token contract so consumer public share cannot collide conceptually with collaborator invites.

5. Preserve the agency share system, but isolate it
- Leave `/share/:shareToken` as agency-only unless explicitly expanded.
- Prevent consumer trip surfaces from routing users into the agency share page by mistake.

Files most likely involved

- Pricing/UI
  - `src/components/itinerary/EditorialItinerary.tsx`
  - `src/hooks/usePayableItems.ts`
  - `src/lib/cost-estimation.ts`
  - any budget/payments surface that reads `activity_costs`
- Sharing architecture
  - `src/services/inviteResolver.ts`
  - `src/components/sharing/TripShareModal.tsx`
  - `src/components/post-trip/ShareTripCard.tsx`
  - `src/components/itinerary/PostGenerationCTA.tsx`
  - `src/App.tsx`
  - `src/pages/agent/TripShare.tsx`
  - backend read-only payload function for consumer public share

Technical notes

- Do not change `ALWAYS_FREE_VENUE_PATTERNS` again unless a fresh backend miss is proven.
- Do not merge consumer invite tokens and agency share tokens into one ambiguous route.
- Keep collaboration acceptance authenticated.
- Keep any public share payload sanitized and read-only.

Verification

- Logged-in Trip #22:
  - `Golden Hour at the Miradouro` shows Free everywhere
  - `Jardim Botânico` also shows Free everywhere
  - totals match the rendered itinerary
- Fresh Lisbon generation:
  - Miradouro/Jardim cases stay free
  - museums, tours, booking-required items stay paid
- Sharing:
  - collaborator invite opens invite/join flow only
  - public shared consumer itinerary, if enabled, matches the exact underlying trip
  - agency `/share/...` continues to show only agency trips
