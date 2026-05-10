## Problem

The bottom-of-day toolbar **Refresh** button in `EditorialItinerary.tsx` (line 10925, plus a duplicate "Refresh Day" button on the buffer-warning strip at line 10507) calls `handleRefreshDay`, which already invokes `refresh-day` and stores results. However, the diff is rendered as an *inline* `RefreshDayDiffView` block at the very bottom of the day (line 11000) — below transit subtotal, day total, and any unchanged-activity rows. On long days the user never sees it scroll into view, so the click feels silent. Toasts also fire but get drowned out, and there is no modal-style accept/reject affordance like the AI chat "Review first" pattern.

## Goals

1. Spinner on the button while in flight (already wired via `isRefreshingDay` — verify both buttons keep working).
2. On response:
   - `issues.length === 0` → success toast `Day timeline checked — looks clean`.
   - `issues.length > 0` → open a **Sheet** with each proposed change as an accept/reject row (same UX as the chat Review-first flow), instead of relying on the inline diff that can sit below the fold.
3. On error (network failure, function throw) → `toast.error('Refresh failed — please try again')` and `console.error`.

## Implementation

### 1. New component: `src/components/itinerary/RefreshDaySheet.tsx`

A `Sheet` (shadcn, side="right" on desktop, "bottom" on mobile) that wraps the existing `RefreshDayDiffView` content. Props:

```ts
interface RefreshDaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayNumber: number;
  result: RefreshResult | null;
  onAcceptAll: (changes: ProposedChange[]) => void;
  onAcceptSelected: (changes: ProposedChange[]) => void;
  onFindAlternative?: (activityId: string, activityTitle: string) => void;
}
```

Internally it reuses `RefreshDayDiffView` for the diff/accept-reject body so we don't duplicate the per-change rendering (it already supports cherry-pick + Accept All).

### 2. Wire it in `EditorialItinerary.tsx`

- Add state: `const [refreshSheetDay, setRefreshSheetDay] = useState<number | null>(null);`
- Update `handleRefreshDay` (around line 2452):
  - Keep `setRefreshingDayNumber` for the spinner.
  - On success:
    - `issues.length === 0` → `toast.success('Day timeline checked — looks clean')`. **Do not** open the sheet. Clear any prior `refreshResults[dayNumber]`.
    - `issues.length > 0` → store result in `refreshResults` and call `setRefreshSheetDay(day.dayNumber)` to open the sheet. Keep the existing summary toast as a secondary signal.
  - On `result == null` or thrown error → `toast.error('Refresh failed — please try again')` + `console.error('[handleRefreshDay] failed', err)`.
  - Remove the `requestAnimationFrame` scroll-into-view block (sheet replaces it).
- Render `<RefreshDaySheet>` once at the editor root (outside the per-day map), driven by `refreshSheetDay` and `refreshResults[refreshSheetDay]`.
- On accept/dismiss inside the sheet: call existing `handleApplyRefreshChanges` / `setRefreshResults` cleanup, then `setRefreshSheetDay(null)`.

### 3. Inline diff view

Remove (or hide behind a `viewMode === 'inline'` flag, defaulted off) the inline `<RefreshDayDiffView>` render at line 11000 so we have a single surface. Keep the component itself — the sheet reuses it.

### 4. Spinner verification

Both buttons (lines 10507 buffer-warning strip, 10925 bottom toolbar) already use `isRefreshingDay` for `animate-spin` + disabled state. No change needed; manually verify after edits.

### 5. `DayActionToolbar.tsx` cleanup (optional)

That standalone component is defined but has zero consumers (`grep` confirms). Out of scope for this task — leave alone unless we hit it incidentally.

## Verification

1. Clean day (no overlaps, no buffer issues) → click Refresh → spinner shows briefly → green success toast `Day timeline checked — looks clean`. No sheet opens.
2. Day with a known issue (e.g. 7h gap or zero-buffer chain) → click Refresh → spinner → sheet slides in from the side with each proposed change as an accept/reject row → Accept All applies via existing `handleApplyRefreshChanges`.
3. Offline (DevTools → Network → Offline) → click Refresh → spinner stops → red error toast `Refresh failed — please try again` → `console.error` line in DevTools.

## Files touched

- `src/components/itinerary/RefreshDaySheet.tsx` *(new)*
- `src/components/itinerary/EditorialItinerary.tsx` *(handler + sheet mount + remove inline diff render)*

No edge function or DB changes.