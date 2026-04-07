
Fix regenerate 500 error

Diagnosis
- The 500 is coming from the backend `generate-itinerary` function, not the browser.
- Edge logs show the AI call succeeds first (`[ai-call] ✓ Day 1...`) and then the function crashes with `ReferenceError: dayItinerary is not defined`.
- A `ReferenceError` means code referenced a variable that does not exist in the current scope.
- Do I know what the issue is? Yes — `handleGenerateDay` is using an undefined variable during post-processing, so every regenerate request fails before a response can be returned.

What to change
1. Update `supabase/functions/generate-itinerary/action-generate-day.ts`.
2. Replace the broken `dayTitle: dayItinerary?.theme` inside the `universalQualityPass(...)` call.
3. Use the already-available generated day data instead, following the working pattern already used in `action-generate-trip-day.ts`, for example:
   - `generatedDay?.theme || generatedDay?.title || \`Day ${dayNumber}\``

Why the retries appear
- `src/components/itinerary/EditorialItinerary.tsx` automatically retries failed regenerations at 3s, 8s, and 15s.
- Those warnings are expected retry behavior, but they cannot succeed until the backend crash is fixed.

Verification
1. Trigger “Regenerate Day” again.
2. Confirm the function returns 200 instead of 500.
3. Confirm the retry warnings stop.
4. Confirm the regenerated day updates in the UI through the existing frontend normalization already added in `src/components/planner/steps/ItineraryPreview.tsx`.

Technical details
- Root cause file: `supabase/functions/generate-itinerary/action-generate-day.ts`
- Broken line pattern: `dayTitle: dayItinerary?.theme`
- Reference implementation to mirror: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- No database, auth, RLS, or secrets changes are needed for this fix.
