## Plan: make Trip Health reflect the active itinerary, not stale/raw data

### Root cause to fix
The rendered itinerary and the health panel are not using the same final day array.

- `TripDetail` passes `editorDays` from `parseEditorialDays(...)` into `TripHealthPanel`.
- `EditorialItinerary` then transforms those days again for display: it injects/removes synthetic departure cards, strips departure-day hotel returns, trims post-departure activities, relabels hotel logistics, and applies local timing/display changes.
- Because `tripHealthPanel` is rendered as a child prop that was created in `TripDetail`, it scores the parent’s pre-display `editorDays`, not the active `days` array inside `EditorialItinerary` that the user is actually seeing.
- That explains all three symptoms: missing meals from stale/sparse day objects, overlap warnings from raw timestamps that no longer match the visible schedule, and departure-day light-schedule warnings that ignore display-side departure/trim logic.

### Implementation
1. **Move health input to the rendered itinerary state**
   - Replace the current `tripHealthPanel` React-node prop pattern with a render callback or equivalent prop that receives `EditorialItinerary`’s final `days` array.
   - Render `TripHealthPanel` inside `EditorialItinerary` using that final `days` array.
   - Keep both mobile and desktop versions using the same active-day source.

2. **Stop local health warnings from inventing policy on partial/stale data**
   - Treat missing-meal checks as advisory only when persisted policy is missing or when the day is first/last with ambiguous travel context.
   - If the currently rendered day visibly has breakfast/lunch/dinner, no missing-meal warning should fire even if metadata is stale.
   - Keep the backend meal guard as the source of truth for real enforcement.

3. **Make timing warnings match rendered times or disappear**
   - Ensure the health engine compares the same visible start/end fields used by itinerary cards.
   - If a timing conflict is resolvable by the cascade preview, suppress it completely instead of showing “Auto-resolves on save.”
   - If timing data is incomplete or ambiguous, skip the warning rather than lowering the score.

4. **Silence departure-day noise**
   - Departure days with checkout/airport-transfer/final-departure cards should not get “light schedule” warnings.
   - Last-day schedules should be scored leniently unless there is a real visible conflict.

5. **Add regression coverage**
   - Add tests for the Sapporo-style case: rendered schedule has a clean 15-minute gap but raw/pre-display data would have produced a conflict.
   - Add tests that final departure days with breakfast + airport transfer do not get light-schedule or missing-meal warnings.
   - Add a test proving the health panel receives transformed/rendered days, not the stale parent `editorDays`.

6. **Fallback if still noisy**
   - If a health issue cannot be proven against the active rendered itinerary, do not display it.
   - Completion/checklist can remain, but noisy health deductions should be suppressed rather than continuing to waste user attention.