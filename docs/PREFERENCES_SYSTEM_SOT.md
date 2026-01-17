# 🎯 PREFERENCES SYSTEM - SOURCE OF TRUTH

**Document Status:** ✅ **AUTHORITATIVE SOURCE OF TRUTH**
**Last Updated:** October 1, 2025
**Scope:** All user preferences across frontend, backend, and database

> **⚠️ IMPORTANT**: This is the **SINGLE SOURCE OF TRUTH** for all preference-related implementations. All teams must align to this document. Any changes must be reviewed and approved through proper change management.

---

## 📋 **Document Authority**

This document supersedes all other preference documentation and defines:

- ✅ **Database schema requirements** (Neon PostgreSQL)
- ✅ **Backend API contracts** (field names, types, validation)
- ✅ **Frontend integration standards** (mappings, payloads, responses)
- ✅ **Validation rules** (allowed values, constraints)
- ✅ **Error handling** (response formats, error codes)

---

## 🗄️ **DATABASE SCHEMA (Authoritative)**

Based on production Neon database analysis and current usage patterns.

### Core Preferences Table: `user_core_preferences`

| Column                      | Type                     | Nullable | Default           | Allowed Values                                         | Current Usage  |
| --------------------------- | ------------------------ | -------- | ----------------- | ------------------------------------------------------ | -------------- |
| `user_id`                   | uuid                     | NO       | -                 | Valid UUID                                             | Primary Key    |
| `planning_preference`       | text                     | YES      | null              | `balanced`, `flexible`, `meticulous`                   | ✅ In use      |
| `trip_structure_preference` | text                     | YES      | null              | `structured`, `flexible`, `spontaneous`                | ✅ In use      |
| `travel_pace`               | text                     | YES      | null              | `slow`, `moderate`, `fast`                             | ✅ In use      |
| `pace_identity`             | text                     | YES      | null              | `explorer`, `relaxer`, `adventurer`                    | ✅ In use      |
| `budget_tier`               | text                     | YES      | null              | `budget`, `moderate`, `luxury`                         | ✅ In use      |
| `budget`                    | numeric                  | YES      | null              | Positive number or null                                | Available      |
| `currency`                  | text                     | YES      | 'USD'             | ISO 4217 codes                                         | Default: USD   |
| `eco_friendly`              | boolean                  | YES      | false             | true, false                                            | Available      |
| `accommodation_style`       | text                     | YES      | null              | `hotel`, `hostel`, `airbnb`, `resort`, `luxury_cocoon` | ✅ In use      |
| `hotel_style`               | text                     | YES      | null              | `boutique`, `business`, `luxury`, `budget`             | Available      |
| `hotel_vs_flight`           | text                     | YES      | null              | `hotel_focused`, `balanced`, `flight_focused`          | ✅ In use      |
| `hotel_floor_preference`    | text                     | YES      | null              | `low`, `high`, `no_preference`                         | Available      |
| `room_preferences`          | text                     | YES      | null              | `single`, `double`, `suite`, `family`                  | Available      |
| `is_customized`             | boolean                  | YES      | false             | true, false                                            | Available      |
| `created_at`                | timestamp with time zone | YES      | CURRENT_TIMESTAMP | Auto-generated                                         | Server managed |
| `updated_at`                | timestamp with time zone | YES      | CURRENT_TIMESTAMP | Auto-generated                                         | Server managed |

---

## 🔧 **BACKEND API CONTRACT**

### Endpoint: `PUT /api/v1/user/preferences/core`

#### Authentication

- **Required:** Valid JWT token in `Authorization: Bearer <token>` header
- **User ID:** Extracted from JWT, not from request body

#### Field Name Flexibility

The backend accepts multiple naming conventions for frontend compatibility:

| Database Column             | Primary Frontend Name     | Alternative Names Accepted                       |
| --------------------------- | ------------------------- | ------------------------------------------------ |
| `travel_pace`               | `travelPace`              | `travel_pace`, `pace`                            |
| `budget_tier`               | `budgetTier`              | `budget_tier`, `budgetPreference`, `budgetLevel` |
| `planning_preference`       | `planningPreference`      | `planning_preference`, `planningStyle`           |
| `trip_structure_preference` | `tripStructurePreference` | `trip_structure_preference`, `tripStructure`     |
| `pace_identity`             | `paceIdentity`            | `pace_identity`                                  |
| `accommodation_style`       | `accommodationStyle`      | `accommodation_style`, `accommodationType`       |
| `hotel_style`               | `hotelStyle`              | `hotel_style`, `hotelPreference`                 |
| `hotel_vs_flight`           | `hotelVsFlight`           | `hotel_vs_flight`, `budgetAllocation`            |
| `hotel_floor_preference`    | `hotelFloorPreference`    | `hotel_floor_preference`, `floorPreference`      |
| `room_preferences`          | `roomPreferences`         | `room_preferences`, `roomType`                   |
| `budget`                    | `budget`                  | `budgetAmount`                                   |
| `currency`                  | `currency`                | `currencyPreference`                             |
| `eco_friendly`              | `ecoFriendly`             | `eco_friendly`, `ecoFriendlyTravel`              |
| `is_customized`             | `isCustomized`            | `is_customized`, `customized`                    |

#### Validation Rules

**Enum Fields (String):**

```typescript
const ALLOWED_VALUES = {
  travel_pace: ['slow', 'moderate', 'fast'],
  budget_tier: ['budget', 'moderate', 'luxury'],
  planning_preference: ['balanced', 'flexible', 'meticulous'],
  trip_structure_preference: ['structured', 'flexible', 'spontaneous'],
  pace_identity: ['explorer', 'relaxer', 'adventurer'],
  accommodation_style: ['hotel', 'hostel', 'airbnb', 'resort', 'luxury_cocoon'],
  hotel_style: ['boutique', 'business', 'luxury', 'budget'],
  hotel_vs_flight: ['hotel_focused', 'balanced', 'flight_focused'],
  hotel_floor_preference: ['low', 'high', 'no_preference'],
  room_preferences: ['single', 'double', 'suite', 'family'],
  currency: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'NZD'],
};
```

**Numeric Fields:**

- `budget`: Must be positive number or null

**Boolean Fields:**

- `eco_friendly`: true, false, or null
- `is_customized`: true, false, or null

#### Server-Managed Fields (Filtered Out)

These fields are automatically handled by the backend and should NOT be sent by frontend:

- `user_id` (derived from JWT)
- `created_at` (auto-generated)
- `updated_at` (auto-generated)

#### Request Examples

**Valid Request:**

```json
{
  "travelPace": "moderate",
  "budgetTier": "luxury",
  "planningPreference": "balanced",
  "accommodationStyle": "hotel",
  "ecoFriendly": true,
  "budget": 5000
}
```

**Invalid Request (400 Error):**

```json
{
  "travelPace": "super_fast", // Invalid value
  "budgetTier": "unlimited" // Invalid value
}
```

#### Response Formats

**Success with Changes (200):**

```json
{
  "success": true,
  "message": "Core preferences updated successfully",
  "updated_keys": ["travel_pace", "budget_tier", "planning_preference"],
  "data": {
    /* complete updated record */
  }
}
```

**Success with No Changes (200):**

```json
{
  "success": true,
  "message": "No changes to save",
  "updated_keys": []
}
```

**Validation Error (400):**

```json
{
  "error": "invalid_values",
  "message": "One or more preference values are invalid",
  "validation_errors": [
    {
      "field": "travel_pace",
      "received": "super_fast",
      "allowed": ["slow", "moderate", "fast"],
      "message": "Invalid value 'super_fast' for field 'travel_pace'. Allowed values: slow, moderate, fast"
    }
  ],
  "invalid_fields": ["travel_pace"]
}
```

---

## 🎨 **FRONTEND INTEGRATION STANDARDS**

### Recommended Field Mappings

Frontend should use these exact mappings for consistency:

```typescript
// AUTHORITATIVE FRONTEND MAPPINGS
export const TRAVEL_PACE_LABEL_TO_CODE = {
  'Relaxed (1-2 activities/day)': 'slow',
  'Moderate (3-4 activities/day)': 'moderate',
  'Active (5+ activities/day)': 'fast',
} as const;

export const BUDGET_TIER_LABEL_TO_CODE = {
  'Budget-friendly': 'budget',
  Comfort: 'moderate',
  'Luxury experiences': 'luxury',
} as const;

export const PLANNING_PREFERENCE_LABEL_TO_CODE = {
  'Balanced planning': 'balanced',
  'Flexible approach': 'flexible',
  'Detailed planning': 'meticulous',
} as const;

export const TRIP_STRUCTURE_LABEL_TO_CODE = {
  'Structured itinerary': 'structured',
  'Flexible schedule': 'flexible',
  'Go with the flow': 'spontaneous',
} as const;

export const ACCOMMODATION_STYLE_LABEL_TO_CODE = {
  Hotels: 'hotel',
  Hostels: 'hostel',
  'Vacation Rentals': 'airbnb',
  Resorts: 'resort',
  'Luxury Suites': 'luxury_cocoon',
} as const;
```

### Payload Construction Standards

**✅ CORRECT: Send only changed fields with camelCase names**

```typescript
const payload = {
  travelPace: 'moderate', // ✅ camelCase
  budgetTier: 'luxury', // ✅ valid enum value
  ecoFriendly: true, // ✅ boolean
};
```

**❌ INCORRECT: Don't send metadata or entire objects**

```typescript
const payload = {
  user_id: '123',              // ❌ Server-managed
  created_at: '2024-...',      // ❌ Server-managed
  entireUserObject: {...}      // ❌ Too much data
};
```

### Response Handling Standards

```typescript
// Handle all response types properly
if (response.success) {
  if (response.updated_keys.length > 0) {
    // Preferences were updated
    showSuccessMessage('Preferences saved successfully');
  } else {
    // No changes detected (this is normal)
    showInfoMessage('No changes to save');
  }
} else if (response.error === 'invalid_values') {
  // Show validation errors to user
  displayValidationErrors(response.validation_errors);
}
```

---

## 🔍 **SCHEMA DISCOVERY API**

### Endpoint: `GET /api/v1/user/preferences/schema`

Frontend should use this endpoint to dynamically build validation and mappings:

```typescript
// Fetch schema on app initialization
const schema = await fetch('/api/v1/user/preferences/schema').then(r => r.json());

// Use schema.core to validate field names and values
const coreFields = Object.keys(schema.core);
const allowedValues = schema.core.travel_pace.values; // ['slow', 'moderate', 'fast']
```

---

## 🧪 **TESTING STANDARDS**

### Validation Test Cases

All implementations must pass these test scenarios:

1. **Valid Core Update:** Send valid camelCase fields with allowed values
2. **Empty Payload:** Send only server-managed fields (should return success with no changes)
3. **Invalid Values:** Send invalid enum values (should return 400 with clear errors)
4. **Mixed Case:** Send both camelCase and snake_case (should work)
5. **Unknown Fields:** Send unknown field names (should be ignored)

### Production Testing

```bash
# Test schema endpoint
curl https://voyance-backend-production.up.railway.app/api/v1/user/preferences/schema

# Test valid update (requires auth token)
curl -X PUT https://voyance-backend-production.up.railway.app/api/v1/user/preferences/core \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"travelPace": "moderate", "budgetTier": "luxury"}'
```

---

## 🚨 **CHANGE MANAGEMENT**

### Approval Required For:

- Adding new preference fields
- Changing allowed values for existing fields
- Modifying API response formats
- Database schema changes

### Process:

1. **Propose change** with impact analysis
2. **Update this SOT document** first
3. **Get approval** from backend, frontend, and product teams
4. **Implement changes** in order: DB → Backend → Frontend
5. **Update tests** and documentation

---

## 📊 **IMPLEMENTATION STATUS**

### ✅ **Completed (Production Ready)**

- [x] Database schema defined and deployed
- [x] Backend API implemented with validation
- [x] Schema discovery endpoint available
- [x] Comprehensive error handling
- [x] Production deployment on Railway
- [x] Debug logging and monitoring

### 🔧 **Frontend Required Actions**

- [ ] Implement corrected field mappings
- [ ] Add missing preference fields to UI
- [ ] Fix payload construction (send preferences, not metadata)
- [ ] Handle all response types properly
- [ ] Add client-side validation using schema endpoint

---

## 🎯 **SUCCESS CRITERIA**

### Definition of Done:

1. ✅ Network tab shows PUT request with actual preference data
2. ✅ Backend receives valid field names and values
3. ✅ No 400 validation errors in production
4. ✅ Preferences persist correctly on page reload
5. ✅ Clear error messages for invalid input

### Current Status:

- **Backend:** ✅ 100% complete and production ready
- **Frontend:** 🔧 Implementation needed (contract provided)

---

**This document is the authoritative source for all preference system implementations. All teams must align to these specifications.** 🎯
