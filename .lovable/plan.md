
# Fix: "Booking Required" Badge Showing on Free Time + Missing on Actual Bookable Activities

## Problem
Two related bugs:
1. **"Booking Required" badge appears on free time / downtime activities** where there's nothing to book
2. **"Booking Required" badge and booking links don't appear for actual bookable activities** (tours, museums, restaurants)

## Root Cause

### Bug 1: Badge on Free Time
In `EditorialItinerary.tsx` line 7931, the badge renders based solely on `activity.bookingRequired` with no check for downtime/free-time/transport:
```tsx
{activity.bookingRequired && !compact && (
  <Badge>Booking Required</Badge>
)}
```
The AI sometimes sets `bookingRequired: true` on free-time blocks despite prompt instructions, and the backend normalizer only catches activities whose titles contain exact keywords like "free time". If the AI uses a slightly different title (e.g., "Leisure Hour", "Relax & Explore"), the normalizer misses it and the badge shows.

### Bug 2: Missing Badge/Links on Bookable Activities
The `InlineBookingActions` component (which renders booking links) exits early at line 260 when `bookingRequired` is `false`:
```tsx
if (!activity.bookingRequired) { ... return null; }
```
The AI often fails to set `bookingRequired: true` on genuinely bookable activities (museums, guided tours, cooking classes). The backend normalizer only force-sets it for Viator-matched activities but doesn't infer it for unmatched ones that clearly need booking.

## Solution

### Change 1: Filter the "Booking Required" badge from non-bookable activities
**File:** `src/components/itinerary/EditorialItinerary.tsx` (line 7931)

Add the existing `isDowntime`, `isTransport`, `isCheckIn`, and `isAccommodation` guards:
```tsx
{activity.bookingRequired && !compact && !isDowntime && !isTransport && !isCheckIn && !isAccommodation && (
  <Badge variant="outline" className="text-xs border-accent/50 text-accent">
    Booking Required
  </Badge>
)}
```

### Change 2: Auto-infer `bookingRequired` in the backend normalizer
**File:** `supabase/functions/generate-itinerary/index.ts` (after the isLogistics block ~line 5360)

After setting `bookingRequired = false` for logistics, add the inverse: auto-set `bookingRequired = true` for categories that genuinely need booking when the AI didn't flag it:
```typescript
// Auto-set bookingRequired for categories that genuinely need it
const bookableCategories = ['museum', 'tour', 'cultural', 'activity', 'show', 'entertainment'];
const bookableKeywords = ['museum', 'tour', 'guided', 'cooking class', 'wine tasting', 
  'tickets', 'skip-the-line', 'timed entry', 'reservation'];
const isBookable = bookableCategories.includes(normalizedAct.category?.toLowerCase() || '') ||
  bookableKeywords.some(kw => normalizedAct.title.toLowerCase().includes(kw));
if (isBookable && !isLogistics) {
  normalizedAct.bookingRequired = true;
}
```

### Change 3: Expand the logistics keyword list to catch more free-time variants
**File:** `supabase/functions/generate-itinerary/index.ts` (line 5350)

Add more free-time synonyms to the logistics keywords array:
```typescript
const logisticsKeywords = [
  'check-in', 'checkout', 'check-out', 'arrival', 'departure', 'transfer',
  'free time', 'at leisure', 'leisure time', 'downtime', 'rest',
  'relax at hotel', 'explore on your own', 'personal time'
];
```

## Files Changed
1. `src/components/itinerary/EditorialItinerary.tsx` -- guard the badge from non-bookable activity types
2. `supabase/functions/generate-itinerary/index.ts` -- expand logistics keywords + auto-infer bookingRequired for genuinely bookable categories
