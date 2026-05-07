Root cause: this is not just a card text bug. There are three surviving leak paths:

1. `sanitizeActivityName` still returns `Spa Time — find a venue` for non-spa hotel/logistics rows when only the title looks spa-like, because callers outside `EditorialItinerary` still pass no full activity context.
2. The final save-time `terminalCleanup` only runs the dining placeholder sweep. It imports `nuclearWellnessSweep` but does not call it, so wellness placeholders introduced by meal guard/manual save/assistant edits can still persist.
3. Wrong-city removal only checks dining/sightseeing/museum/culture/shopping. Wellness/spa and some activity categories are not removable, so bad venue matches can survive every run.

Plan:

1. Make wellness display sanitization fail-closed for hotel/logistics rows
   - Update `sanitizeActivityName` so literal `Spa Time — find a venue` is never shown for hotel, accommodation, stay, transport, transit, logistics, check-in/out, freshen-up, or return-to-hotel entries.
   - If the row has a real attached hotel/venue name, show the hotel/venue-oriented title instead of the template.
   - Keep the placeholder only for actual unresolved wellness/spa rows with no usable venue.

2. Add a canonical helper for full-context title rendering
   - Add/export a small helper around `sanitizeActivityName` that always passes `category`, `startTime`, and the full activity object.
   - Replace remaining high-risk UI calls that currently call `sanitizeActivityName(activity.title)` without context: `FullItinerary`, `LiveItineraryView`, booking modals, planner streaming cards, and editor helpers.
   - This prevents the same bug from reappearing on a different itinerary surface after the main `EditorialItinerary` path was patched.

3. Add a true final save-time wellness sweep
   - In `terminalCleanup`, call `nuclearWellnessSweep(activities, city, hotelName)` after the dining placeholder sweep.
   - Extend `TerminalCleanupOptions` and the `save-itinerary` call site to pass the trip/hotel name when available.
   - Ensure the final persisted JSON cannot contain `Spa Time — find a venue` unless the row is explicitly user-locked/manual.

4. Expand wrong-city venue removal coverage
   - Add `wellness`, `spa`, `activity`, `entertainment`, and `relaxation` to the cross-city removable category list in both enrichment and post-enrichment address filtering.
   - Preserve locked/manual/user-pinned rows per Universal Locking.
   - Add a small guard so wrong-city `location.address` on wellness/spa rows is removed before save rather than displayed.

5. Regression tests for the exact recurring failures
   - Add client tests proving:
     - non-spa hotel/logistics row with `Spa Time — find a venue` does not display that label;
     - verified spa venue still displays `Spa Session at JW Venice Spa`;
     - unresolved spa still displays the find-venue affordance.
   - Add server tests proving:
     - `terminalCleanup` removes/rewrites wellness placeholders;
     - cross-city wellness/spa rows are treated as removable.

Success criteria:
- No generated/saved itinerary should display `Spa Time — find a venue` on hotel/non-spa cards.
- Real spa rows show the actual venue name.
- Unresolved wellness rows are removed, downgraded to hotel-spa time, or shown as unresolved only if genuinely no venue exists.
- Wrong-city venues are removed for wellness/spa/activity surfaces, not just meals and museums.