
Fix the overlap warning at its source in the transit conflict formatter so negative gaps never render as raw math like `-660 min`.

What I found:
- The bad copy comes from `checkScheduleConflict` in `src/hooks/useTransitEstimate.ts`.
- It currently always says: `you only have a ${gapMinutes} min gap`, even when `gapMinutes` is negative.
- The Add Activity dialog gets this message through `TransitPreview`, which calls `checkScheduleConflict(...)` for the recommended route.
- `TransitPreview` already has a better fallback message for some overlap cases (`These activities overlap by X minutes`), but that branch is bypassed whenever a recommended transit estimate exists.

Plan:
1. Update `checkScheduleConflict` to branch on negative gaps:
   - `gapMinutes < 0` → user-friendly overlap message like:
     - `This is 9 min away, and these activities would overlap by 11h. Consider adjusting the timing.`
   - `gapMinutes >= 0` → keep the current “you only have X min gap” style.
2. Reuse the existing duration formatter (`formatDuration` in `src/utils/plannerUtils.ts`) so long overlaps show as `11h` / `1h 30m` instead of raw minute counts.
3. Keep the logic centralized in the hook so the fix applies consistently anywhere else this helper is used, not just in the Add Activity dialog.
4. Optionally align the fallback overlap copy inside `TransitPreview` to use the same formatted duration string, so both paths read consistently.

Expected result:
- Instead of `you only have a -660 min gap`, users will see plain language like `these activities would overlap by 11h`.
- Positive-gap warnings remain unchanged.
