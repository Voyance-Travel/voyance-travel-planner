

# Convert All Time Display to 12-Hour (AM/PM) Format

## Problem
Many components display activity times in raw 24-hour format (e.g., "14:30" instead of "2:30 PM"). The `EditorialItinerary.tsx` already has a `formatTime` function that converts to 12h, but most other components render `{activity.startTime}` or `{activity.time}` directly without conversion.

## Approach
1. **Create a shared `formatTime12h` utility** in `src/utils/timeFormat.ts` — a single canonical function that converts "HH:MM" to "h:MM AM/PM"
2. **Update all display components** to use it. Internal storage/parsing stays in 24h format (that's correct for data handling).

## Shared Utility: `src/utils/timeFormat.ts`

New file exporting `formatTime12h(time: string): string` — same logic already proven in EditorialItinerary and ItineraryEditor. Handles 24h input, passes through already-formatted 12h strings.

## Files to Update (display-only changes)

Each file below renders raw `{activity.startTime}`, `{activity.time}`, or `{activity.endTime}` — wrap each with `formatTime12h()`:

| # | File | Raw times displayed |
|---|------|-------------------|
| 1 | `src/components/itinerary/LiveItineraryView.tsx` | `startTime`, `endTime` |
| 2 | `src/components/itinerary/LiveActivityCard.tsx` | `startTime` |
| 3 | `src/components/itinerary/ItineraryGenerator.tsx` | `startTime` |
| 4 | `src/components/planner/CustomerDayCard.tsx` | `activity.time` |
| 5 | `src/components/planner/steps/ItineraryPreview.tsx` | `activity.time` |
| 6 | `src/components/planner/ItinerarySummaryCard.tsx` | `activity.time` |
| 7 | `src/components/planner/ItineraryGeneratorStreaming.tsx` | `activity.time` |
| 8 | `src/components/planner/TripActivityCard.tsx` | `startTime`, `endTime` |
| 9 | `src/components/booking/BookableItemCard.tsx` | `startTime`, `endTime` |
| 10 | `src/components/booking/VoucherModal.tsx` | `startTime` |
| 11 | `src/components/feedback/DaySummaryPrompt.tsx` | `startTime` |
| 12 | `src/components/demo/DemoGroupBlend.tsx` | `activity.time` |
| 13 | `src/components/demo/DemoPlayground.tsx` | Already has local `formatTime12h` — replace with shared import |
| 14 | `src/components/home/MicroQuizComparison.tsx` | `activity.time` |
| 15 | `src/components/itinerary/ImportActivitiesModal.tsx` | Display only (time input stays as-is) |

## Files Already Correct (no changes needed)
- `EditorialItinerary.tsx` — has its own `formatTime` that outputs 12h
- `ItineraryEditor.tsx` — has its own `formatTime12h`
- `FlightStatusTracker.tsx` — uses `toLocaleTimeString` with `hour12: true`
- `PlannerFlight*.tsx` — uses `toLocaleTimeString` with `hour12: true`
- Edge functions — internal processing, not user-facing display

## Internal time storage — NO changes
All internal time storage, parsing, sorting, and API communication stays in 24-hour `HH:MM` format. Only the **display layer** converts to 12h.

