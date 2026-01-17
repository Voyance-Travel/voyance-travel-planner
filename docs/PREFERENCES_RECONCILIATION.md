# Frontend Preferences Reconciliation Guide

**CRITICAL**: This document outlines all changes the frontend MUST make to align with the backend preferences system.

## Table of Contents
1. [Critical Changes Summary](#critical-changes-summary)
2. [API Endpoint Changes](#api-endpoint-changes)
3. [Null Safety Requirements](#null-safety-requirements)
4. [Data Type Corrections](#data-type-corrections)
5. [Personal Notes Fields](#personal-notes-fields)
6. [Derived Fields](#derived-fields)
7. [Enum Value Standards](#enum-value-standards)
8. [Save Operation Changes](#save-operation-changes)
9. [Migration Checklist](#migration-checklist)
10. [Testing Requirements](#testing-requirements)

## Critical Changes Summary

### ⚠️ BREAKING CHANGES
1. **API Endpoints** - Use `/api/preferences/frontend` NOT `/api/preferences`
2. **Null Safety** - EVERY field access must handle null
3. **Data Types** - Booleans as boolean, Arrays as arrays, Budget as string range
4. **Personal Notes** - Many fields are in `personal_notes` JSON
5. **Derived Fields** - Some fields don't exist directly
6. **Enum Values** - Use exact lowercase with underscores
7. **Save Operations** - Save complete category objects

## API Endpoint Changes

### ❌ WRONG - Old Endpoints
```typescript
// These endpoints will be deprecated
GET  /api/preferences
POST /api/preferences
GET  /api/userPreferences
POST /api/userPreferences
```

### ✅ CORRECT - New Endpoints
```typescript
// Use these frontend-formatted endpoints
GET  /api/preferences/frontend          // Get all preferences
POST /api/preferences/frontend          // Update preferences
GET  /api/preferences/frontend/{category} // Get specific category

// Category can be: core, flight, food, mobility, ai, travelDNA
```

### Example Implementation
```typescript
// services/preferencesAPI.ts
export const preferencesAPI = {
  // Get all preferences
  async getPreferences(): Promise<FrontendPreferences> {
    const response = await apiService.get('/api/preferences/frontend');
    return response.data || getDefaultPreferences();
  },

  // Update preferences
  async updatePreferences(data: Partial<FrontendPreferences>): Promise<void> {
    await apiService.post('/api/preferences/frontend', data);
  },

  // Get specific category
  async getCategory(category: PreferenceCategory): Promise<any> {
    const response = await apiService.get(`/api/preferences/frontend/${category}`);
    return response.data || getDefaultCategory(category);
  }
};
```

## Null Safety Requirements

### ❌ WRONG - Unsafe Access
```typescript
// This will crash if preferences or core is null
const budget = preferences.core.budget;
const airlines = preferences.flight.preferred_airlines;
const bookingStyle = preferences.core.booking_style;
```

### ✅ CORRECT - Null-Safe Access
```typescript
// Always use optional chaining and defaults
const budget = preferences?.core?.budget || '100-500';
const airlines = preferences?.flight?.preferred_airlines || [];
const bookingStyle = preferences?.core?.booking_style || 'flexible';

// For nested access
const noiseSensitivity = preferences?.mobility?.noise_sensitivity || 'not_sensitive';
```

### Utility Function for Safe Access
```typescript
// utils/preferences.ts
export function getPreferenceValue<T>(
  preferences: FrontendPreferences | null,
  path: string,
  defaultValue: T
): T {
  if (!preferences) return defaultValue;
  
  const keys = path.split('.');
  let value: any = preferences;
  
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined || value === null) {
      return defaultValue;
    }
  }
  
  return value as T;
}

// Usage
const budget = getPreferenceValue(preferences, 'core.budget', '100-500');
```

## Data Type Corrections

### 1. Booleans
```typescript
// ❌ WRONG
direct_flights_only: "true"  // String
eco_friendly: 1              // Number

// ✅ CORRECT
direct_flights_only: true    // Boolean
eco_friendly: false          // Boolean
```

### 2. Arrays
```typescript
// ❌ WRONG
preferred_airlines: "Delta, United, American"  // Comma-separated string
dietary_restrictions: "vegan,gluten-free"      // Comma-separated string

// ✅ CORRECT
preferred_airlines: ["Delta", "United", "American"]  // Array
dietary_restrictions: ["vegan", "gluten_free"]       // Array with underscores
```

### 3. Budget Format
```typescript
// ❌ WRONG
budget: { min: 100, max: 500 }  // Object
budget: [100, 500]              // Array
budget: 300                     // Single number

// ✅ CORRECT
budget: "100-500"               // String range
budget: "300"                   // Single value as string
```

### Type Conversion Helpers
```typescript
// utils/typeConversion.ts

export function toBudgetString(value: any): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (Array.isArray(value)) return `${value[0]}-${value[1]}`;
  if (value?.min && value?.max) return `${value.min}-${value.max}`;
  return '100-500'; // default
}

export function toBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  if (typeof value === 'number') return value === 1;
  return false;
}

export function toArray(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}
```

## Personal Notes Fields

Many fields are currently stored in the `personal_notes` JSON field. The frontend must handle these specially:

### Fields in Personal Notes
```typescript
interface PersonalNotesFields {
  // Core
  booking_style: string;
  
  // Food
  price_sensitivity: string;
  
  // Mobility
  noise_sensitivity: string;
  
  // Activity (all fields)
  active_hours_per_day: string;
  recovery_style: string;
  meal_timing_preference: string;
  jet_lag_profile: string;
  
  // Values
  privacy_threshold: string;
  special_accessibility_needs: string;
  
  // Memory (all fields)
  trip_rituals: string;
  collection_preference: string;
  favorite_trip_vibe: string;
  special_trip_reason: string;
}
```

### Reading Personal Notes Fields
```typescript
// The backend will extract these for you
const bookingStyle = preferences?.core?.booking_style || 'flexible';
const noiseSensitivity = preferences?.mobility?.noise_sensitivity || 'not_sensitive';

// Activity fields
const activeHours = preferences?.activity?.active_hours_per_day || '6-8';
const recoveryStyle = preferences?.activity?.recovery_style || 'spa';
```

### Saving Personal Notes Fields
```typescript
// When saving, include these fields in their categories
await preferencesAPI.updatePreferences({
  core: {
    ...existingCore,
    booking_style: 'advance'  // Will be stored in personal_notes
  },
  mobility: {
    ...existingMobility,
    noise_sensitivity: 'high'  // Will be stored in personal_notes
  }
});
```

## Derived Fields

Some frontend fields don't exist directly in the database and must be derived:

### 1. Transfer Tolerance
```typescript
// Backend only has: direct_flights_only (boolean)
// Frontend expects: transfer_tolerance (enum)

// Derive transfer_tolerance from direct_flights_only
function getTransferTolerance(directFlightsOnly: boolean): string {
  return directFlightsOnly ? 'nonstop_only' : 'one_stop';
}

// Save transfer_tolerance by setting direct_flights_only
function saveTransferTolerance(tolerance: string): boolean {
  return tolerance === 'nonstop_only';
}
```

### 2. Environmental Concerns
```typescript
// Backend only has: eco_friendly (boolean)
// Frontend expects: environmental_concerns (enum)

// Derive environmental_concerns from eco_friendly
function getEnvironmentalConcerns(ecoFriendly: boolean): string {
  return ecoFriendly ? 'low_impact' : 'none';
}

// Save environmental_concerns by setting eco_friendly
function saveEnvironmentalConcerns(concerns: string): boolean {
  return concerns !== 'none';
}
```

### 3. Cultural Immersion Level
```typescript
// Derived from multiple fields
function getCulturalImmersionLevel(preferences: any): string {
  const authenticityScore = preferences?.core?.comfort_vs_authenticity || 50;
  const localFood = preferences?.food?.local_cuisine_adventure || 'moderate';
  
  if (authenticityScore > 70 && localFood === 'adventurous') return 'deep';
  if (authenticityScore < 30) return 'tourist';
  return 'mixed';
}
```

## Enum Value Standards

### ❌ WRONG - Incorrect Enum Values
```typescript
seat_preference: "Economy"        // Capital letters
seat_preference: "premium economy" // Space
seat_preference: "premium-economy" // Hyphen
booking_style: "Book well in advance" // Full text
```

### ✅ CORRECT - Standard Enum Values
```typescript
seat_preference: "economy"         // Lowercase
seat_preference: "premium_economy" // Underscore
seat_preference: "business"        // Simple
booking_style: "advance"          // Short key
```

### Enum Mappings
```typescript
// utils/enumMappings.ts

export const SEAT_PREFERENCE_MAP = {
  'Economy': 'economy',
  'Premium Economy': 'premium_economy',
  'Business': 'business',
  'First Class': 'first'
};

export const BOOKING_STYLE_MAP = {
  'Book well in advance': 'advance',
  'Flexible bookings preferred': 'flexible',
  'Decide last-minute': 'last_minute',
  'Mix of both': 'mixed'
};

// Convert display value to enum
export function toEnumValue(displayValue: string, map: Record<string, string>): string {
  return map[displayValue] || displayValue.toLowerCase().replace(/[\s-]/g, '_');
}

// Convert enum to display value
export function toDisplayValue(enumValue: string, map: Record<string, string>): string {
  const reverseMap = Object.entries(map).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});
  return reverseMap[enumValue] || enumValue;
}
```

## Save Operation Changes

### ❌ WRONG - Saving Individual Fields
```typescript
// Don't save individual fields
await updatePreference('core.budget', '100-500');
await updatePreference('flight.seat_preference', 'business');
```

### ✅ CORRECT - Save Complete Categories
```typescript
// Always save complete category objects
await preferencesAPI.updatePreferences({
  core: {
    budget: '100-500',
    budget_tier: 'moderate',
    accommodation_style: 'hotel',
    booking_style: 'advance',
    room_preferences: 'king',
    planning_preference: 'planned',
    trip_structure_preference: 'structured',
    packing_style: 'light',
    travel_pace: 'moderate',
    comfort_vs_authenticity: 'balanced',
    spontaneity: 'planned',
    booking_advance: '3_months',
    eco_friendly: true
  }
});
```

### Save Handler Pattern
```typescript
// components/PreferenceForm.tsx
const handleSavePreferences = async () => {
  try {
    // Get current values from all sections
    const currentPreferences = {
      core: {
        ...defaultCorePreferences,
        ...formValues.core
      },
      flight: {
        ...defaultFlightPreferences,
        ...formValues.flight
      },
      food: {
        ...defaultFoodPreferences,
        ...formValues.food
      },
      mobility: {
        ...defaultMobilityPreferences,
        ...formValues.mobility
      }
    };

    // Save all at once
    await preferencesAPI.updatePreferences(currentPreferences);
    
    toast.success('Preferences saved successfully');
  } catch (error) {
    toast.error('Failed to save preferences');
  }
};
```

## Migration Checklist

### Phase 1: Update API Calls (Priority: CRITICAL)
- [ ] Replace all `/api/preferences` calls with `/api/preferences/frontend`
- [ ] Update response type definitions
- [ ] Add error handling for new endpoints

### Phase 2: Add Null Safety (Priority: HIGH)
- [ ] Add optional chaining to all preference access
- [ ] Provide default values for all fields
- [ ] Create utility functions for safe access

### Phase 3: Fix Data Types (Priority: HIGH)
- [ ] Convert string booleans to boolean
- [ ] Convert comma-separated strings to arrays
- [ ] Convert budget objects to string ranges
- [ ] Add type conversion utilities

### Phase 4: Handle Personal Notes (Priority: MEDIUM)
- [ ] Update form fields for personal notes values
- [ ] Ensure save operations include these fields
- [ ] Add proper typing for these fields

### Phase 5: Implement Derived Fields (Priority: MEDIUM)
- [ ] Create derivation functions
- [ ] Update UI to use derived values
- [ ] Update save logic to convert back

### Phase 6: Standardize Enums (Priority: LOW)
- [ ] Create enum mapping utilities
- [ ] Update all dropdowns to use standard values
- [ ] Add display value converters

## Testing Requirements

### 1. API Integration Tests
```typescript
describe('Preferences API', () => {
  it('should use frontend endpoints', async () => {
    const spy = jest.spyOn(apiService, 'get');
    await preferencesAPI.getPreferences();
    expect(spy).toHaveBeenCalledWith('/api/preferences/frontend');
  });
  
  it('should handle null responses', async () => {
    apiService.get.mockResolvedValue({ data: null });
    const prefs = await preferencesAPI.getPreferences();
    expect(prefs).toEqual(getDefaultPreferences());
  });
});
```

### 2. Null Safety Tests
```typescript
describe('Null Safety', () => {
  it('should handle null preferences object', () => {
    const budget = getPreferenceValue(null, 'core.budget', '100-500');
    expect(budget).toBe('100-500');
  });
  
  it('should handle missing nested properties', () => {
    const prefs = { core: null };
    const budget = getPreferenceValue(prefs, 'core.budget', '100-500');
    expect(budget).toBe('100-500');
  });
});
```

### 3. Type Conversion Tests
```typescript
describe('Type Conversions', () => {
  it('should convert budget formats', () => {
    expect(toBudgetString({ min: 100, max: 500 })).toBe('100-500');
    expect(toBudgetString([100, 500])).toBe('100-500');
    expect(toBudgetString(300)).toBe('300');
    expect(toBudgetString('100-500')).toBe('100-500');
  });
  
  it('should convert to boolean', () => {
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('false')).toBe(false);
    expect(toBoolean(1)).toBe(true);
    expect(toBoolean(0)).toBe(false);
  });
});
```

### 4. Save Operation Tests
```typescript
describe('Save Operations', () => {
  it('should save complete categories', async () => {
    const spy = jest.spyOn(apiService, 'post');
    await preferencesAPI.updatePreferences({ core: mockCorePrefs });
    
    expect(spy).toHaveBeenCalledWith(
      '/api/preferences/frontend',
      expect.objectContaining({
        core: expect.objectContaining({
          budget: expect.any(String),
          eco_friendly: expect.any(Boolean)
        })
      })
    );
  });
});
```

## Common Errors and Solutions

### Error: "Cannot read property 'budget' of undefined"
**Solution**: Add null safety checks
```typescript
const budget = preferences?.core?.budget || '100-500';
```

### Error: "Expected boolean, got string"
**Solution**: Convert string to boolean
```typescript
direct_flights_only: toBoolean(formValue)
```

### Error: "Invalid enum value"
**Solution**: Use standard enum format
```typescript
seat_preference: toEnumValue(displayValue, SEAT_PREFERENCE_MAP)
```

### Error: "Field not found in response"
**Solution**: Check if field is in personal_notes
```typescript
// These fields come from personal_notes
const bookingStyle = preferences?.core?.booking_style || 'flexible';
```

## Timeline

### Week 1 (Critical)
- Update all API endpoints
- Add null safety throughout
- Fix boolean and array types

### Week 2 (High Priority)
- Handle personal notes fields
- Implement derived fields
- Update save operations

### Week 3 (Medium Priority)
- Standardize enum values
- Add comprehensive tests
- Update documentation

### Week 4 (Low Priority)
- Performance optimizations
- UI/UX improvements
- Code cleanup

---

**This document must be followed exactly to ensure frontend-backend compatibility.**