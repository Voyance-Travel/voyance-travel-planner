
Fix plan: stop browser refresh from converting real itinerary days into “unplanned” days

1) Root cause confirmed
- Browser reload triggers TripDetail self-heal.
- Self-heal rebuild currently uses `itinerary_days.activities`, but those are often empty.
- Edge logs show `generate-day` failing to persist normalized activities with:
  - `42P10: no unique or exclusion constraint matching ON CONFLICT` for `itinerary_activities` external-id upsert.
- Result: table rows exist but activity payload is empty; rebuild creates empty days; reload shows “unplanned” days (often 2).

2) Backend persistence fix (primary)
- File: `supabase/functions/generate-itinerary/index.ts`
- In `generate-day/regenerate-day` persistence block:
  - Replace failing external-id upsert path (`onConflict: trip_id,itinerary_day_id,external_id`) with a safe insert strategy that does not rely on that conflict target.
  - Keep UUID-activity upsert path for locked/stable IDs.
  - Ensure generated activities are actually written every run (and response ID mapping still works).

3) Self-heal rebuild fix (prevents empty-day corruption on reload)
- File: `src/pages/TripDetail.tsx`
- In “rebuild itinerary_data.days from itinerary_days” logic:
  - Stop trusting `itinerary_days.activities` as canonical.
  - Rebuild day activities from richest available source:
    1) existing JSON day if non-empty
    2) normalized activities table for that day
    3) only then fallback to day-row activities
  - Do not persist “rebuilt” days that are empty placeholders from weak sources.
  - If missing days remain after rebuild, let existing resume flow regenerate them instead of saving empty unplanned days.

4) Regeneration durability fix (so self-heal changes survive refresh)
- File: `src/pages/TripDetail.tsx`
- In auto-regenerate-empty-days loop:
  - Capture each `regenerate-day` response payload.
  - Merge returned day data into local full itinerary days array.
  - Persist merged itinerary once at end (single save), so page reload does not revert to stale empty JSON.

5) Safety guards
- Only auto-regenerate days that are truly empty (already done) and remain empty after attempted rebuild/merge.
- Keep no-shrink behavior intact by merging day-level updates into full existing itinerary payload before save.

Technical details
- Files:
  - `supabase/functions/generate-itinerary/index.ts`
  - `src/pages/TripDetail.tsx`
- No schema change required for this fix set.
- Optional follow-up hardening (separate): align/replace partial unique index strategy for external IDs so conflict targets are guaranteed valid.

Validation checklist
- Reproduce on an affected multi-day trip where reload currently creates 2 unplanned days.
- Reload test: days stay populated after refresh.
- Verify no new `42P10` errors in `generate-itinerary` logs.
- Verify self-heal rebuild never writes empty placeholder days when richer data exists.
- Verify end-to-end: generate → reload → regenerate one day → reload again (data remains stable).
