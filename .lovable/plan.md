
Fix missing sparkle on regenerated trips

What I found
- The sparkle button already exists in planner-only components: `CustomerDayCard` and `TripActivityCard`.
- Regenerated/saved trips are not rendered with those components. They go through `TripDetail` → `EditorialItinerary` → `DayCard` / `ActivityRow`.
- `EditorialItinerary` currently has no concierge trigger at all, so hover is not the issue on that screen — the button is simply never rendered there.
- There is also a compatibility gap: `ActivityConciergeSheet` currently expects a numeric `cost`, but `EditorialActivity` uses `cost.amount`, so its context normalization needs to be adapted before reuse here.
- One more issue to handle cleanly: concierge “swap + undo” cannot call the paid swap path twice, or undo could accidentally retrigger credits/version logic.

Implementation plan
1. Add the concierge trigger to the actual regenerated-trip card UI
- Update `src/components/itinerary/EditorialItinerary.tsx` so `ActivityRow` shows a visible sparkle button in both:
  - desktop action area
  - mobile expanded action row
- Keep it always visible when eligible, not hover-only.

2. Apply the correct visibility rules in `EditorialItinerary`
- Show for venue-based activities like dining, explore, culture, activity, shopping, wellness, and real hotel/stay cards.
- Hide for transport/logistics/filler cards such as:
  - transport / transit / travel
  - arrival / departure
  - return to hotel / freshen up
  - generic downtime cards

3. Wire `ActivityConciergeSheet` into `EditorialItinerary`
- Add top-level concierge state in `EditorialItinerary` for:
  - selected activity
  - selected day date/title
  - previous visible activity
  - next visible activity
- Pass an `onOpenConcierge` callback down into `ActivityRow`.
- Render one shared `ActivityConciergeSheet` near the existing drawers at the bottom of `EditorialItinerary`.

4. Adapt the sheet for `EditorialActivity`
- Update `src/components/itinerary/ActivityConciergeSheet.tsx` to normalize:
  - `cost?.amount`
  - `image_url` / `photos`
  - `website` / `bookingUrl`
  - `startTime` / `time`
- Make sure the sheet gets the same full trip context in regenerated-trip view as it already gets in planner preview.

5. Make concierge swapping safe in the real itinerary flow
- Route concierge swaps through `EditorialItinerary`, not directly through the sheet.
- Reuse the existing swap target / replacement logic where possible.
- Move undo/application responsibility to the parent so:
  - swap applies once
  - undo does not retrigger paid swap logic
  - existing version history + enrichment behavior still works

Files to update
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/components/itinerary/ActivityConciergeSheet.tsx`

Technical details
- Best insertion points in `EditorialItinerary` are the current lock / more-action areas in `ActivityRow`.
- Use the already-computed visible-neighbor logic (`prevVisibleActivity` / next visible activity) so concierge context is accurate even with grouped/optional activities.
- Keep existing “Find Alternative” and “Propose Replacement” actions intact; this adds concierge support to the real itinerary renderer rather than replacing other tools.

How to verify
- Open a regenerated trip in the main trip detail view and confirm the sparkle appears on eligible activity cards.
- Confirm it does not appear on transport/logistics/filler cards.
- Open the concierge from dining, museum, and hotel cards and check that the sheet has the correct title, time, image, and contextual opener.
- Test desktop and mobile.
- Test “Suggest an alternative” from the concierge and verify the card updates once and undo works without triggering duplicate swap/credit behavior.
