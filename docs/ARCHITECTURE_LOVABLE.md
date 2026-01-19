# Voyance Architecture - Lovable Cloud

<!--
@keywords: architecture, backend, frontend, API, edge function, Supabase, auth, data flow, Lovable Cloud
@category: CORE
@searchTerms: how it works, system design, backend setup, API calls, authentication
-->

**Last Updated**: 2025-01-19  
**Status**: ✅ Current  
**See also**: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [INDEX.md](./INDEX.md)

This document describes the Voyance architecture on Lovable Cloud (Supabase-powered backend).

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
│  Supabase Client │────▶│ Lovable Cloud    │────▶│  PostgreSQL │
│  (Direct queries)│     │ (Edge Functions) │     │  (with RLS) │
└─────────────────┘     └──────────────────┘     └─────────────┘
```

---

## Technology Stack

<!--
@section: tech-stack
@keywords: React, Vite, Tailwind, TypeScript, Supabase
-->

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State** | React Context + Zustand |
| **Data Fetching** | TanStack Query (React Query) |
| **Backend** | Lovable Cloud (Supabase) |
| **Database** | PostgreSQL with RLS |
| **Auth** | Supabase Auth |
| **Serverless** | Deno Edge Functions |
| **Storage** | Supabase Storage |
| **Payments** | Stripe |

---

## Data Access Patterns

<!--
@section: data-access
@keywords: Supabase, client, edge functions, queries
-->

### Direct Supabase Client (Primary)

For most CRUD operations, use the Supabase client directly:

```typescript
import { supabase } from '@/integrations/supabase/client';

// Read with RLS (auto-filtered to current user)
const { data: trips } = await supabase.from('trips').select('*');

// Insert
const { data: newTrip } = await supabase
  .from('trips')
  .insert({ destination: 'Tokyo', user_id: userId })
  .select()
  .single();

// Update
await supabase
  .from('profiles')
  .update({ display_name: 'New Name' })
  .eq('id', userId);

// Delete
await supabase.from('trips').delete().eq('id', tripId);
```

### Edge Functions (Complex Operations)

For operations requiring:
- External API calls (Amadeus, Stripe)
- AI processing (Lovable AI Gateway)
- Admin operations (service role)
- Complex business logic

```typescript
// Invoke edge function
const { data, error } = await supabase.functions.invoke('generate-itinerary', {
  body: { tripId, destination, preferences }
});

// List of edge functions (29 total)
// - generate-itinerary   (AI itinerary generation)
// - flights              (Amadeus flight search)
// - hotels               (Amadeus hotel search)
// - calculate-travel-dna (Quiz processing)
// - create-checkout      (Stripe sessions)
// - check-subscription   (Subscription status)
// - send-contact-email   (SendGrid emails)
// - weather              (Weather API)
// - destination-images   (Image fetching)
// ... and more
```

---

## API Endpoint Mapping (Historical Reference)

<!--
@section: api-mapping
@keywords: endpoints, migration, legacy
-->

| Legacy Endpoint | Current Implementation |
|-----------------|------------------------|
| `POST /api/v1/auth/signup` | `supabase.auth.signUp()` |
| `POST /api/v1/auth/login` | `supabase.auth.signInWithPassword()` |
| `GET /api/preferences` | `supabase.from('user_preferences').select()` |
| `POST /api/preferences` | `supabase.from('user_preferences').upsert()` |
| `GET /api/trips` | `supabase.from('trips').select()` |
| `POST /api/trips` | `supabase.from('trips').insert()` |
| `GET /api/profile` | `supabase.from('profiles').select()` |
| `POST /api/itinerary/generate` | Edge function: `generate-itinerary` |

---

## Data Flow Examples

<!--
@section: data-flow
@keywords: quiz, auth, flow, save, session
-->

### Quiz Flow

```
Quiz.tsx (QuizContext)
    │
    ├─ Step 1-10: Collect travel preferences
    │
    ▼
Submit → Edge Function: calculate-travel-dna
    │
    ├─ Calculate archetype scores
    ├─ Determine primary/secondary types
    │
    ▼
Supabase Tables Updated:
  - travel_dna_profiles (full DNA data)
  - profiles.travel_dna (summary)
  - profiles.quiz_completed = true
  - user_preferences (all preferences)
    │
    ▼
Navigate to /profile → TravelDNAReveal component
```

### Auth Flow

```
Sign Up / Sign In
    │
    ▼
supabase.auth.signUp() / signInWithPassword()
    │
    ▼
onAuthStateChange triggered in AuthContext
    │
    ├─ DB Trigger: handle_new_user() auto-creates profile
    │
    ▼
loadUserData() fetches:
  - profiles (display_name, avatar, etc.)
  - user_preferences (travel settings)
    │
    ▼
transformProfile() → User state in AuthContext
```

---

## Database Tables

<!--
@section: tables
@keywords: tables, schema, SQL, profiles, preferences, trips
-->

### 33 Tables (All with RLS)

| Category | Tables |
|----------|--------|
| **User** | profiles, user_preferences, user_roles, user_usage, user_enrichment, user_entitlement_overrides, user_preference_insights |
| **Quiz/DNA** | quiz_sessions, quiz_responses, travel_dna_profiles, travel_dna_history |
| **Trips** | trips, trip_activities, trip_collaborators, trip_payments |
| **Content** | destinations, destination_images, airports, attractions, activities, activity_catalog, activity_feedback, guides, curated_images |
| **Social** | friendships, saved_items |
| **System** | audit_logs, feature_flags, plans, plan_entitlements |
| **Legacy** | user_id_mappings |

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
    ├── login()        → Supabase Auth
    ├── signup()       → Supabase Auth + auto profile
    ├── logout()       → Clear session
    ├── setPreferences() → Saves to Supabase
    └── refreshUserData() → Fetches profile/preferences
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/pages/` | Route components |
| `src/components/` | Reusable UI components |
| `src/services/` | API service files |
| `src/services/supabase/` | Direct Supabase queries |
| `src/contexts/` | React contexts |
| `src/hooks/` | Custom React hooks |
| `src/lib/` | Utilities and stores |
| `supabase/functions/` | Edge functions |

---

## Security Architecture

<!--
@section: security
@keywords: RLS, policies, auth, admin
-->

### Row Level Security (RLS)
- All 31 tables have RLS enabled
- Policies use `auth.uid()` for user-specific data
- Public data (destinations, airports) allows authenticated/anon reads
- Admin operations require `has_role('admin')`

### Views for Limited Exposure
- `profiles_public`: Only id, handle, display_name, avatar_url (for friend search)
- `user_preferences_safe`: Non-sensitive fields only

### Admin Functions
- Use `SECURITY DEFINER` with service role
- Role checks via `has_role()` function
- Audit logging for admin actions

---

## Edge Functions

<!--
@section: edge-functions
@keywords: serverless, deno, functions
-->

| Function | Purpose | External APIs |
|----------|---------|---------------|
| `generate-itinerary` | AI itinerary creation | Lovable AI |
| `flights` | Flight search | Amadeus |
| `hotels` | Hotel search | Amadeus |
| `calculate-travel-dna` | Quiz processing | Lovable AI |
| `create-checkout` | Payment sessions | Stripe |
| `check-subscription` | Subscription status | Stripe |
| `customer-portal` | Billing management | Stripe |
| `send-contact-email` | Contact form | SendGrid |
| `weather` | Weather data | WeatherStack |
| `destination-images` | Image fetching | Pexels |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [SYSTEM_SOT.md](./SYSTEM_SOT.md) | Master source of truth |
| [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) | Itinerary system |
| [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) | Preferences system |
| [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) | Quiz implementation |
