## Goal

Make the action buttons on Trip Health critical-issue rows ("Fix timing" + "Review") permanently visible, properly sized for touch, and accessible — no hover-dependence on any device.

## Audit findings

In `src/components/trip/TripHealthPanel.tsx` (issue rows, ~L431–470):
- Each issue row is wrapped in `group`, and buttons render unconditionally — but they sit at `h-6 px-2 text-[10px]` (24px tall, ~10px font). On mobile this is below the 44px tap target and the styling reads as "hover affordance only."
- Button labels collapse against long messages because the row uses `flex items-start justify-between` without min-width protection.
- No `aria-label` distinguishing per-day actions ("Fix timing on Day 2").

In `src/components/itinerary/EditorialItinerary.tsx` (no-travel-buffer banner, ~L9952–9970):
- "Refresh Day" is rendered as an inline text-link inside a sentence — no button affordance, no minimum tap area.

In `src/components/itinerary/DraggableActivityList.tsx` (L83):
- Drag handle uses `sm:opacity-0 sm:group-hover:opacity-100`. Already mobile-safe (visible <sm), no change needed but worth noting.

## Changes

### 1. `src/components/trip/TripHealthPanel.tsx`

- For issue rows (L431–470):
  - Replace `h-6 px-2 text-[10px]` with `h-8 px-3 text-xs` on both the primary "Fix timing" button and the secondary "Review" button so they meet a comfortable tap size.
  - Remove the `group` wrapper from the row (no longer needed — buttons are always visible).
  - Switch row layout from `items-start` to a two-line stack on narrow widths: keep message + button on the same row at `sm:` and above; on mobile, wrap the buttons under the message (`flex-col sm:flex-row sm:items-center`).
  - Add `aria-label={`${issue.fixLabel} on day ${issue.dayNumber}`}` to both buttons.
  - Give the primary button a stronger affordance: switch from `variant="outline"` to `variant="default"` with `size="sm"` so the action is unmistakable on a critical (destructive-icon) row.
  - Keep "Review" as `variant="ghost"` but add `underline-offset-2` and a visible focus ring via existing button defaults.

- For checklist rows (L378–415):
  - Bump `h-6 px-2 text-[11px]` to `h-8 px-3 text-xs` on the inline fix button for consistency and touch.

### 2. `src/components/itinerary/EditorialItinerary.tsx` (no-travel-buffer banner ~L9952)

- Replace the inline `<button class="…hover:underline…">Refresh Day</button>` with a real `<Button size="sm" variant="outline">` placed at the right of the row (or wrapped under the message on mobile). Keep the descriptive sentence but drop the inline-link pattern.

### 3. Accessibility polish

- Ensure both fix buttons are reachable via keyboard (they already are via `<Button>`); just confirm no `tabIndex={-1}` is added.
- Confirm icons (`Zap`, `RefreshCw`) carry `aria-hidden` (lucide defaults are fine; verify after edit).

## Out of scope

- Logic of `fix_timing` / `refresh_day` actions (already handled in prior work).
- Health score weighting.
- BudgetCoach styling.

## Verification

- Visual check at mobile (375px) and desktop (1280px) widths: buttons visible without hover, tap targets ≥ 32px tall, message doesn't overlap buttons.
- Keyboard tab through Trip Health → both buttons receive focus rings.
- Click "Fix timing" still triggers `onAction('fix_timing', { dayNumber })`; "Review" still triggers `refresh_day`.
