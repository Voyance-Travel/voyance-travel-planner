# Preferences System - Lovable Adaptation

**Last Updated**: January 2025  
**Status**: ✅ Core Implemented  
**See also**: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [INDEX.md](./INDEX.md)

> **Adapted from**: PREFERENCES_RECONCILIATION.md, PREFERENCES_DATA_FIELDS.md, PREFERENCES_SYSTEM_SOT.md

This document describes how preferences work in the Lovable codebase.

---

## Current Implementation

### Preferences Flow

```
Quiz.tsx
    │
    ▼
setPreferences() in AuthContext
    │
    ▼
preferencesApi.update() in neonDb.ts
    │
    ▼
PUT /neon-db/preferences
    │
    ▼
user_preferences table in Neon
```

### Current Fields Captured

| Field | Quiz Question | DB Column |
|-------|--------------|-----------|
| Style | "What's your travel style?" | `travel_style` |
| Budget | "What's your typical travel budget?" | `budget` |
| Pace | "What pace do you prefer?" | `pace` |
| Interests | "What interests you most?" | `interests` (array) |
| Accommodation | "Where do you like to stay?" | `accommodation` |

---

## API Usage

### Reading Preferences

```typescript
import { preferencesApi } from '@/services/neonDb';

// Get user preferences
const result = await preferencesApi.get(userId);
if (result.data?.[0]) {
  const prefs = result.data[0];
  // prefs.travel_style, prefs.budget, etc.
}
```

### Writing Preferences

```typescript
// From AuthContext
await preferencesApi.update(userId, {
  style: 'luxury',      // maps to travel_style
  budget: 'premium',
  pace: 'moderate',
  interests: ['food', 'art', 'nature'],
  accommodation: 'boutique'
});
```

---

## Null Safety (Required)

Always use optional chaining when accessing preferences:

```typescript
// ✅ CORRECT
const budget = user?.preferences?.budget || 'moderate';
const interests = user?.preferences?.interests || [];

// ❌ WRONG - Will crash if null
const budget = user.preferences.budget;
```

---

## Future: Extended Preferences

To match the original system, add these tables/endpoints:

### Flight Preferences
```typescript
interface FlightPreferences {
  home_airport: string;           // IATA code (e.g., 'JFK')
  preferred_airlines: string[];   // e.g., ['Delta', 'United']
  seat_preference: string;        // economy, premium_economy, business, first
  direct_flights_only: boolean;
  flight_time_preference: string; // early_am, midday, afternoon, red_eye
}
```

### Food Preferences
```typescript
interface FoodPreferences {
  dietary_restrictions: string[];  // vegan, vegetarian, gluten_free, etc.
  cuisine_preferences: string[];   // italian, japanese, mexican, etc.
  spice_tolerance: string;         // mild, medium, spicy, very_spicy
  price_sensitivity: string;       // budget, moderate, splurge
}
```

### Mobility & Accessibility
```typescript
interface MobilityPreferences {
  accessibility_needs: string[];   // wheelchair, elevator, ground_floor, etc.
  walking_tolerance: string;       // limited, moderate, extensive
  noise_sensitivity: string;       // not_sensitive, moderate, high
}
```

---

## Type Definitions

Current types in AuthContext:

```typescript
export interface TravelPreferences {
  style?: string;
  budget?: string;
  pace?: string;
  interests?: string[];
  accommodation?: string;
}
```

Extended types (future):

```typescript
export interface FullTravelPreferences {
  // Core (current)
  style?: string;
  budget?: string;
  pace?: string;
  interests?: string[];
  accommodation?: string;
  
  // Flight
  home_airport?: string;
  preferred_airlines?: string[];
  seat_preference?: string;
  direct_flights_only?: boolean;
  
  // Food
  dietary_restrictions?: string[];
  cuisine_preferences?: string[];
  
  // Mobility
  accessibility_needs?: string[];
  walking_tolerance?: string;
  
  // Travel DNA (calculated)
  archetype?: string;
  archetype_confidence?: number;
  emotional_drivers?: string[];
}
```

---

## Migration Path

1. **Phase 1** (Current): Basic 5-field preferences ✅
2. **Phase 2**: Add flight preferences table + quiz questions
3. **Phase 3**: Add food preferences table + quiz questions
4. **Phase 4**: Add mobility preferences + quiz questions
5. **Phase 5**: Implement Travel DNA calculation on backend

---

## Related SOT Documents

- [PREFERENCES_SYSTEM_SOT.md](./PREFERENCES_SYSTEM_SOT.md) - Full original spec (371 lines)
- [PREFERENCES_MAPPING_CONTRACT.md](./PREFERENCES_MAPPING_CONTRACT.md) - Field mappings
- [PREFERENCES_FIELD_MAPPING.md](./PREFERENCES_FIELD_MAPPING.md) - UI to DB mapping
- [PREFERENCES_RECONCILIATION_GUIDE.md](./PREFERENCES_RECONCILIATION_GUIDE.md) - Frontend changes
- [TRAVEL_ARCHETYPES.md](./TRAVEL_ARCHETYPES.md) - 25+ travel personalities
