# Preferences System - Lovable Cloud

<!--
@keywords: preferences, quiz, travel style, budget, interests, accommodation, user settings
@category: PREFERENCES
@searchTerms: user preferences, quiz results, travel settings, save preferences, get preferences
-->

**Last Updated**: January 2025  
**Status**: ✅ Fully Implemented  
**See also**: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) | [INDEX.md](./INDEX.md)

This document describes how preferences work in the Lovable Cloud codebase.

---

## Current Implementation

<!--
@section: current
@keywords: flow, diagram, quiz, save, Supabase
-->

### Preferences Flow

```
Quiz.tsx (10 steps)
    │
    ▼
Edge Function: calculate-travel-dna
    │
    ▼
supabase.from('user_preferences').upsert()
    │
    ▼
user_preferences table (PostgreSQL with RLS)
```

### Also Updated via AuthContext

```
AuthContext.setPreferences()
    │
    ▼
supabase.from('user_preferences').upsert()
```

---

## Database Schema

<!--
@section: schema
@keywords: SQL, table, columns, user_preferences
-->

The `user_preferences` table contains extensive travel preferences:

### Core Preferences
| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | Primary key (FK to auth.users) |
| travel_style | TEXT | luxury, adventure, cultural, relaxation |
| budget_tier | TEXT | budget, moderate, premium, luxury |
| travel_pace | TEXT | slow, moderate, fast |
| interests | TEXT[] | Array of interests |
| accommodation_style | TEXT | hotel, boutique, airbnb, hostel |

### Extended Preferences
| Column | Type | Description |
|--------|------|-------------|
| dietary_restrictions | TEXT[] | Food allergies/restrictions |
| food_likes | TEXT[] | Preferred cuisines |
| food_dislikes | TEXT[] | Cuisines to avoid |
| mobility_level | TEXT | Mobility capabilities |
| mobility_needs | TEXT | Accessibility requirements |
| climate_preferences | TEXT[] | Preferred weather |
| preferred_regions | TEXT[] | Favorite regions |

### Flight Preferences
| Column | Type | Description |
|--------|------|-------------|
| home_airport | TEXT | Departure airport (IATA code) |
| flight_time_preference | TEXT | morning, afternoon, evening |
| seat_preference | TEXT | window, aisle, middle |
| direct_flights_only | BOOLEAN | Prefer non-stop |
| preferred_airlines | TEXT[] | Favorite airlines |

### Activity Preferences
| Column | Type | Description |
|--------|------|-------------|
| activity_level | TEXT | low, moderate, high |
| max_activities_per_day | INTEGER | 3-8 activities |
| schedule_flexibility | TEXT | rigid, flexible |
| daytime_bias | TEXT | morning, evening |

---

## API Usage

<!--
@section: api-usage
@keywords: API, Supabase, read, write
-->

### Reading Preferences

```typescript
import { supabase } from '@/integrations/supabase/client';

// Get current user's preferences
const { data, error } = await supabase
  .from('user_preferences')
  .select('*')
  .eq('user_id', userId)
  .single();

if (data) {
  console.log(data.travel_style, data.budget_tier, data.interests);
}
```

### Writing Preferences

```typescript
// Via AuthContext (recommended)
const { setPreferences } = useAuth();
await setPreferences({
  style: 'luxury',
  budget: 'premium',
  pace: 'moderate',
  interests: ['food', 'art', 'nature'],
  accommodation: 'boutique'
});

// Direct Supabase (full control)
await supabase.from('user_preferences').upsert({
  user_id: userId,
  travel_style: 'adventure',
  budget_tier: 'moderate',
  travel_pace: 'fast',
  interests: ['nature', 'hiking'],
  dietary_restrictions: ['vegetarian'],
}, { onConflict: 'user_id' });
```

---

## Null Safety (Required)

<!--
@section: null-safety
@keywords: null, undefined, optional, chaining, default
-->

Always use optional chaining when accessing preferences:

```typescript
// ✅ Safe
const style = user?.preferences?.style || 'relaxation';
const interests = user?.preferences?.interests ?? [];

// ❌ Unsafe - will crash if preferences is undefined
const style = user.preferences.style;
```

---

## Views for Limited Exposure

<!--
@section: views
@keywords: security, views, public, safe
-->

### user_preferences_safe View

For features that need to read preferences without exposing sensitive data:

```sql
-- Only exposes non-sensitive fields
SELECT 
  user_id,
  travel_pace,
  budget_tier,
  activity_level,
  travel_style,
  quiz_completed,
  created_at,
  updated_at
FROM public.user_preferences;
```

**Not exposed**: dietary_restrictions, mobility_needs, home_airport, phone_number

---

## Quiz Integration

<!--
@section: quiz
@keywords: quiz, steps, travel DNA
-->

The travel quiz (10 steps) populates preferences via the `calculate-travel-dna` edge function:

1. **Travel Style** → travel_style
2. **Budget** → budget_tier
3. **Pace** → travel_pace
4. **Interests** → interests[]
5. **Accommodation** → accommodation_style
6. **Dining** → dining_style, dietary_restrictions
7. **Activities** → activity_level, activity_weights
8. **Planning** → schedule_flexibility
9. **Climate** → climate_preferences, weather_preferences
10. **Special** → mobility_needs, accessibility_needs

---

## Related Files

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | setPreferences() method |
| `src/contexts/QuizContext.tsx` | Quiz answer collection |
| `supabase/functions/calculate-travel-dna/` | Preference processing |
| `src/services/profileAPI.ts` | updatePreferences() |
| `src/components/profile/preferences/` | Preference editing UI |
