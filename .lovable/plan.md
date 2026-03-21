
Fix: Import Activities modal still makes “11:00 AM” look like “1:00 AM”

What I found

- The previously-added backend fix already exists in `supabase/functions/parse-trip-input/index.ts` (the raw-text cross-check around lines 506-547).
- But the screen you described as the “assignment preview” is not using that backend parser. It is the client-side `ImportActivitiesModal` flow in `src/components/itinerary/ImportActivitiesModal.tsx`.
- That modal has its own local parser and its own local `normalizeTime()` implementation.
- In that modal, the parsed time is rendered inside a very narrow native `<input type="time">` (`w-[70px]` around lines 620-633). On some browsers/locales, native time inputs display 12-hour UI and clip the leading digit, so `11:00 AM` can visually appear like `1:00 AM` even when the underlying parsed value is `11:00`.

Plan

1. Unify time parsing in the import modal
- File: `src/components/itinerary/ImportActivitiesModal.tsx`
- Remove the local `normalizeTime()` helper.
- Import and use the shared `normalizeTimeTo24h()` from `src/utils/timeFormat.ts`.
- This eliminates parser drift between import flows and ensures one source of truth.

2. Fix the misleading assignment-preview time UI
- File: `src/components/itinerary/ImportActivitiesModal.tsx`
- Stop relying on the narrow native time input as the only visible representation of the parsed time.
- Show the parsed time as formatted text using the shared formatter (`formatTime12h`) so `11:00` is clearly displayed as `11:00 AM`.
- Keep editing available, but make the editable control non-misleading:
  - either widen the native time input substantially, or
  - render the edit control separately from the preview label.
- Preferred approach: visible formatted label + editable control, so browser-specific native input rendering cannot fake a parsing bug.

3. Add a regression check for the exact repro
- Verify the modal correctly handles:
  - `11:00 AM - Tsukiji Fish Market visit`
  - `1:00 PM - Lunch`
  - `9 AM - Coffee`
  - `14:00 - Museum`
- Confirm the assign screen shows the correct hour and the imported activity lands in the day at the correct time.

Technical details

- Relevant file:
  - `src/components/itinerary/ImportActivitiesModal.tsx`
- Shared utility already available:
  - `src/utils/timeFormat.ts`
- No backend change should be needed for this specific bug, because the issue is in the client-side import/assignment flow, not the backend parsing path.

Expected outcome

- “11:00 AM” no longer appears as “1:00 AM” in the assignment preview.
- All import surfaces use the same time normalization rules.
- The UI becomes resistant to browser-native time input quirks.
