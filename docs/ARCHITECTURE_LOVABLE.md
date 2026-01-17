# Voyance Architecture - Lovable Codebase

**Last Updated**: 2025-01-17

This document adapts the original Voyance SOT documents for the Lovable codebase architecture.

## Architecture Overview

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

## Key Differences from Original Backend

| Original System | Lovable System |
|-----------------|----------------|
| Custom JWT auth | Supabase Auth |
| Railway backend | Edge Functions |
| Direct API calls | `supabase.functions.invoke()` |
| `/api/v1/auth/*` endpoints | `/neon-db/*` paths |
| Express.js routes | Deno.serve handlers |

---

## API Endpoint Mapping

### Original → Lovable

| Original Endpoint | Lovable Equivalent |
|-------------------|-------------------|
| `POST /api/v1/auth/signup` | `supabase.auth.signUp()` |
| `POST /api/v1/auth/login` | `supabase.auth.signInWithPassword()` |
| `GET /api/preferences` | `GET /neon-db/preferences?userId=X` |
| `POST /api/preferences` | `PUT /neon-db/preferences` |
| `GET /api/trips` | `GET /neon-db/trips?userId=X` |
| `POST /api/trips` | `POST /neon-db/trips` |
| `GET /api/profile` | `GET /neon-db/profiles?userId=X` |

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

### Currently Used

| Table | Purpose | Edge Function Path |
|-------|---------|-------------------|
| `profiles` | User profile data | `/profiles` |
| `user_preferences` | Quiz results, travel style | `/preferences` |
| `trips` | User trips | `/trips` |

### Schema (user_preferences)

```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY,
  travel_style TEXT,
  budget TEXT,
  pace TEXT,
  interests TEXT[],
  accommodation TEXT,
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
  status TEXT DEFAULT 'draft',
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
  home_airport TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

---

## Frontend Architecture

### State Management

```
AuthContext (src/contexts/AuthContext.tsx)
├── user: User | null
├── session: Session | null
├── preferences: TravelPreferences
└── Methods:
    ├── login()
    ├── signup()
    ├── logout()
    ├── setPreferences() → Saves to Neon
    └── refreshUserData() → Fetches from Neon
```

### Key Files

| File | Purpose |
|------|---------|
| `src/services/neonDb.ts` | API client for Neon edge function |
| `src/contexts/AuthContext.tsx` | Auth state + Neon data sync |
| `src/pages/Quiz.tsx` | Quiz flow, saves to Neon on complete |
| `src/pages/Profile.tsx` | Displays data from Neon |
| `supabase/functions/neon-db/index.ts` | Edge function handlers |

---

## Future Enhancements

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

## Reference Documents

See [INDEX.md](./INDEX.md) for complete documentation index.

### Key Lovable Docs
- `SYSTEM_SOT.md` - Master source of truth
- `ITINERARY_LOVABLE.md` - Itinerary system mapping
- `PREFERENCES_LOVABLE.md` - Preferences system mapping

### Reference Data
- `airport-codes-database-full.md` - 879 airports, 152 countries
- `TRAVEL_ARCHETYPES.md` - 25+ traveler personalities

### Original SOT (for reference)
- `database-schema-reference.md` - Full original schema
- `PREFERENCES_SYSTEM_SOT.md` - Complete preferences spec
- `TRIP_PLANNER_INDEX.md` - Trip planner overview
- `SOT_API_TO_UI_MAPPING.md` - API → UI field mapping
