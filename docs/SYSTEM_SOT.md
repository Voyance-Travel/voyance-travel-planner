# 🎯 Voyance System - Master Source of Truth

**Last Updated**: January 2025  
**Status**: ✅ CANONICAL - Lovable Codebase  
**Version**: 2.0 (Lovable)

> **This document is the single source of truth for the Lovable implementation.** All code must align with these specifications.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  Pages          │  Components        │  State                   │
│  ─────────────  │  ───────────────   │  ──────────────────      │
│  Home.tsx       │  TripCard.tsx      │  AuthContext.tsx         │
│  Profile.tsx    │  FlightSelector    │  TripPlannerContext.tsx  │
│  Quiz.tsx       │  HotelSelector     │  QuizContext.tsx         │
│  Planner/*.tsx  │  ItineraryView     │  tripStore.ts (Zustand)  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICES (src/services/)                      │
├─────────────────────────────────────────────────────────────────┤
│  neonDb.ts      │  API client for Neon via Edge Functions       │
│  ────────────   │  ─────────────────────────────────────────    │
│  profilesApi    │  GET/PUT /profiles                             │
│  preferencesApi │  GET/PUT /preferences                          │
│  tripsApi       │  GET/POST/PUT/DELETE /trips                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SUPABASE EDGE FUNCTION                          │
├─────────────────────────────────────────────────────────────────┤
│  supabase/functions/neon-db/index.ts                            │
│  ─────────────────────────────────────                          │
│  Routes to Neon PostgreSQL database                              │
│  Handles: profiles, preferences, trips, itineraries             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEON POSTGRESQL                               │
├─────────────────────────────────────────────────────────────────┤
│  Tables: profiles, user_preferences, trips                      │
│  Future: itineraries, itinerary_days, itinerary_activities      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema (Current)

### `profiles` Table
```sql
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  home_airport TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `user_preferences` Table
```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY,
  travel_style TEXT,
  budget TEXT,
  pace TEXT,
  interests TEXT[],
  accommodation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `trips` Table
```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  travelers INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔌 API Endpoints (Edge Function)

Base: `supabase/functions/neon-db`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/health` | Health check | No |
| GET | `/profiles?userId=` | Get user profile | Yes |
| PUT | `/profiles` | Create/update profile | Yes |
| GET | `/preferences?userId=` | Get preferences | Yes |
| PUT | `/preferences` | Update preferences | Yes |
| GET | `/trips?userId=` | List user trips | Yes |
| GET | `/trips/:id` | Get single trip | Yes |
| POST | `/trips` | Create trip | Yes |
| PUT | `/trips/:id` | Update trip | Yes |
| DELETE | `/trips/:id` | Delete trip | Yes |

### Request/Response Format

```typescript
// All responses follow this format:
interface NeonResponse<T> {
  data: T | null;
  error: string | null;
}
```

---

## 🔐 Authentication Flow

```
User → Supabase Auth → Session
                ↓
         AuthContext.tsx
                ↓
    ┌───────────┴───────────┐
    │                       │
loadUserData()         syncProfile()
    │                       │
    ▼                       ▼
Neon: profiles         Neon: profiles
Neon: preferences      (upsert on login)
    │
    ▼
transformUser() → User state
```

### User Type (Frontend)
```typescript
interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  homeAirport?: string;
  createdAt: string;
  quizCompleted?: boolean;
  preferences?: TravelPreferences;
}

interface TravelPreferences {
  style?: string;
  budget?: string;
  pace?: string;
  interests?: string[];
  accommodation?: string;
}
```

---

## 🧭 Data Flow

### Quiz → Preferences
```
Quiz.tsx (QuizContext)
    │
    ├─ Collect answers (10 steps)
    │
    ▼
useAuth().setPreferences(preferences)
    │
    ▼
preferencesApi.update(userId, preferences)
    │
    ▼
Edge Function → Neon: user_preferences
    │
    ▼
Update AuthContext.user.preferences
    │
    ▼
Navigate to /profile
```

### Trip Creation
```
TripPlanner → TripSetup
    │
    ├─ Collect: destination, dates, travelers
    │
    ▼
tripsApi.create(userId, tripData)
    │
    ▼
Edge Function → Neon: trips
    │
    ▼
Update tripStore (Zustand)
    │
    ▼
Navigate to /planner/flights
```

---

## 📦 State Management

### AuthContext (React Context)
- **Purpose**: User session and profile
- **Location**: `src/contexts/AuthContext.tsx`
- **State**: user, session, isLoading

### TripPlannerContext (React Context)
- **Purpose**: Active trip planning session
- **Location**: `src/contexts/TripPlannerContext.tsx`
- **State**: currentTrip, flights, hotels

### tripStore (Zustand)
- **Purpose**: Trip persistence and selection
- **Location**: `src/lib/tripStore.ts`
- **State**: trips[], selections, itineraries
- **Persistence**: localStorage

---

## 🎨 Type Definitions

### Core Types (src/types/trip.ts)
```typescript
interface TripActivity {
  id: string;
  name: string;           // Display name
  type: string;           // activity | food | transport | attraction
  description?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  location?: { name?: string; address?: string; lat?: number; lng?: number };
  price?: number;
  currency?: string;
  isLocked?: boolean;
  bookingRequired?: boolean;
  bookingUrl?: string;
}

interface ItineraryDay {
  date: string;
  dayNumber: number;
  activities: TripActivity[];
  weather?: { high: number; low: number; condition: string };
}

interface Trip {
  id: string;
  userId?: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: TripStatus; // draft | planning | booked | completed | cancelled
  travelers: number;
  budget?: number;
  currency: string;
  itinerary?: ItineraryDay[];
  flight?: FlightSelection;
  hotel?: HotelSelection;
}
```

---

## 🔄 Mapping: SOT Docs → Lovable

| Original Concept | Lovable Implementation |
|-----------------|------------------------|
| Railway backend | Edge Function (neon-db) |
| `/api/v1/planner/trips` | `tripsApi.create()` |
| `/api/v1/flights/search` | Mock data (future: Amadeus) |
| `/api/v1/hotels/search` | Mock data (future: Amadeus) |
| `/api/v1/user/preferences` | `preferencesApi.update()` |
| Price lock system | tripStore.selections |
| Stripe checkout | Future implementation |
| OpenAI itinerary | Lovable AI Gateway |

---

## ✅ Implementation Checklist

### Done
- [x] Supabase Auth integration
- [x] Neon DB Edge Function
- [x] Profiles CRUD
- [x] Preferences CRUD
- [x] Trips CRUD
- [x] Basic trip planner UI
- [x] Quiz flow

### In Progress
- [ ] Extended preferences schema
- [ ] Itinerary tables & endpoints
- [ ] Flight/hotel mock data
- [ ] Zustand persistence wiring

### Future
- [ ] Amadeus API integration
- [ ] AI itinerary generation
- [ ] Price locking
- [ ] Stripe checkout
- [ ] Companion system
- [ ] Billing system

---

## 🚨 Key Differences from Original

1. **No direct API routes** - All backend calls go through Edge Function
2. **Supabase Auth** - Not custom JWT
3. **Simpler preferences** - 5 fields vs 20+ in original
4. **Mock flight/hotel data** - Amadeus integration is future work
5. **No price locking yet** - Will use Zustand + Edge Function
6. **No Stripe yet** - Future implementation
