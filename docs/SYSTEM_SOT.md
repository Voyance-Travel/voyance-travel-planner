# 🎯 Voyance System - Master Source of Truth

<!--
@keywords: master, SOT, source of truth, architecture, API, schema, endpoints, types, database
@category: CORE
@searchTerms: main doc, system overview, how it works, architecture, API reference
-->

**Last Updated**: January 2025  
**Status**: ✅ CANONICAL - Lovable Codebase  
**Version**: 2.0 (Lovable)

> **This document is the single source of truth for the Lovable implementation.** All code must align with these specifications.

---

## 📐 Architecture Overview

<!--
@section: architecture
@keywords: frontend, backend, services, state, database, neon, edge function
-->

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

<!--
@section: database-schema
@keywords: SQL, tables, columns, schema, profiles, preferences, trips, Neon, PostgreSQL
-->

### `profiles` Table
| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | Primary key (from Supabase Auth) |
| email | TEXT | User email |
| name | TEXT | Display name |
| avatar_url | TEXT | Profile image URL |
| home_airport | TEXT | IATA code (e.g., 'JFK') |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update |

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
| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | Primary key |
| travel_style | TEXT | luxury, adventure, cultural, relaxation |
| budget | TEXT | budget, moderate, premium, luxury |
| pace | TEXT | slow, moderate, fast |
| interests | TEXT[] | Array of interests |
| accommodation | TEXT | hotel, boutique, airbnb, hostel |

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
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner user ID |
| destination | TEXT | City/location name |
| start_date | DATE | Trip start |
| end_date | DATE | Trip end |
| travelers | INTEGER | Number of travelers |
| status | TEXT | draft, planning, booked, completed, cancelled |
| data | JSONB | Additional trip data |

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

<!--
@section: api-endpoints
@keywords: API, REST, endpoints, GET, POST, PUT, DELETE, edge function, neon-db
-->

Base: `supabase/functions/neon-db`

| Method | Path | Description | Auth | Keywords |
|--------|------|-------------|------|----------|
| GET | `/health` | Health check | No | status, ping |
| GET | `/profiles?userId=` | Get user profile | Yes | profile, user |
| PUT | `/profiles` | Create/update profile | Yes | profile, save |
| GET | `/preferences?userId=` | Get preferences | Yes | preferences, quiz |
| PUT | `/preferences` | Update preferences | Yes | preferences, save |
| GET | `/trips?userId=` | List user trips | Yes | trips, list |
| GET | `/trips/:id` | Get single trip | Yes | trip, detail |
| POST | `/trips` | Create trip | Yes | trip, create |
| PUT | `/trips/:id` | Update trip | Yes | trip, update |
| DELETE | `/trips/:id` | Delete trip | Yes | trip, delete |

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

<!--
@section: authentication
@keywords: auth, login, signup, session, Supabase, JWT, token, user
-->

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
  id: string;            // UUID from Supabase Auth
  email: string;         // User email
  name?: string;         // Display name
  avatar?: string;       // Profile image URL
  homeAirport?: string;  // IATA code
  createdAt: string;     // ISO date
  quizCompleted?: boolean;
  preferences?: TravelPreferences;
}

interface TravelPreferences {
  style?: string;        // Travel style
  budget?: string;       // Budget level
  pace?: string;         // Travel pace
  interests?: string[];  // Interest categories
  accommodation?: string;// Preferred lodging
}
```

---

## 🧭 Data Flow

<!--
@section: data-flow
@keywords: flow, data, quiz, preferences, trips, save, load
-->

### Quiz → Preferences
```
Quiz.tsx (QuizContext)
    │
    ├─ Collect answers (5 steps)
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

<!--
@section: state-management
@keywords: state, context, zustand, store, persist, local storage
-->

### AuthContext (React Context)
- **Purpose**: User session and profile
- **Location**: `src/contexts/AuthContext.tsx`
- **State**: user, session, isLoading
- **Keywords**: auth, user, session, login

### TripPlannerContext (React Context)
- **Purpose**: Active trip planning session
- **Location**: `src/contexts/TripPlannerContext.tsx`
- **State**: currentTrip, flights, hotels
- **Keywords**: planner, trip, flights, hotels

### tripStore (Zustand)
- **Purpose**: Trip persistence and selection
- **Location**: `src/lib/tripStore.ts`
- **State**: trips[], selections, itineraries
- **Persistence**: localStorage
- **Keywords**: store, persist, trips, itinerary

---

## 🎨 Type Definitions

<!--
@section: types
@keywords: TypeScript, interfaces, types, TripActivity, ItineraryDay, Trip
-->

### Core Types (src/types/trip.ts)
```typescript
interface TripActivity {
  id: string;
  name: string;           // Display name
  type: string;           // activity | food | transport | attraction
  description?: string;
  startTime?: string;     // HH:MM format
  endTime?: string;       // HH:MM format
  duration?: number;      // Minutes
  location?: { 
    name?: string; 
    address?: string; 
    lat?: number; 
    lng?: number; 
  };
  price?: number;
  currency?: string;
  isLocked?: boolean;     // User locked this activity
  bookingRequired?: boolean;
  bookingUrl?: string;
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

interface Trip {
  id: string;
  userId?: string;
  name: string;
  destination: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  totalDays: number;
  status: TripStatus;     // draft | planning | booked | completed | cancelled
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

<!--
@section: mapping
@keywords: original, migration, mapping, Railway, Edge Function
-->

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

<!--
@section: checklist
@keywords: status, done, todo, progress, implementation
-->

### Done ✅
- [x] Supabase Auth integration
- [x] Neon DB Edge Function
- [x] Profiles CRUD
- [x] Preferences CRUD
- [x] Trips CRUD
- [x] Basic trip planner UI
- [x] Quiz flow

### In Progress 🔧
- [ ] Extended preferences schema
- [ ] Itinerary tables & endpoints
- [ ] Flight/hotel mock data
- [ ] Zustand persistence wiring

### Future 📋
- [ ] Amadeus API integration
- [ ] AI itinerary generation
- [ ] Price locking
- [ ] Stripe checkout
- [ ] Companion system
- [ ] Billing system

---

## 🚨 Key Differences from Original

<!--
@section: differences
@keywords: differences, original, changes, migration
-->

1. **No direct API routes** - All backend calls go through Edge Function
2. **Supabase Auth** - Not custom JWT
3. **Simpler preferences** - 5 fields vs 20+ in original
4. **Mock flight/hotel data** - Amadeus integration is future work
5. **No price locking yet** - Will use Zustand + Edge Function
6. **No Stripe yet** - Future implementation

---

## 🔗 Related Documents

| Document | Purpose |
|----------|---------|
| [INDEX.md](./INDEX.md) | Documentation index |
| [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md) | Detailed architecture |
| [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) | Itinerary system |
| [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) | Preferences system |
| [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) | Quiz implementation |
