
Root cause: the bug is no longer in the modal shift code. It’s in the dry-run overflow pipeline that runs immediately after it.

What’s actually going wrong
- `handleUpdateActivityTime` already detects midnight clamping and adds:
  - `__truncatedAtMidnight: true`
  - `__originalDurationMinutes`
- But then the result is passed into `previewCascadeOverflow(shifted)`.
- `previewCascadeOverflow` calls `cascadeFixOverlaps`, and that utility re-processes the activities using `durationMinutes` as the source duration.
- For a clamped survivor like Lunch, `durationMinutes` is already reduced to `29`, so the dry-run can treat it as a normal 29-minute activity instead of a truncated 90-minute one.
- That means the UI sees:
  - a survivor in `kept`
  - no reliable truncation flag/original duration
  - therefore no amber warning in the dialog and no post-confirmation warning toast

Implementation plan

1. Fix `src/utils/injectHotelActivities.ts`
- Make `cascadeFixOverlaps` preserve existing truncation metadata instead of re-deriving from shortened `durationMinutes`.
- Introduce one canonical “intended duration” per activity:
  - `__originalDurationMinutes`
  - else `endTime - startTime`
  - else `durationMinutes`
  - else fallback

2. Update both passes in `cascadeFixOverlaps`
- First overlap-fix pass must use the canonical intended duration, not `durationMinutes || 30`.
- Second midnight-clamp pass must also use the canonical intended duration and must preserve any existing truncation marker instead of skipping/overwriting it incorrectly.

3. Tighten the drop/warn decision
- In the final filter, compare the kept duration against the preserved intended/original duration.
- This ensures `11:30 PM → 11:59 PM` is evaluated as `29 of 90`, not `29 of 29`.

4. Keep the UI unchanged
- The dialog/trailing toast logic in `EditorialItinerary.tsx` is already wired to `pendingCascade.kept.filter(a => a.__truncatedAtMidnight)`.
- Once the utility preserves metadata correctly, the existing warning UI should start working without extra UI changes.

Technical details
- Current weak points in `src/utils/injectHotelActivities.ts`:
  - line using `const origDuration = result[i].durationMinutes || 30`
  - second pass using `const origDuration = act.durationMinutes || 30`
- Those lines ignore `__originalDurationMinutes`, which is the exact metadata the earlier fix added.
- The real fix is to make the overflow utility metadata-aware, because that utility is the final authority for:
  - `pendingCascade.kept`
  - `pendingCascade.dropped`

Expected result
- After “Shift anyway,” a surviving truncated Lunch should no longer silently remain as an ordinary 29-minute activity.
- It should either:
  - be dropped if it falls below the 50% rule, or
  - remain in `kept` with `__truncatedAtMidnight` and show the warning in the dialog/toast.
