
Root causes confirmed from the codebase:

1. Move Up transit bug is still broken because the transport filter is incomplete.
- `EditorialItinerary.tsx` excludes only `transportation` and `transport`.
- Actual inserted transit rows are created with `type: 'transit'` and `category: 'transit'`.
- Result: Walk/Metro rows still enter the reorder timing cascade, which explains the unchanged +75 min inflation.

2. Midnight truncation is still broken because the overflow preview is not modeled as a true 3-way classification.
- The dialog UI can render a shortened-items section, but `pendingCascade` only stores `kept` and `dropped`.
- Shortened survivors are inferred indirectly from `kept.filter(__truncatedAtMidnight)`.
- If that metadata is missing/stale for any reason, the preview falls back to binary behavior: removed vs kept-full.
- There is also a design gap: the dialog only opens when `dropped.length > 0`, so “shortened but not removed” cases are not first-class.

Implementation plan

1. Fix transit exclusion in `src/components/itinerary/EditorialItinerary.tsx`
- Expand `isTransportActivity` to include `transit`.
- Use that updated helper everywhere reorder/move logic builds the visible reorderable set.
- Keep the post-reorder re-anchoring for transit rows, but make sure it applies to `transit` rows too.

2. Make overflow preview return explicit 3-way results in `src/utils/injectHotelActivities.ts`
- Change `previewCascadeOverflow` to classify activities into:
  - `kept`
  - `truncated`
  - `dropped`
- Use one canonical intended-duration helper:
  - `__originalDurationMinutes`
  - else parsed `endTime - startTime`
  - else `durationMinutes`
- During preview:
  - if clamped past midnight and still above the 50% rule, put it in `truncated`
  - if clamped below the 50% rule, put it in `dropped`
- This removes reliance on “did a flag happen to survive in kept?”

3. Update `pendingCascade` in `src/components/itinerary/EditorialItinerary.tsx`
- Store `truncated` explicitly alongside `kept` and `dropped`.
- Open the confirmation dialog when either bucket is non-empty, not only when items are dropped.
- Render the amber section from `pendingCascade.truncated`, not from `kept.filter(...)`.

4. Align confirmation behavior with policy
- On confirm:
  - apply `kept`
  - show removal toast for `dropped`
  - show warning toast for `truncated`
- In your reported Lunch case (`29 of 90 min`), the corrected logic should classify it as `dropped`, not silently keep it.

Expected outcome

- Bug #7: Move Up on Lunch will stop including Walk/Metro rows in the visible timing cascade, so Palais should no longer jump by +75 minutes.
- Bug #2: The overflow dialog will stop acting binary.
  - Severely shortened survivors will be moved into the removal list.
  - Mildly shortened survivors will appear in an explicit amber “will be shortened” section before confirmation.
  - Truncation-only cases will also trigger the confirmation dialog.
