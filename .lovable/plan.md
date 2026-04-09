
What I found

- I checked the latest Just Tell Us trip records from today.
- The newest chat-created trip is storing a very large flat `mustDoActivities` list, but `perDayActivities` is still missing.
- For long multi-city trips, the app then splits the trip into journey legs. During that split, only flat must-dos are carried forward, and generic items that do not mention a city get dumped into leg 1.
- That means the generator never receives the real day-by-day locked plan for each leg, so it falls back to inventing activities.

Root cause

1. The structured day-by-day extraction is still not reliably making it into `perDayActivities`.
2. Even if it does, `splitJourneyIfNeeded.ts` currently does not preserve `perDayActivities` when creating journey legs.
3. The current leg-splitting logic filters `mustDoActivities` by city-name matching, which breaks pasted itineraries because entries like “Breakfast”, “Pool”, “Meet”, “Session”, etc. do not contain city names.

Plan

1. Harden Just Tell Us extraction at the source
   - Add a deterministic fallback parser in `supabase/functions/chat-trip-planner/index.ts`.
   - If the AI tool response omits `perDayActivities` but the pasted text clearly has dated/day headings, build `perDayActivities` directly from the user’s text instead of trusting the model output.
   - Keep `mustDoActivities` only as a secondary fallback.

2. Add a fail-safe before generation
   - In `src/components/planner/TripChatPlanner.tsx` and/or `TripConfirmCard.tsx`, show how many structured days were captured.
   - If the user pasted a day-by-day itinerary but `perDayActivities` is empty, block “Confirm & Generate” and prompt for correction instead of silently continuing.

3. Preserve structured days through trip creation and splitting
   - Keep `perDayActivities` on the original trip in `src/pages/Start.tsx` (this part is already in place).
   - Update `src/utils/splitJourneyIfNeeded.ts` to carry `perDayActivities` into each split leg, filtered to that leg’s day range and renumbered relative to the leg.
   - Build each leg’s `mustDoActivities` from that leg’s own `perDayActivities` instead of city keyword filtering.

4. Remove the current multi-city corruption path
   - Stop assigning all “unassigned” generic must-dos to the first leg.
   - Only use the current city-name filtering as a legacy fallback for older trips that truly do not have structured day data.

5. Add generation guardrails
   - In the generation preflight (`generate-itinerary` path), detect chat-planner trips/journey legs that are missing `perDayActivities`.
   - Refuse to do a free-form build in that case and surface a clear error/log instead of generating a made-up itinerary.

6. Verify against your exact pasted itinerary
   - Confirm the original trip stores a full `perDayActivities` array.
   - Confirm each journey leg stores only its own days.
   - Confirm generation logs show locked cards being applied.
   - Confirm Marrakech/Casablanca/Lisbon entries are preserved exactly, with AI only filling `TBD` or open gaps.

Technical details

- Main files:
  - `supabase/functions/chat-trip-planner/index.ts`
  - `src/components/planner/TripChatPlanner.tsx`
  - `src/components/planner/TripConfirmCard.tsx`
  - `src/pages/Start.tsx`
  - `src/utils/splitJourneyIfNeeded.ts`
  - `supabase/functions/generate-itinerary/action-generate-trip.ts` or `pipeline/compile-prompt.ts`
- No database changes are needed.
- The lock/merge/verify generation pipeline itself looks correct; the real failure is that the structured day-by-day plan is being lost before it reaches that pipeline.
