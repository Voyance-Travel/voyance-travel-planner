## Plan

This failure has two parts: the generator can leave the UI in a hotel-only / incomplete itinerary state, and Budget Coach currently still behaves as though it has swappable activities. I’ll add safeguards on both sides.

## 1. Make Budget Coach activity-aware before it calls AI

Update `src/components/planner/budget/BudgetCoach.tsx` so it computes a strict set of live, suggestable activities from the current `itineraryDays`:

- Exclude hotels, flights, check-in/out, accommodation, return-to-hotel rituals, and $0/free items.
- Exclude placeholder/generic titles.
- Require a positive current cost and a live activity ID.

If that live suggestable count is zero:

- Do not call the `budget-coach` backend function.
- Clear any existing suggestions from component state and from the module-level cache for that trip.
- Render an explicit empty-itinerary message instead of “Get Suggestions”, e.g. “No activities to optimize yet. Add restaurants, experiences, or transit before Budget Coach can suggest swaps.”
- Keep the “raise budget” / “edit budget” path available, but remove language that says to remove activities when there are none.

## 2. Prevent stale suggestion cache reuse when itinerary collapses

Still in `BudgetCoach.tsx`:

- Include the live suggestable activity count and IDs in the cache key/hash, not just raw day/title/cost strings.
- When the live suggestable list is empty, force `suggestions = []` and delete `suggestionsCache[tripId]`.
- Reset the `fetchedRef` guard when the itinerary changes from non-empty to empty so the component cannot keep old results in memory.
- Tighten `visibleSuggestions` so it rejects suggestions whose target activity is not currently suggestable, not merely present somewhere in `itineraryDays`.

This directly addresses the phantom restaurants/Hammam suggestions from a previous itinerary.

## 3. Make the backend Budget Coach reject empty or non-positive inputs

Update `supabase/functions/budget-coach/index.ts`:

- Calculate `positiveCandidateCount` after protected/dismissed filtering, using only activities with `cost > 0` and non-placeholder titles.
- If zero, return a clear no-candidates payload, for example:
  - `suggestions: []`
  - `no_candidates: true`
  - `reason: "No current paid itinerary activities to optimize"`
- Avoid setting `all_protected: true` for this case unless there truly were activities and every one was protected.
- Add a final post-filter guard: if all AI suggestions are filtered out, return `no_candidates` or `filtered_empty` metadata instead of letting the UI infer “suggestions available”.

This makes the backend safe even if another frontend caller sends stale or empty data.

## 4. Fix contradictory “swaps won’t bridge” copy for zero-activity states

In `BudgetCoach.tsx`, gate the restructuring panel and bottom savings summary behind `visibleSuggestions.length > 0` and `suggestableActivityCount > 0`.

When there are no activities, do not show:

- “Drop optional activities”
- “Consider removing activities”
- “Swaps alone won’t bridge this gap”

Instead show a recovery-oriented prompt:

- “Your budget is over because of fixed costs, but there are no current activities to trim.”
- CTA options: “Raise budget” if available, and “Add activity” only if there is an existing add-expense/activity hook available. Otherwise keep it informational.

## 5. Add a bare-itinerary warning in the Budget tab

Update `src/components/planner/budget/BudgetTab.tsx` to detect when:

- the trip has hotel/flight costs, but
- `unifiedCostList` has no live activity items, and
- `itineraryDays` has no meaningful non-logistics activities.

Show a warning near the Budget Coach area:

- “This itinerary currently has no restaurants, experiences, or local transit. Budget categories will stay at $0 until activities are added or generation is rerun.”

This makes the failure state visible and prevents users from interpreting $0 Food/Activities/Transit as a valid complete itinerary.

## 6. Add generation-completeness guard for hotel-only output

Update `supabase/functions/generate-itinerary/action-generate-trip-day.ts` near final completion validation:

- Add a trip-level “meaningful activity” count that excludes accommodation, hotel, flight, check-in/out, return-to-hotel, bag-drop, and generic transfer-only logistics.
- On the final day, if the generated itinerary has fewer than a minimum threshold of meaningful activities, do not mark the trip as fully `ready`.
- Mark it `partial` or `failed` with metadata such as:
  - `generation_error: "Generated itinerary has too few real activities"`
  - `bare_itinerary_detected: true`
  - `meaningful_activity_count`

This prevents a hotel-only shell from being treated as a successful itinerary.

## 7. Validation

After implementation, I’ll verify:

- Empty/hotel-only `itineraryDays` renders zero Budget Coach suggestions and no AI call.
- Existing suggestions are cleared when the itinerary changes to empty.
- The backend `budget-coach` function returns `suggestions: []` for empty or all-$0 payloads.
- Normal over-budget itineraries with live paid activities still generate 8–12 grounded suggestions.
- The “consider removing activities” copy never appears when there are no live activities.