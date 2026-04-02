

## Fix: LinkToTripModal showing past trips + UI overflow

### Problems

1. **Past trips showing**: The query filters by status (`draft`, `planning`, `booked`) but doesn't exclude trips where `end_date` is in the past. Old trips that were never marked `completed` still appear.

2. **UI cut off**: The dialog has too much stacked content (friend preview + DNA toggle + trip list + info note + actions) which overflows on your 740px viewport. The `DialogContent` has no scroll management for the overall modal.

### Changes

**1. `src/components/profile/LinkToTripModal.tsx` — Filter out past trips**
- Add `.gte('end_date', new Date().toISOString().split('T')[0])` to the query to exclude trips whose end date has already passed
- This ensures only current and future trips appear

**2. `src/components/profile/LinkToTripModal.tsx` — Fix overflow**
- Add `max-h-[80vh] overflow-y-auto` to the inner content wrapper so the dialog scrolls when content exceeds viewport
- Increase the `ScrollArea` height from `h-[200px]` to `max-h-[240px]` with a flexible approach so it adapts to available space

| File | Change |
|---|---|
| `src/components/profile/LinkToTripModal.tsx` | Add date filter to query; fix dialog overflow for small viewports |

