# 🎯 Voyance System - Master Source of Truth

<!--
@keywords: master, SOT, source of truth, architecture, API, schema, endpoints, types, database
@category: CORE
@searchTerms: main doc, system overview, how it works, architecture, API reference
-->

**Last Updated**: January 2025  
**Status**: ✅ CANONICAL - Lovable Cloud  
**Version**: 3.0 (Lovable Cloud)

> **This document is the single source of truth for the Lovable Cloud implementation.** All code must align with these specifications.

---

## 📐 Architecture Overview

<!--
@section: architecture
@keywords: frontend, backend, services, state, database, supabase, edge function, lovable cloud
-->

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
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
│  supabase/      │  Direct Supabase client queries               │
│  ────────────   │  ─────────────────────────────────────────    │
│  profiles.ts    │  User profiles & search                       │
│  trips.ts       │  Trip CRUD operations                         │
│  friends.ts     │  Friend relationships                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LOVABLE CLOUD (Supabase)                        │
├─────────────────────────────────────────────────────────────────┤
│  Database       │  PostgreSQL with RLS policies                 │
│  Edge Functions │  29 serverless functions                      │
│  Auth           │  Supabase Auth (email + OAuth)                │
│  Storage        │  File storage (avatars bucket)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema (Current)

<!--
@section: database-schema
@keywords: SQL, tables, columns, schema, profiles, preferences, trips, PostgreSQL, Supabase
-->

### Core Tables (33 total)

| Category | Tables |
|----------|--------|
| **User Data** | profiles, user_preferences, user_roles, user_enrichment |
| **Travel DNA** | travel_dna_profiles, travel_dna_history, quiz_sessions, quiz_responses |
| **Trips** | trips, trip_activities, trip_collaborators, trip_payments |
| **Content** | destinations, airports, attractions, activities, guides |
| **Social** | friendships, saved_items, activity_feedback |
| **System** | audit_logs, feature_flags, plans, plan_entitlements |

### `profiles` Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (from Supabase Auth) |
| display_name | TEXT | User display name |
| handle | TEXT | Unique username (@handle) |
| avatar_url | TEXT | Profile image URL |
| bio | TEXT | User bio |
| home_airport | TEXT | IATA code (e.g., 'JFK') |
| quiz_completed | BOOLEAN | Has completed travel quiz |
| travel_dna | JSONB | Calculated travel personality |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update |

### `user_preferences` Table
| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | Primary key (FK to auth.users) |
| travel_style | TEXT | luxury, adventure, cultural, relaxation |
| budget_tier | TEXT | budget, moderate, premium, luxury |
| travel_pace | TEXT | slow, moderate, fast |
| interests | TEXT[] | Array of interests |
| accommodation_style | TEXT | hotel, boutique, airbnb, hostel |
| dietary_restrictions | TEXT[] | Food restrictions |
| mobility_needs | TEXT | Accessibility requirements |
| home_airport | TEXT | Departure airport preference |

### `trips` Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner user ID |
| name | TEXT | Trip name |
| destination | TEXT | City/location name |
| destination_country | TEXT | Country |
| start_date | DATE | Trip start |
| end_date | DATE | Trip end |
| travelers | INTEGER | Number of travelers |
| status | ENUM | draft, planning, booked, completed, cancelled |
| flight_selection | JSONB | Selected flight data |
| hotel_selection | JSONB | Selected hotel data |
| itinerary_data | JSONB | Generated itinerary |
| itinerary_status | ENUM | pending, generating, complete, failed |

---

## 🔌 API Architecture

<!--
@section: api
@keywords: API, Supabase, edge functions, client, RLS
-->

### Data Access Pattern

**Direct Supabase Client** (for most operations):
```typescript
import { supabase } from '@/integrations/supabase/client';

// Profiles
const { data } = await supabase.from('profiles').select('*').eq('id', userId);

// Trips with RLS (auto-filtered to current user)
const { data } = await supabase.from('trips').select('*');

// Preferences
const { data } = await supabase.from('user_preferences').select('*').eq('user_id', userId);
```

**Edge Functions** (for complex operations):
| Function | Purpose |
|----------|---------|
| `generate-itinerary` | AI-powered itinerary generation |
| `flights` | Flight search (Amadeus API) |
| `hotels` | Hotel search (Amadeus API) |
| `calculate-travel-dna` | Quiz result processing |
| `create-checkout` | Stripe payment sessions |
| `check-subscription` | Subscription verification |

---

## 🔐 Authentication Flow

<!--
@section: authentication
@keywords: auth, login, signup, session, Supabase, OAuth
-->

```
User → Supabase Auth → Session
                ↓
         AuthContext.tsx
                ↓
    ┌───────────┴───────────┐
    │                       │
loadUserData()         Auto-created profile
    │                   (via DB trigger)
    ▼                       
Supabase: profiles     
Supabase: user_preferences
    │
    ▼
transformProfile() → User state
```

### Supported Auth Methods
- Email + Password
- Google OAuth
- Password Reset via Email

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
  travelDNA?: {
    type: string;
    secondary?: string;
    confidence?: number;
  };
}
```

---

## 🧭 Data Flow

<!--
@section: data-flow
@keywords: flow, data, quiz, preferences, trips, save, load
-->

### Quiz → Travel DNA
```
Quiz.tsx (QuizContext)
    │
    ├─ Collect answers (10 steps)
    │
    ▼
Edge Function: calculate-travel-dna
    │
    ▼
Supabase: travel_dna_profiles
Supabase: profiles.travel_dna
Supabase: user_preferences
    │
    ▼
Navigate to /profile (DNA reveal)
```

### Trip Creation
```
TripPlanner → TripSetup
    │
    ├─ Collect: destination, dates, travelers
    │
    ▼
supabase.from('trips').insert()
    │
    ▼
Navigate to /planner/flights
    │
    ▼
Edge Function: flights (search)
    │
    ▼
Edge Function: hotels (search)
    │
    ▼
Edge Function: generate-itinerary
    │
    ▼
supabase.from('trips').update({ itinerary_data })
```

---

## 📦 State Management

<!--
@section: state-management
@keywords: state, context, zustand, store, persist
-->

### AuthContext (React Context)
- **Purpose**: User session and profile
- **Location**: `src/contexts/AuthContext.tsx`
- **State**: user, session, isLoading
- **Auto-sync**: Loads profile/preferences on auth change

### TripPlannerContext (React Context)
- **Purpose**: Active trip planning session
- **Location**: `src/contexts/TripPlannerContext.tsx`
- **State**: currentTrip, flights, hotels, step

### tripStore (Zustand)
- **Purpose**: Trip persistence and selection
- **Location**: `src/lib/tripStore.ts`
- **State**: trips[], selections, itineraries
- **Persistence**: localStorage (for demo/guest trips)

---

## 🔒 Security Model

<!--
@section: security
@keywords: RLS, policies, auth, admin, roles
-->

### Row Level Security
- All 31 tables have RLS enabled
- User data restricted to owner (auth.uid() = user_id)
- Public data (destinations, airports) readable by all
- Admin functions use service_role key

### Role System
```sql
-- Roles stored in separate table (not profiles)
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id),
  role app_role NOT NULL  -- 'admin', 'moderator', 'user'
);

-- Check role via function
SELECT public.has_role('admin');
```

### Views for Public Data
- `profiles_public`: id, handle, display_name, avatar_url (for friend search)
- `user_preferences_safe`: Non-sensitive preference fields only

---

## ✅ Implementation Status

<!--
@section: checklist
@keywords: status, done, todo, progress, implementation
-->

### Complete ✅
- [x] Supabase Auth integration (email + Google OAuth)
- [x] 33 database tables with RLS
- [x] Profiles CRUD with avatar upload
- [x] User preferences system
- [x] Travel Quiz (10 steps)
- [x] Travel DNA calculation
- [x] Trips CRUD
- [x] Trip planner wizard
- [x] AI itinerary generation
- [x] Friends system
- [x] Saved items
- [x] 2,250 destinations
- [x] 740 airports
- [x] 29 edge functions
- [x] Audit logging

### Partial 🔧
- [ ] Stripe payments (edge functions exist, needs real testing)
- [ ] Price locking (timer UI exists, backend partial)
- [ ] Push notifications (needs FCM setup)

### Planned 📋
- [ ] Real Amadeus API integration
- [ ] Actual hotel booking
- [ ] Rate limiting on edge functions

---

## 🔗 Related Documents

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md) | Detailed architecture |
| [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) | Itinerary system |
| [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) | Preferences system |
| [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) | Quiz implementation |
| [database-schema-reference.md](./database-schema-reference.md) | Full schema reference |
