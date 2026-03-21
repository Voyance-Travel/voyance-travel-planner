
Fix the contradiction by making the day-level warning and the Refresh Day validator use the same definition of a bad buffer.

1. Root cause
- The page banner in `src/components/itinerary/EditorialItinerary.tsx` flags any `gap <= 0` between two different locations.
- The backend validator in `supabase/functions/refresh-day/index.ts` does not. Its `getMinBufferMinutes()` returns `0` whenever either activity looks like transit/transport, so a `0 min` gap can be treated as acceptable.
- `src/components/itinerary/RefreshDayDiffView.tsx` then shows “All Good” because it only treats buffers as a problem when `isInsufficient` is true.

2. Backend fix first
- Update `supabase/functions/refresh-day/index.ts` so a `0-minute` gap between distinct places is always flagged, even if one item is a walking/transport segment.
- Add a pair-level helper for “same place / safe handoff” instead of relying only on category names.
- Keep true same-location handoffs ignored, but mark distinct-location `0 min` transitions as `insufficient_buffer` and generate a buffer fix suggestion.
- Make the returned `buffers[]` mark these rows as `isInsufficient: true`, so the UI can trust the refresh result.

3. UI alignment
- In `src/components/itinerary/RefreshDayDiffView.tsx`, keep the header driven by authoritative refresh data, but ensure “All Good” only appears when there are:
  - no issues, and
  - no insufficient buffers
- Update the empty-state copy so it reflects the new rule clearly.

4. Optional consistency cleanup
- In `src/components/itinerary/EditorialItinerary.tsx`, keep hiding the heuristic banner once refresh results exist, but only because the refreshed result will now correctly surface the zero-buffer problem.
- If needed, extract/mirror the same “same place vs real movement” logic client-side so the pre-refresh warning matches the backend more closely.

Files to update
- `supabase/functions/refresh-day/index.ts`
- `src/components/itinerary/RefreshDayDiffView.tsx`
- Possibly `src/components/itinerary/EditorialItinerary.tsx` for small consistency cleanup

Expected result
- Refresh Day will no longer say “All Good” for a `0 min` gap like “Summer Riverside Wander → Scenic Walk to the Latin Quarter” unless it is a true same-location handoff.
- The button becomes useful again because the refresh result will explicitly flag the problem and propose a timing fix instead of silently passing it.
