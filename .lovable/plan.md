

## Polish the LiveItineraryView — Editorial Restyle with Photos

The `LiveItineraryView` component (shown in TripDetail's "Active" tab) currently uses plain `Card` components and the generic `LiveActivityCard` — no activity photos, no timeline dots, no time-of-day groupings. Meanwhile, the dedicated `ActiveTrip.tsx` page has the full editorial treatment. Here's the plan to bring LiveItineraryView up to the same standard.

### Changes — all in `src/components/itinerary/LiveItineraryView.tsx`

**1. Day Header — editorial style**
Replace the current `<h2>Day X: Theme</h2>` with the large serif day number pattern (`01`, `02`) + serif theme title + italic description, matching ActiveTrip.tsx lines 826-854.

**2. NOW Spotlight — gradient border + pulsing dot**
Restyle the "Right Now" card: smaller pulsing dot, `tracking-widest` uppercase label, serif heading, pull-quote tip style with left border. Replace the `Card`/`CardContent` wrapper with a styled `div` using `border-primary/20 bg-gradient-to-br from-primary/5`.

**3. Time-of-day section headers**
Group activities under "Morning" / "Afternoon" / "Evening" headers (based on `startTime`) with `text-[10px] font-bold uppercase tracking-widest text-primary/60` and a gradient divider line, instead of the flat "Full Schedule" heading.

**4. Replace `LiveActivityCard` with inline editorial timeline cards**
This is the biggest change. Instead of rendering `<LiveActivityCard>` for each activity, render inline cards with:
- **Timeline column**: dot + vertical line on the left (matching ActiveTrip lines 1009-1025)
- **Activity photo**: Add a small image thumbnail using `useActivityImage` or `getActivityFallbackImage` — a 64x64 rounded image on the right side of each card
- **Serif typography**: `font-serif text-base font-semibold` for activity names
- **Location line**: `MapPin` icon + truncated address
- **Description**: Show `activity.description` as a pull-quote with left border when available
- **Action buttons**: Keep existing Mark Done / Directions / Skip logic, styled as rounded-full pills

**5. "Up Next" card — subtle refinement**
Replace the `Card` wrapper with a lighter `bg-muted/20 rounded-xl border border-border/50` and add the activity image thumbnail.

**6. Activity images**
Import `getActivityFallbackImage` (already used in `LiveActivityCard`) and `SafeImage` to show a small photo for each activity. The image will use the existing fallback chain (curated → API → gradient placeholder).

### Files to Edit

| File | Change |
|------|--------|
| `src/components/itinerary/LiveItineraryView.tsx` | Full editorial restyle: timeline, photos, time-of-day groups, serif typography |

### What Stays the Same
- Day navigation pills (already good)
- Activity completion/skip/feedback logic
- Weather display
- AI insights card
- Progress bar
- Feedback prompt overlay

