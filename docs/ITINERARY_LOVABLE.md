# Itinerary System - Lovable Implementation Guide

**Last Updated**: January 2025  
**Status**: 🔧 Partially Implemented  
**See also**: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [INDEX.md](./INDEX.md)

> This document maps the original itinerary SOT documents to the Lovable codebase architecture.

---

## Architecture Comparison

| Original System | Lovable Implementation | Status |
|----------------|------------------------|--------|
| Railway backend API | Neon DB via Edge Functions | ✅ Ready |
| Direct backend calls | `itineraryApi` in `neonDb.ts` | 🔧 Needs endpoints |
| Session storage caching | Zustand store (`tripStore.ts`) | ✅ Ready |
| Complex transformers | Clean backend → frontend flow | ✅ Design |
| OpenAI itinerary gen | Lovable AI Gateway | 📋 Planned |

## Current Implementation Status

### ✅ Existing Components
- `src/types/trip.ts` - Trip and ItineraryDay types
- `src/lib/tripStore.ts` - Zustand store for trips/itineraries
- `src/lib/trips.ts` - Trip utilities and mock generators
- `src/components/planner/DayTimeline.tsx` - Day activities display
- `src/components/planner/TripActivityCard.tsx` - Individual activity cards
- `src/components/planner/ItinerarySummaryCard.tsx` - Day summary view

### 🔧 Needs Implementation
- `itineraryApi` endpoints in `neonDb.ts`
- Itinerary generation via AI Gateway
- Neon tables for `itineraries`, `itinerary_days`, `itinerary_activities`

## Schema Mapping

### Frontend Types (src/types/trip.ts)
```typescript
// Current structure - aligned with SOT
interface TripActivity {
  id: string;
  name: string;           // Maps to SOT "title"
  description?: string;
  type: string;           // Maps to SOT "type" 
  category?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  location?: {
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  price?: number;
  currency?: string;
  imageUrl?: string;
  notes?: string;
  isLocked?: boolean;
  bookingRequired?: boolean;
  bookingUrl?: string;
}

interface ItineraryDay {
  date: string;
  dayNumber: number;
  activities: TripActivity[];
  weather?: {
    high: number;
    low: number;
    condition: string;
    icon: string;
  };
}
```

### Backend Schema (Neon)
```sql
-- To be added via Edge Function
CREATE TABLE itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL,
  user_id UUID NOT NULL,
  destination VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft',
  generation_status VARCHAR(50) DEFAULT 'not_started',
  percent_complete INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE itinerary_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  theme VARCHAR(255),
  description TEXT,
  weather_high INTEGER,
  weather_low INTEGER,
  weather_condition VARCHAR(50)
);

CREATE TABLE itinerary_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID REFERENCES itinerary_days(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  start_time TIME,
  end_time TIME,
  duration INTEGER,
  location_name VARCHAR(255),
  location_address TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  cost DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  is_locked BOOLEAN DEFAULT FALSE,
  booking_required BOOLEAN DEFAULT FALSE,
  booking_url TEXT,
  sort_order INTEGER DEFAULT 0
);
```

## API Endpoints (Edge Function)

### Add to `supabase/functions/neon-db/index.ts`:
```typescript
// GET /itineraries/:tripId - Get itinerary for trip
// POST /itineraries/:tripId/generate - Start AI generation
// PUT /itineraries/:tripId - Update itinerary
// POST /itineraries/:tripId/activities/:activityId/lock - Lock activity
```

## Data Flow (Simplified per SOT recommendations)

```
User Action → API Call → Edge Function → Neon DB
                                ↓
              Frontend ← Response (no transformation)
                                ↓
              Zustand Store → Component Render
```

### Key Principles (from PRODUCTION_AUDIT)
1. **Single Source of Truth**: Neon DB only (no session storage)
2. **No Transformations**: Backend sends exact format frontend expects
3. **Clean Field Names**: Use `title`/`type` consistently
4. **Polling with Backoff**: For generation status checks

## Activity Type Mapping (from ITINERARY_PARSING_RULES)

| Keywords | Type |
|----------|------|
| flight, airport, train, bus, taxi, uber | `transport` |
| breakfast, lunch, dinner, restaurant, cafe | `food` |
| hotel, check-in, check-out | `accommodation` |
| museum, gallery, church, palace, castle | `attraction` |
| shop, market, store, mall | `shopping` |
| tour, guide, walking tour | `activity` |

## Implementation Priority

### Phase 1: Core CRUD
1. Add Neon tables via Edge Function
2. Implement `itineraryApi.get(tripId)` 
3. Implement `itineraryApi.save(tripId, data)`
4. Wire to existing `ItineraryView` component

### Phase 2: AI Generation
1. Enable Lovable AI Gateway
2. Create generation endpoint
3. Implement polling with backoff
4. Add progress UI

### Phase 3: Advanced Features
1. Activity locking
2. Day regeneration
3. Real-time weather integration
4. Booking URLs

## Related SOT Documents
- `ITINERARY_SCHEMA.md` - Full field definitions
- `ITINERARY_DATABASE_SCHEMA.md` - Complete Neon schema
- `BACKEND_ITINERARY_CONTRACT_V2.md` - API response format
- `ITINERARY_PARSING_RULES.md` - Text parsing logic
- `PRODUCTION_AUDIT_ITINERARY_SYSTEM.md` - Issues to avoid
- `PRODUCTION_FIXES_SUMMARY.md` - Recommended fixes
