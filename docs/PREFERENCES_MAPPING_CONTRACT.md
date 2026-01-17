# Frontend ↔ Backend Preferences Contract

## Overview

This document defines the required mappings between frontend UI labels and backend canonical codes based on the actual Neon database schema and backend implementation.

## 🗄️ Core Database Schema (Source of Truth)

| Column                      | Type    | Nullable | Current DB Values                    | Frontend Field Name  |
| --------------------------- | ------- | -------- | ------------------------------------ | -------------------- |
| `user_id`                   | uuid    | NO       | (PKs)                                | (server managed)     |
| `planning_preference`       | text    | YES      | `balanced`, `flexible`, `meticulous` | planningPreference   |
| `trip_structure_preference` | text    | YES      | `balanced`, `flexible`, `meticulous` | tripStructure        |
| `travel_pace`               | text    | YES      | `slow`, `moderate`                   | travelPace           |
| `pace_identity`             | text    | YES      | `slow`, `moderate`                   | paceIdentity         |
| `budget_tier`               | text    | YES      | `moderate`, `luxury`                 | budgetTier           |
| `budget`                    | numeric | YES      | (positive numbers)                   | budget               |
| `currency`                  | text    | YES      | Default: USD                         | currency             |
| `eco_friendly`              | boolean | YES      | true/false                           | ecoFriendly          |
| `accommodation_style`       | text    | YES      | `luxury_cocoon`                      | accommodationStyle   |
| `hotel_style`               | text    | YES      | `luxury_cocoon`                      | hotelStyle           |
| `hotel_vs_flight`           | text    | YES      | `balanced`, `budget`, `hotel`        | hotelVsFlight        |
| `hotel_floor_preference`    | text    | YES      | (no current data)                    | hotelFloorPreference |
| `room_preferences`          | text    | YES      | (no current data)                    | roomPreferences      |

## 🔄 Required Frontend Mappings

### Travel Pace

```typescript
export const TRAVEL_PACE_LABEL_TO_CODE = {
  'Relaxed (1-2 activities/day)': 'slow',
  'Moderate (3-4 activities/day)': 'moderate',
  'Active (5+ activities/day)': 'fast',
} as const;
```

### Budget Tier

```typescript
export const BUDGET_TIER_LABEL_TO_CODE = {
  'Budget-friendly': 'budget',
  Comfort: 'moderate',
  'Luxury experiences': 'luxury',
} as const;
```

### Planning Preference

```typescript
export const PLANNING_PREFERENCE_LABEL_TO_CODE = {
  'Balanced planning': 'balanced',
  'Flexible approach': 'flexible',
  'Detailed planning': 'meticulous',
} as const;
```

### Trip Structure

```typescript
export const TRIP_STRUCTURE_LABEL_TO_CODE = {
  'Structured itinerary': 'structured',
  'Flexible schedule': 'flexible',
  'Spontaneous adventure': 'spontaneous',
} as const;
```

### Accommodation Style

```typescript
export const ACCOMMODATION_STYLE_LABEL_TO_CODE = {
  Hotels: 'hotel',
  Hostels: 'hostel',
  'Vacation Rentals': 'airbnb',
  Resorts: 'resort',
  'Luxury Suites': 'luxury_cocoon',
} as const;
```

### Hotel Style

```typescript
export const HOTEL_STYLE_LABEL_TO_CODE = {
  Boutique: 'boutique',
  Business: 'business',
  Luxury: 'luxury',
  Budget: 'budget',
} as const;
```

### Hotel vs Flight Priority

```typescript
export const HOTEL_VS_FLIGHT_LABEL_TO_CODE = {
  'Prioritize hotel quality': 'hotel_focused',
  'Balance both equally': 'balanced',
  'Prioritize flight options': 'flight_focused',
} as const;
```

### Hotel Floor Preference

```typescript
export const HOTEL_FLOOR_LABEL_TO_CODE = {
  'Lower floors': 'low',
  'Higher floors': 'high',
  'No preference': 'no_preference',
} as const;
```

### Room Preferences

```typescript
export const ROOM_PREFERENCES_LABEL_TO_CODE = {
  'Single room': 'single',
  'Double room': 'double',
  Suite: 'suite',
  'Family room': 'family',
} as const;
```

## 🔧 Implementation Requirements

### Field Name Mapping

```typescript
// Frontend must convert camelCase to snake_case
{
  travelPace: 'moderate'        → travel_pace: 'moderate'
  budgetTier: 'luxury'         → budget_tier: 'luxury'
  planningPreference: 'balanced' → planning_preference: 'balanced'
}
```

### Validation Rules

- `budget`: Must be positive number or null
- `eco_friendly`: Must be boolean (true/false/null)
- `currency`: Must be valid ISO currency code (default 'USD')
- All enum fields must match exactly the backend's allowed values

### Example Valid Payload

```typescript
{
  "travel_pace": "moderate",
  "budget_tier": "luxury",
  "planning_preference": "balanced",
  "eco_friendly": true,
  "budget": 5000,
  "currency": "USD"
}
```

## 🚫 Server-Managed Fields (Do Not Send)

- `user_id` (derived from JWT)
- `created_at` (auto-generated)
- `updated_at` (auto-generated)

## 📊 Response Format

### Success (200)

```json
{
  "success": true,
  "message": "Core preferences updated successfully",
  "updated_keys": ["travel_pace", "budget_tier"],
  "data": {
    "user_id": "uuid",
    "travel_pace": "moderate",
    "budget_tier": "luxury",
    "created_at": "2025-10-01T...",
    "updated_at": "2025-10-01T..."
  }
}
```

### Validation Error (400)

```json
{
  "error": "invalid_values",
  "message": "One or more preference values are invalid",
  "validation_errors": [
    {
      "field": "travel_pace",
      "received": "super_fast",
      "allowed": ["slow", "moderate", "fast"],
      "message": "Invalid value for travel_pace"
    }
  ]
}
```

## 🔄 Next Steps

1. Update frontend mappings to match backend exactly
2. Add validation against backend's allowed values
3. Ensure all payloads use snake_case field names
4. Remove any mock/default data
5. Test with actual backend endpoints

## 🎯 Success Criteria

1. Network tab shows snake_case fields
2. Values match backend's allowed options exactly
3. No 400 validation errors from backend
4. Preferences save and reload correctly
