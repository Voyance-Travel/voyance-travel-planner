## Problem

The Trip Completion / Trip Health panel lists timing‑overlap issues with a "Refresh Day" button next to each one. Two bugs make it unusable:

1. **Hidden button.** In `src/components/trip/TripHealthPanel.tsx` the buttons are styled `opacity-0 group-hover:opacity-100`, so on touch devices and with keyboard focus they never show, and even on desktop they appear only on hover.
2. **Click does nothing useful.** The parent `onAction` handler in `src/pages/TripDetail.tsx` (both mobile and desktop instances) handles `refresh_day` by showing a toast that says "Use the day toolbar to refresh Day X". It never calls the real `handleRefreshDay(dayIndex)` that already exists in `EditorialItinerary.tsx` (line ~2344, using `useRefreshDay`).

The refresh pipeline itself works — it's reachable from the per‑day toolbar (`DayActionToolbar` → `onRefreshDay`). We just need to connect the Trip Health button to it.

## Fix

### 1. Always show the action buttons (`TripHealthPanel.tsx`)
- Remove `opacity-0 group-hover:opacity-100 transition-opacity` from both the checklist `fixLabel` button (~line 403) and the health‑issue `fixLabel` button (~line 441).
- Replace with a subtle always‑visible style (e.g. `text-primary` outline button, no opacity gating) so it's discoverable on touch and via keyboard.

### 2. Wire `refresh_day` to the real handler

Add a small bridge between `TripDetail` (where `TripHealthPanel` is rendered) and `EditorialItinerary` (where `handleRefreshDay` lives), mirroring the existing `navigateToSection` pattern:

- `EditorialItinerary.tsx`
  - Add prop `refreshDayRequest?: { dayNumber: number; nonce: number } | null`.
  - Add a `useEffect` that, when `refreshDayRequest` changes, finds the day index by `dayNumber`, sets `selectedDayIndex` (so the panel below scrolls/opens) and calls the existing `handleRefreshDay(index)`.

- `TripDetail.tsx`
  - Add state `const [refreshDayRequest, setRefreshDayRequest] = useState<{dayNumber:number; nonce:number}|null>(null)`.
  - Pass it to `EditorialItinerary` alongside `navigateToSection`.
  - In both `TripHealthPanel` `onAction` blocks, replace the current `refresh_day` toast with:
    ```ts
    } else if (action === 'refresh_day') {
      if (ctx?.dayNumber) setRefreshDayRequest({ dayNumber: ctx.dayNumber, nonce: Date.now() });
    } else if (action === 'generate_day') {
      // keep existing toast/generator path
    }
    ```

### 3. Feedback
The existing `handleRefreshDay` already shows toasts (`Day X validated…` / error+warning summary) and populates `RefreshDayPanel` under the day. No extra UI work needed — the click will now produce a loading state on the day card, a toast, and the diff panel.

### 4. QA
- Click "Refresh Day" on a Day 1/2/3 overlap issue from Trip Health → verify toast fires, day card shows refresh spinner, `RefreshDayPanel` opens with the proposed fix.
- Tab to the issue with keyboard → button is focusable and visible.
- Mobile viewport → buttons visible without hover.

## Files touched
- `src/components/trip/TripHealthPanel.tsx` — remove `opacity-0` gating on both fix buttons.
- `src/components/itinerary/EditorialItinerary.tsx` — add `refreshDayRequest` prop + effect that calls `handleRefreshDay`.
- `src/pages/TripDetail.tsx` — add `refreshDayRequest` state, pass it down, dispatch from both `onAction` handlers.

No backend / edge function changes; `refresh-day` already works.