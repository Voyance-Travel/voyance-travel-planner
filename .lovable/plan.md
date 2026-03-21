
Fix the deadline issue at the data layer, not the UI.

What’s actually happening
- I checked the live data for “Visit Sacré-Cœur Basilica at sunset” and its `vote_deadline` is still `null`.
- The current `TripSuggestions.tsx` already contains the earlier optimistic/realtime suppression fix (`skipRealtimeRef`), so this is no longer just a stale UI overwrite problem.
- The real backend gap is that `trip_suggestions` has SELECT and INSERT policies, but no UPDATE policy. That means owners/collaborators can create suggestions, but the deadline update is not actually allowed to persist.

Plan
1. Add an UPDATE policy for `public.trip_suggestions`
- Create a migration that allows authenticated users to update their own suggestion rows.
- Restrict it to the row owner (`user_id = auth.uid()`) and only for trips they already have access to, matching the existing INSERT/SELECT access rules.

2. Keep deadline editing ownership-safe
- Ensure only the creator can update the suggestion deadline, which matches the current UI behavior (`isOwner(suggestion)`).

3. Tighten the save flow in `TripSuggestions.tsx`
- After a successful deadline update, trigger a fresh reload for that suggestion list so the saved DB value becomes the source of truth.
- Keep the optimistic update, but make the post-save refresh explicit so we don’t rely only on realtime timing.

4. Improve failure feedback
- If the update is blocked or returns no updated row, show a clearer toast like:
  - “Couldn’t save deadline. You may not have edit permission.”
- This helps distinguish a permissions problem from a display bug.

Files to update
- `supabase/migrations/...sql` — add `FOR UPDATE` policy on `public.trip_suggestions`
- `src/components/suggestions/TripSuggestions.tsx` — small save-flow hardening / clearer feedback

Expected result
- Setting a deadline will actually persist in the database.
- Reloading the page or returning in a later session will show the saved date/time instead of “Set deadline.”
- If a user truly lacks permission, they’ll get a clear message instead of a misleading silent failure.

Technical note
- Evidence from the current project:
  - `TripSuggestions.tsx` already has the realtime suppression fix.
  - The specific suggestion row still has `vote_deadline = null` in the database.
  - Existing migrations define SELECT/INSERT policies for `trip_suggestions`, but no UPDATE policy was found.
