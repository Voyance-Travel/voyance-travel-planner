# Voyance Architecture - Lovable Codebase

<!--
@keywords: architecture, backend, frontend, API, edge function, Supabase, Neon, auth, data flow
@category: CORE
@searchTerms: how it works, system design, backend setup, API calls, authentication
-->

**Last Updated**: 2025-01-17  
**Status**: ✅ Current  
**See also**: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [INDEX.md](./INDEX.md)

This document adapts the original Voyance SOT documents for the Lovable codebase architecture.

---

## Architecture Overview

<!--
@section: overview
@keywords: diagram, layers, frontend, backend, database
-->

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   React Frontend │────▶│ Supabase Auth    │────▶│   Session   │
│   (Lovable)      │     │ (Authentication) │     │   State     │
└─────────────────┘     └──────────────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   neonDb.ts      │────▶│ Edge Function    │────▶│   Neon DB   │
│   (API Client)   │     │ (neon-db)        │     │ (Postgres)  │
└─────────────────┘     └──────────────────┘     └─────────────┘
```

---

## Key Differences from Original Backend

<!--
@section: differences
@keywords: Railway, Express, Deno, JWT, migration
-->

| Original System | Lovable System | Keywords |
|-----------------|----------------|----------|
| Custom JWT auth | Supabase Auth | auth, JWT, session |
| Railway backend | Edge Functions | railway, deno, serverless |
| Direct API calls | `supabase.functions.invoke()` | invoke, fetch |
| `/api/v1/auth/*` | `/neon-db/*` | routes, endpoints |
| Express.js routes | Deno.serve handlers | express, deno |

---

## API Endpoint Mapping

<!--
@section: api-mapping
@keywords: endpoints, original, lovable, migration, routes
-->

### Original → Lovable

| Original Endpoint | Lovable Equivalent | Keywords |
|-------------------|-------------------|----------|
| `POST /api/v1/auth/signup` | `supabase.auth.signUp()` | signup, register |
| `POST /api/v1/auth/login` | `supabase.auth.signInWithPassword()` | login, signin |
| `GET /api/preferences` | `GET /neon-db/preferences?userId=X` | preferences, get |
| `POST /api/preferences` | `PUT /neon-db/preferences` | preferences, save |
| `GET /api/trips` | `GET /neon-db/trips?userId=X` | trips, list |
| `POST /api/trips` | `POST /neon-db/trips` | trips, create |
| `GET /api/profile` | `GET /neon-db/profiles?userId=X` | profile, get |

### Usage in Code

```typescript
// src/services/neonDb.ts - Already implemented
import { preferencesApi, tripsApi, profilesApi } from '@/services/neonDb';

// Get preferences
const prefs = await preferencesApi.get(userId);

// Update preferences  
await preferencesApi.update(userId, { style: 'luxury', budget: 'premium' });

// List trips
const trips = await tripsApi.list(userId);

// Create trip
await tripsApi.create(userId, { destination: 'Tokyo', status: 'draft' });
```

---

## Data Flow Adaptations

<!--
@section: data-flow
@keywords: quiz, auth, flow, save, session
-->

### Quiz Flow (Simplified)

**Original (11 steps, quiz_sessions table):**
```
quiz/start → quiz/save-step → quiz/finalize → travel_dna_profiles
```

**Lovable (5 questions, direct save):**
```
Quiz.tsx → setPreferences() → /neon-db/preferences → user_preferences table
```

The Lovable version is simplified:
- No quiz_sessions tracking (future enhancement)
- No quiz_responses table (answers saved directly as preferences)
- No travel_dna_profiles table (archetype derived on frontend)

### Auth Flow

**Original:**
```
signup → JWT token → localStorage → axios interceptor
```

**Lovable:**
```
supabase.auth.signUp() → Session → AuthContext → Auto-managed by Supabase client
```

---

## Neon Database Tables

<!--
@section: neon-tables
@keywords: tables, schema, SQL, profiles, preferences, trips
-->

### Currently Used

| Table | Purpose | Edge Function Path | Keywords |
|-------|---------|-------------------|----------|
| `profiles` | User profile data | `/profiles` | user, name, avatar |
| `user_preferences` | Quiz results, travel style | `/preferences` | quiz, style, budget |
| `trips` | User trips | `/trips` | trip, destination, dates |

### Schema (user_preferences)

```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY,
  travel_style TEXT,    -- luxury, adventure, cultural, relaxation
  budget TEXT,          -- budget, moderate, premium, luxury
  pace TEXT,            -- slow, moderate, fast
  interests TEXT[],     -- ['food', 'art', 'nature']
  accommodation TEXT,   -- hotel, boutique, airbnb, hostel
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Schema (trips)

```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  travelers INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft',  -- draft, planning, booked, completed, cancelled
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

### Schema (profiles)

```sql
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  home_airport TEXT,  -- IATA code
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

---

## Frontend Architecture

<!--
@section: frontend
@keywords: React, context, state, components, pages
-->

### State Management

```
AuthContext (src/contexts/AuthContext.tsx)
├── user: User | null
├── session: Session | null
├── preferences: TravelPreferences
└── Methods:
    ├── login()        → Supabase Auth + Neon sync
    ├── signup()       → Supabase Auth + profile create
    ├── logout()       → Clear session
    ├── setPreferences() → Saves to Neon
    └── refreshUserData() → Fetches from Neon
```

### Key Files

| File | Purpose | Keywords |
|------|---------|----------|
| `src/services/neonDb.ts` | API client for Neon edge function | API, fetch, invoke |
| `src/contexts/AuthContext.tsx` | Auth state + Neon data sync | auth, user, session |
| `src/pages/Quiz.tsx` | Quiz flow, saves to Neon on complete | quiz, questions |
| `src/pages/Profile.tsx` | Displays data from Neon | profile, display |
| `supabase/functions/neon-db/index.ts` | Edge function handlers | edge, routes |

---

## Future Enhancements

<!--
@section: future
@keywords: todo, planned, enhancement, roadmap
-->

To fully match original system, implement:

1. **Quiz Sessions Table** - Track quiz progress, allow resume
2. **Quiz Responses Table** - Store individual answers
3. **Travel DNA Profiles** - Calculated archetype with confidence
4. **Travel DNA History** - Track changes over time
5. **Extended Preferences Tables**:
   - `user_flight_preferences`
   - `user_food_preferences`
   - `user_mobility_accessibility`
   - `user_emotional_signature`

---

## Related Documents

| Document | Purpose | Keywords |
|----------|---------|----------|
| [SYSTEM_SOT.md](./SYSTEM_SOT.md) | Master source of truth | main, canonical |
| [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) | Itinerary system | activities, days |
| [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) | Preferences system | quiz, style |
| [airport-codes-database-full.md](./airport-codes-database-full.md) | 879 airports | IATA, cities |
| [TRAVEL_ARCHETYPES.md](./TRAVEL_ARCHETYPES.md) | 25+ traveler personalities | DNA, archetype |
| [database-schema-reference.md](./database-schema-reference.md) | Full original schema | schema, tables |
