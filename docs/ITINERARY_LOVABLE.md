# Itinerary System - Lovable Cloud Implementation

<!--
@keywords: itinerary, activities, days, schedule, generation, AI, timeline, trip planning
@category: ITINERARY
@searchTerms: trip schedule, daily activities, AI generation, itinerary creation, day planning
-->

**Last Updated**: January 2025  
**Status**: ✅ Fully Implemented  
**See also**: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [INDEX.md](./INDEX.md)

This document describes the itinerary system in the Lovable Cloud architecture.

---

## Architecture Overview

<!--
@section: architecture
@keywords: backend, frontend, Supabase, edge functions
-->

| Component | Implementation | Status |
|-----------|----------------|--------|
| Database | `trips.itinerary_data` (JSONB) + `trip_activities` table | ✅ Complete |
| Generation | Edge Function: `generate-itinerary` | ✅ Complete |
| AI Engine | Lovable AI Gateway | ✅ Complete |
| Frontend | `useLovableItinerary` hook | ✅ Complete |
| UI Components | DayTimeline, TripActivityCard, ItinerarySummaryCard | ✅ Complete |
| Storage | Zustand store (`tripStore.ts`) | ✅ Complete |

---

## Data Flow

<!--
@section: data-flow
@keywords: generation, flow, AI, Supabase
-->

### Itinerary Generation Flow

```
TripPlanner → ItineraryPreview
    │
    ▼
useLovableItinerary hook
    │
    ▼
Edge Function: generate-itinerary
    │
    ├─ Fetch user preferences
    ├─ Call Lovable AI Gateway
    ├─ Generate day-by-day itinerary
    │
    ▼
supabase.from('trips').update({ 
  itinerary_data: generatedItinerary,
  itinerary_status: 'complete'
})
    │
    ▼
Frontend receives streaming updates
    │
    ▼
Display in DayTimeline components
```

---

## Database Schema

<!--
@section: schema
@keywords: SQL, tables, trips, trip_activities
-->

### trips.itinerary_data (JSONB)

```json
{
  "days": [
    {
      "date": "2025-03-15",
      "dayNumber": 1,
      "activities": [
        {
          "id": "act-1",
          "title": "Morning at Senso-ji Temple",
          "type": "attraction",
          "startTime": "09:00",
          "endTime": "11:00",
          "description": "Visit Tokyo's oldest temple...",
          "location": {
            "name": "Senso-ji Temple",
            "address": "2-3-1 Asakusa, Taito City",
            "lat": 35.7147,
            "lng": 139.7966
          },
          "cost": 0,
          "currency": "JPY"
        }
      ],
      "weather": {
        "high": 18,
        "low": 10,
        "condition": "partly_cloudy"
      }
    }
  ],
  "generatedAt": "2025-01-19T12:00:00Z",
  "version": "2.0"
}
```

### trip_activities Table

For persisted/modified activities with full metadata:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| trip_id | UUID | FK to trips |
| itinerary_day_id | UUID | Optional day reference |
| title | TEXT | Activity name |
| type | TEXT | attraction, food, transport, activity |
| description | TEXT | Full description |
| start_time | TIMESTAMPTZ | Start time |
| end_time | TIMESTAMPTZ | End time |
| location | TEXT | Location name |
| address | TEXT | Full address |
| latitude | NUMERIC | GPS lat |
| longitude | NUMERIC | GPS lng |
| cost | NUMERIC | Estimated cost |
| currency | TEXT | Currency code |
| locked | BOOLEAN | User-locked activity |
| booking_status | TEXT | pending, confirmed, cancelled |
| booking_required | BOOLEAN | Needs reservation |
| external_booking_url | TEXT | Booking link |

---

## TypeScript Types

<!--
@section: types
@keywords: TypeScript, interfaces, TripActivity, ItineraryDay
-->

### src/types/itinerary.ts

```typescript
interface TripActivity {
  id: string;
  title: string;
  type: 'attraction' | 'food' | 'transport' | 'activity' | 'leisure';
  category?: string;
  description?: string;
  startTime?: string;      // "09:00"
  endTime?: string;        // "11:00"
  duration?: number;       // Minutes
  location?: {
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  cost?: number;
  currency?: string;
  isLocked?: boolean;
  bookingRequired?: boolean;
  bookingUrl?: string;
  photos?: string[];
}

interface ItineraryDay {
  date: string;           // YYYY-MM-DD
  dayNumber: number;      // 1, 2, 3...
  activities: TripActivity[];
  weather?: {
    high: number;
    low: number;
    condition: string;
  };
}

interface Itinerary {
  days: ItineraryDay[];
  generatedAt: string;
  version: string;
}
```

---

## Edge Function: generate-itinerary

<!--
@section: edge-function
@keywords: AI, generation, edge function
-->

Located at: `supabase/functions/generate-itinerary/index.ts`

### Request

```typescript
POST /generate-itinerary
Authorization: Bearer <user_token>

{
  "tripId": "uuid",
  "destination": "Tokyo, Japan",
  "startDate": "2025-03-15",
  "endDate": "2025-03-18",
  "travelers": 2,
  "preferences": {
    "travelStyle": "adventure",
    "pace": "moderate",
    "interests": ["food", "culture", "nature"],
    "budgetTier": "moderate"
  }
}
```

### Response (streaming)

```typescript
// Streamed day-by-day
{ "type": "day_start", "dayNumber": 1 }
{ "type": "activity", "dayNumber": 1, "activity": {...} }
{ "type": "activity", "dayNumber": 1, "activity": {...} }
{ "type": "day_complete", "dayNumber": 1 }
{ "type": "day_start", "dayNumber": 2 }
// ...
{ "type": "complete", "itinerary": {...} }
```

---

## Frontend Hook: useLovableItinerary

<!--
@section: hook
@keywords: React, hook, generation, state
-->

Located at: `src/hooks/useLovableItinerary.ts`

```typescript
const {
  generateItinerary,
  isGenerating,
  progress,           // { currentDay, totalDays, status }
  currentDayActivities,
  error,
  cancel,
} = useLovableItinerary();

// Start generation
await generateItinerary({
  tripId,
  destination: 'Tokyo, Japan',
  startDate: '2025-03-15',
  endDate: '2025-03-18',
  travelers: 2,
  preferences: userPreferences,
});
```

---

## UI Components

<!--
@section: components
@keywords: React, components, UI
-->

| Component | Location | Purpose |
|-----------|----------|---------|
| `DayTimeline` | `src/components/planner/DayTimeline.tsx` | Full day with activities |
| `TripActivityCard` | `src/components/planner/TripActivityCard.tsx` | Individual activity |
| `ItinerarySummaryCard` | `src/components/planner/ItinerarySummaryCard.tsx` | Day overview |
| `TripDayNav` | `src/components/planner/TripDayNav.tsx` | Day navigation |
| `LiveItineraryView` | `src/components/itinerary/LiveItineraryView.tsx` | Real-time generation display |

---

## Activity Management

<!--
@section: activity-management
@keywords: lock, edit, add, remove
-->

### Lock/Unlock Activities

```typescript
// Lock an activity (won't be changed during regeneration)
await supabase
  .from('trip_activities')
  .update({ locked: true })
  .eq('id', activityId);
```

### Add Custom Activity

```typescript
await supabase.from('trip_activities').insert({
  trip_id: tripId,
  title: 'Private cooking class',
  type: 'activity',
  start_time: '14:00',
  end_time: '17:00',
  added_by_user: true,
  locked: true,
});
```

### Regenerate Day

```typescript
// Keep locked activities, regenerate rest
await supabase.functions.invoke('generate-itinerary', {
  body: {
    tripId,
    regenerateDay: 2,       // Only day 2
    keepLocked: true,       // Preserve locked activities
  }
});
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/types/itinerary.ts` | TypeScript types |
| `src/hooks/useLovableItinerary.ts` | Generation hook |
| `src/hooks/useGenerationPoller.ts` | Generation polling & stall detection |
| `src/lib/tripStore.ts` | Zustand store |
| `supabase/functions/generate-itinerary/` | Edge function |
| `supabase/functions/optimize-itinerary/` | Route optimization |
