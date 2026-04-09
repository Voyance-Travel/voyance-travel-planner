

# Fix: `perDayActivities` Dropped During Trip Creation

## Root Cause

The chat-trip-planner AI correctly extracts `perDayActivities` (your entire day-by-day itinerary). The `TripChatPlanner` component passes it to `Start.tsx` via `onDetailsExtracted`. But in `Start.tsx` at **line 2978**, where the trip's `metadata` object is built, **`perDayActivities` is never included**. The generation engine then reads `metadata.perDayActivities`, finds nothing, and generates everything from scratch — ignoring all your locked activities.

## Fix

**File: `src/pages/Start.tsx` (~line 2986)**

Add `perDayActivities` to the metadata object, right alongside `mustDoActivities`:

```ts
return {
  mustDoActivities: mustDo,
  additionalNotes: details.additionalNotes || null,
  flightDetails: details.flightDetails || null,
  userConstraints: details.userConstraints || null,
  pacing: details.pacing || 'balanced',
  isFirstTimeVisitor: details.isFirstTimeVisitor ?? true,
  interestCategories: details.interestCategories?.length ? details.interestCategories : null,
  celebrationDay: details.celebrationDay || null,
  generationRules,
  perDayActivities: details.perDayActivities || null,  // ← ADD THIS LINE
  source: 'chat_planner',
  lastUpdated: new Date().toISOString(),
};
```

That's it — one line. The entire Lock → Enhance → Verify pipeline already works correctly; it just never receives the data.

## Impact
- All ~90+ activities from the user's day-by-day itinerary will be locked and preserved
- TBD slots will still be filled by the AI
- Time gaps will still get appropriate gap-fill activities
- No edge function changes needed — the backend already reads `metadata.perDayActivities`

