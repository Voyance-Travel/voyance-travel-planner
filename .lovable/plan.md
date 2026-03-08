

## Fix: Active Trip Experience — Focus on "Right Now" + Lock Past Days

### Problems Identified

1. **ActiveTripCard navigates to `/trip/${id}` (full TripDetail)**, not `/trip/${id}/active` (the living companion). The dedicated ActiveTrip page exists but is never linked to from the dashboard.

2. **No past-day locking**: In both `LiveItineraryView` and `ActiveTrip`'s `TodayView`, past days still show swap buttons, check-in buttons, "Mark Done" actions, and SmartSwapSuggestion banners. Once a day has passed, it should be read-only.

3. **ActiveTrip "Today" view is too dense**: It shows the full day schedule with every activity card expanded, plus rating widgets, feedback prompts, media capture, and check-in buttons for ALL activities. The user wants a focused "right now" experience — where you are, where you're going next, quick actions, and a compact timeline below.

### Changes

**File 1: `src/components/trips/ActiveTripCard.tsx`**
- Change the "Today's Plan" button link from `/trip/${id}` to `/trip/${id}/active`
- Change the "View full trip details" link at the bottom to stay as `/trip/${id}` (that's the full view)

**File 2: `src/pages/ActiveTrip.tsx` — TodayView component**
- Add `isPastDay` check using `isToday(parseLocalDate(todaysItinerary.date))` and `isBefore()`
- When viewing a past day: hide SmartSwapSuggestion, hide CheckInButton, hide swap actions, hide "Mark Done" buttons, show a "This day has passed" badge instead
- Restructure TodayView to be more focused:
  - The NOW card stays prominent (already good)
  - The "Up Next" section stays
  - The full activity list becomes a compact timeline (smaller cards, no expanded action bars for non-current activities)
  - Hide feedback/rating widgets for activities that aren't current or just completed

**File 3: `src/components/itinerary/LiveItineraryView.tsx`**
- Add past-day detection: when a selected day is in the past, disable swap/skip/complete actions on all activity cards
- In `getActivityStatus`: past days already return 'completed' — but the UI still renders action buttons. Add a `isPastDay` prop to `LiveActivityCard` or conditionally hide actions

**File 4: `src/components/trips/SmartSwapSuggestion.tsx`**
- Add an early return if the `dayDate` is in the past (before today). No swap suggestions for completed days.

### Past-Day Logic (shared across files)
```
const dayDate = parseLocalDate(day.date);
const isPastDay = isBefore(dayDate, startOfDay(new Date())) && !isToday(dayDate);
```
When `isPastDay` is true:
- No swap suggestions
- No check-in / mark done buttons
- No rescue banners
- Activities render in a read-only, subdued style
- Show a small "Completed" indicator on the day

### Summary of Navigation Fix
| From | Current Target | New Target |
|------|---------------|------------|
| ActiveTripCard "Today's Plan" | `/trip/${id}` | `/trip/${id}/active` |
| ActiveTripCard "View full trip details" | `/trip/${id}` | `/trip/${id}` (unchanged) |

### What stays the same
- ActiveTrip page structure (tabs: Today, Trip, Nearby, Memories, Stats, DNA, Chat)
- TripDetail page and its LiveItineraryView usage
- All feedback/sentiment/rescue infrastructure (just conditionally hidden for past days)
- Offline caching and trip loading logic

