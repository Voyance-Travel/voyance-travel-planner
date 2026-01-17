# Preferences Field Mapping - Source of Truth

**Last Updated:** 2025-09-30  
**Status:** ✅ Active (Implemented in ProfileV6 + PreferencesRedesign)

## Overview

This document maps all Preference fields between the UI form, frontend state, and backend API.

---

## Data Flow

```
Quiz Results (quiz_responses) 
    ↓
Backend enrichment tables (user_core_preferences, user_flight_preferences, etc.)
    ↓
GET /api/v1/user/preferences/{section}
    ↓
Frontend state (backendPreferences)
    ↓
PreferencesRedesign component (form controls)
    ↓ (on change)
PUT /api/v1/user/preferences/{section} (only changed fields)
    ↓
Backend updates & persists
```

---

## Field Mapping

### 1. Travel Style (core preferences)

| UI Label | Form Control | Frontend State | API Endpoint | Backend Table |
|----------|--------------|----------------|--------------|---------------|
| Travel pace | Button group (relaxed/moderate/active) | `backendPreferences.core.travel_pace` | `PUT /api/v1/user/preferences/core` | `user_core_preferences.travel_pace` |
| Budget preference | Select dropdown | `backendPreferences.core.budget_tier` | `PUT /api/v1/user/preferences/core` | `user_core_preferences.budget_tier` |
| Planning preference | Radio group | `backendPreferences.core.trip_structure_preference` | `PUT /api/v1/user/preferences/core` | `user_core_preferences.trip_structure_preference` |

**Quiz Pre-fill:**
- `travel_pace` ← Quiz question about activity level
- `budget_tier` ← Quiz question about spending comfort
- `trip_structure_preference` ← Quiz question about planning style

---

### 2. Flight Preferences

| UI Label | Form Control | Frontend State | API Endpoint | Backend Table |
|----------|--------------|----------------|--------------|---------------|
| Home airport | Text input | `backendPreferences.flight.home_airport` | `PUT /api/v1/user/preferences/flight` | `user_flight_preferences.home_airport` |
| Preferred seat | Select dropdown | `backendPreferences.flight.seat_preference` | `PUT /api/v1/user/preferences/flight` | `user_flight_preferences.seat_preference` |
| Direct flights only | Checkbox | `backendPreferences.flight.direct_flights_only` | `PUT /api/v1/user/preferences/flight` | `user_flight_preferences.direct_flights_only` |
| Preferred airlines | Text input (comma-separated) | `backendPreferences.flight.preferred_airlines` | `PUT /api/v1/user/preferences/flight` | `user_flight_preferences.preferred_airlines` |

**Quiz Pre-fill:**
- `home_airport` ← Quiz asks "Where do you usually fly from?"
- `seat_preference` ← Quiz may ask seat preference
- `direct_flights_only` ← Inferred from "convenience vs price" answers

---

### 3. Accommodation

| UI Label | Form Control | Frontend State | API Endpoint | Backend Table |
|----------|--------------|----------------|--------------|---------------|
| Accommodation style | Button group | `backendPreferences.core.accommodation_style` | `PUT /api/v1/user/preferences/core` | `user_core_preferences.accommodation_style` |
| Room preferences | Select dropdown | `backendPreferences.core.room_preferences` | `PUT /api/v1/user/preferences/core` | `user_core_preferences.room_preferences` |
| Eco-friendly | Checkbox | `backendPreferences.core.eco_friendly` | `PUT /api/v1/user/preferences/core` | `user_core_preferences.eco_friendly` |

**Quiz Pre-fill:**
- `accommodation_style` ← Quiz question about hotel vs Airbnb preference
- `eco_friendly` ← Quiz question about sustainability importance

---

### 4. Food & Dining

| UI Label | Form Control | Frontend State | API Endpoint | Backend Table |
|----------|--------------|----------------|--------------|---------------|
| Dietary restrictions | Checkbox group | `backendPreferences.food.dietary_restrictions` | `PUT /api/v1/user/preferences/food` | `user_food_preferences.dietary_restrictions` |
| Local cuisine adventure level | Radio group | `backendPreferences.food.taste_graph.adventure_level` | `PUT /api/v1/user/preferences/food` | `user_food_preferences.taste_graph` (JSONB) |
| Favorite comfort food | Text input | `backendPreferences.food.comfort_food` | `PUT /api/v1/user/preferences/food` | `user_food_preferences.comfort_food` |
| Celebration meal | Text input | `backendPreferences.food.celebration_food` | `PUT /api/v1/user/preferences/food` | `user_food_preferences.celebration_food` |

**Quiz Pre-fill:**
- `dietary_restrictions` ← Quiz explicitly asks about diet
- `taste_graph.adventure_level` ← Quiz question about trying new foods
- `comfort_food` / `celebration_food` ← Optional quiz questions

---

### 5. Accessibility & Health

| UI Label | Form Control | Frontend State | API Endpoint | Backend Table |
|----------|--------------|----------------|--------------|---------------|
| Mobility level | Select dropdown | `backendPreferences.mobility.mobility_level` | `PUT /api/v1/user/preferences/mobility` | `user_mobility_accessibility.mobility_level` |
| Accessibility needs | Checkbox group | `backendPreferences.mobility.accessibility_needs` | `PUT /api/v1/user/preferences/mobility` | `user_mobility_accessibility.accessibility_needs` |
| Allergies | Text input (comma-separated) | `backendPreferences.mobility.allergies` | `PUT /api/v1/user/preferences/mobility` | `user_mobility_accessibility.allergies` |
| Special considerations | Textarea | `backendPreferences.mobility.medical_considerations` | `PUT /api/v1/user/preferences/mobility` | `user_mobility_accessibility.medical_considerations` |

**Quiz Pre-fill:**
- `mobility_level` ← Quiz question about physical activity comfort
- `allergies` ← Quiz may ask about allergies
- Accessibility needs NOT asked in quiz (too personal for onboarding)

---

### 6. Planning Style

| UI Label | Form Control | Frontend State | API Endpoint | Backend Table |
|----------|--------------|----------------|--------------|---------------|
| AI assistance level | Radio group | `backendPreferences.ai.ai_assistance_level` | `PUT /api/v1/user/preferences/ai` | `user_ai_preferences.ai_assistance_level` |
| Surprise tolerance | Select dropdown | `backendPreferences.ai.surprise_tolerance` | `PUT /api/v1/user/preferences/ai` | `user_ai_preferences.surprise_tolerance` |

**Quiz Pre-fill:**
- `ai_assistance_level` ← Quiz question about control vs automation
- `surprise_tolerance` ← Quiz question about spontaneity

---

## Save Behavior

**Change Detection:**
- On mount: Load from API → Set as `originalPreferences`
- On field change: Update `backendPreferences` (local state)
- On save: Compare `backendPreferences` vs `originalPreferences`
- Only send changed sections via PUT

**Example:**
```typescript
// User changes only home_airport
backendPreferences.flight.home_airport = "LAX"

// On save:
PUT /api/v1/user/preferences/flight
Body: { home_airport: "LAX" }

// Backend merges this with existing flight preferences
// Returns full updated flight object
```

---

## Verification Steps

1. **Load:** Navigate to Profile → Preferences
   - Fields pre-fill from quiz (if quiz completed)
   - Empty fields remain empty (no mock defaults)

2. **Edit:** Change a few fields (e.g., home airport, dietary restrictions)
   - State updates locally
   - No API call yet (manual save)

3. **Save:** Click save or auto-save triggers
   - Only changed sections sent to backend
   - Toast: "Preferences saved successfully!"

4. **Reload:** Refresh page, go back to Preferences
   - Changed values persist
   - Unchanged values still pre-filled from quiz

---

## Backend API Contract

### GET /api/v1/user/preferences/core
**Returns:**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "travel_pace": "moderate",
      "budget_tier": "moderate",
      "accommodation_style": "boutique",
      "trip_structure_preference": "flexible",
      ...
    }
  }
}
```

### PUT /api/v1/user/preferences/core
**Accepts:** Partial update (only changed fields)
```json
{
  "travel_pace": "active",
  "budget_tier": "luxury"
}
```

**Returns:** Full updated preferences object
```json
{
  "success": true,
  "data": {
    "preferences": {
      "travel_pace": "active",
      "budget_tier": "luxury",
      "accommodation_style": "boutique",  // unchanged
      ...
    }
  }
}
```

---

## Files Modified

- `/src/pages/ProfileV6.tsx` - Hydrate & save logic
- `/src/components/profile/PreferencesRedesign.tsx` - Form UI (already existed)
- `/src/services/userPreferencesAPI.ts` - API client (already existed)
- `/src/utils/preferencesMapper.ts` - NEW mapper utility

---

## Known Gaps

1. **Not all quiz fields map to preferences** - Some quiz data goes to `travel_dna` table only
2. **No field validation** - Backend should validate enum values
3. **JSONB fields** (`taste_graph`) - Complex object, limited UI
4. **Planning style section** - Partially implemented, needs refinement

