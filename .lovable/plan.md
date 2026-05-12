Do I know what the issue is? Yes.

The restaurant-description fix was added, but it was placed only in the non-venue rendering branch. Dining cards that have a real venue take the `if (venue)` branch and return before the description JSX, so the fallback never renders. That is why the screenshot still shows a restaurant name with no description.

There is also a second display-order problem: `parseItineraryDays` can add read-time hotel-return bookends before `EditorialItinerary` later injects the final departure flight/transport card. The final-departure cleanup currently preserves accommodation cards, so a synthetic “Return to hotel” can survive after the traveler has already departed.

Plan:

1. Fix dining-card rendering in `src/components/itinerary/EditorialItinerary.tsx`
   - Move the resolved description rendering so it runs for both branches:
     - dining cards with a venue
     - dining/activity cards without a venue
   - Keep compact mode behavior intact.
   - Continue using `resolveActivityDisplayDescription(...)` so existing descriptions, `whyThisFits`, and deterministic dining fallback all work.

2. Fix final-departure cleanup in `src/components/itinerary/EditorialItinerary.tsx`
   - When final departure transport is injected, remove synthetic hotel-return/read-time bookends that would occur after checkout/departure.
   - Preserve real checkout/check-in hotel logistics, but do not preserve “Return to hotel” accommodation bookends on the final departure day.
   - Keep locked/manual user activity protections unchanged unless the card is a synthetic read-time bookend.

3. Add focused regression coverage
   - Add or update a frontend test that proves a dining card with `location.name` still renders/receives a display description.
   - Add a parser/display-pipeline test or helper test for “last day + final departure transport must not retain a read-time Return to hotel card.”

4. Validate with targeted tests
   - Run the relevant Vitest files only.
   - If tests aren’t already set up around this component branch, validate via a small extracted helper/unit test rather than broad rewrites.