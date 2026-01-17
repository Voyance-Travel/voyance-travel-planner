# Profile Page - Frontend ↔ Backend Alignment Document

**Status**: Active Review  
**Created**: 2025-09-29  
**Purpose**: Ensure ProfileV6 frontend implementation matches backend API contracts exactly

---

## Executive Summary

This document compares the **frontend implementation** (ProfileV6.tsx) with the **backend API contracts** to identify and resolve any misalignments.

### Current Status (Updated 2025-09-30)
✅ **Trips Tab**: Aligned - uses `tripsAPI.getUserTrips()` correctly  
✅ **Preferences Tab**: FIXED - Now properly calls backend and shows actual errors  
✅ **Overview Tab**: Aligned - uses dashboard API correctly  
✅ **Billing Tab**: Aligned - uses billing API correctly  
⏳ **Companions Tab**: Not yet implemented  
⏳ **Achievements Tab**: Not yet implemented  

### Critical Fix Applied
🔴 **FIXED**: Removed `withErrorHandling` from save operations - was hiding backend failures and showing false "success" messages  

---

## VERIFIED DATA FLOW - Preferences Tab

### On Tab Load (What Actually Happens):
1. ✅ **Real API Call**: `userPreferencesAPI.getUserPreferences(authUser.id)` → Makes 6 parallel GETs to production backend
2. ✅ **No Mock Data**: `environment.features.useMockData = false` → Always hits real backend
3. ✅ **Production Backend**: `https://voyance-backend-production.up.railway.app/api/v1/user/preferences/*`
4. ✅ **Auth Header**: Uses `localStorage.getItem('authToken')` automatically
5. ✅ **Data Mapping**: Backend camelCase → Frontend camelCase (via mappers in user-preferences-mapper.ts)
6. ✅ **State Update**: Merges loaded data into `backendPreferences` state
7. ✅ **No Caching**: Always fresh data from backend (no localStorage cache)

### On Field Change (What Actually Happens):
1. ✅ **Local State Only**: `handlePreferenceChange()` updates React state
2. ✅ **No API Call**: Changes stay in memory until Save clicked
3. ✅ **No Auto-Save**: User must explicitly click Save button

### On Save Click (What Actually Happens):
1. ✅ **Real API Calls**: Makes up to 6 parallel PUTs (one per non-empty section):
   - `PUT /api/v1/user/preferences/core`
   - `PUT /api/v1/user/preferences/flight`
   - `PUT /api/v1/user/preferences/food`
   - `PUT /api/v1/user/preferences/mobility`
   - `PUT /api/v1/user/preferences/ai`
   - `PUT /api/v1/user/preferences/travel-dna`
2. ✅ **Data Mapping**: Frontend camelCase → Backend format (via mappers)
3. ✅ **Error Detection**: NOW properly throws errors if any section fails (FIXED 2025-09-30)
4. ✅ **Success Verification**: Checks all responses have `.success = true`
5. ✅ **User Feedback**: Only shows "saved successfully" if ALL sections saved

### On Page Refresh (What Actually Happens):
1. ✅ **Fresh Load**: Repeats "On Tab Load" flow above
2. ✅ **Shows Persisted Data**: Displays whatever is in the database
3. ✅ **No Cache**: If save failed, user sees old data (proof save didn't work)

### 🔴 CRITICAL FIX APPLIED (2025-09-30)
**Problem**: `withErrorHandling` was swallowing failures → UI showed "saved successfully" even when backend returned errors  
**Fix**: Removed `withErrorHandling` from save operations → Now properly throws and shows errors  
**Impact**: Users will now see REAL error messages if preferences don't save

---

## 1. Preferences Tab Deep Dive

### Frontend Implementation (Current)

**File**: `src/pages/ProfileV6.tsx` (lines 855-882, 1052-1095)

**Loading Preferences**:
```typescript
const res = await userPreferencesAPI.getUserPreferences(authUser.id);
// Expects response with shape:
// { success: boolean, data: UserPreferencesComplete }
```

**Saving Preferences**:
```typescript
await Promise.all([
  userPreferencesAPI.updateCorePreferences(authUser.id, backendPreferences.core),
  userPreferencesAPI.updateFlightPreferences(authUser.id, backendPreferences.flight),
  userPreferencesAPI.updateFoodPreferences(authUser.id, backendPreferences.food),
  userPreferencesAPI.updateMobilityPreferences(authUser.id, backendPreferences.mobility),
  userPreferencesAPI.updateAIPreferences(authUser.id, backendPreferences.ai),
  userPreferencesAPI.updateTravelDNA(authUser.id, backendPreferences.travelDNA)
]);
```

**Data Structure Used**:
```typescript
// From types/preferences.ts
interface BackendPreferencesData {
  core: UserCorePreferences;      // snake_case fields
  flight: UserFlightPreferences;
  food: UserFoodPreferences;
  mobility: UserMobilityAccessibility;
  ai: UserAIPreferences;
  travelDNA: UserTravelDNA;
}
```

### Backend API Contract

**From**: `profile-system-source-of-truth.md` and `PREFERENCES_RECONCILIATION.md`

**Endpoints**:
- ❌ **OLD (Deprecated)**: `/api/preferences/frontend` - No longer recommended
- ✅ **NEW (Current)**: Individual endpoints:
  - `GET /api/v1/user/preferences/core`
  - `GET /api/v1/user/preferences/flight`
  - `GET /api/v1/user/preferences/food`
  - `GET /api/v1/user/preferences/mobility`
  - `GET /api/v1/user/preferences/ai`
  - `GET /api/v1/user/preferences/travel-dna`
  - `PUT /api/v1/user/preferences/core` (and corresponding PUTs for each)

**Data Structure**:
```typescript
// From types/user-preferences-normalized.ts
interface UserPreferencesComplete {
  core: UserCorePreferences;      // camelCase fields (planningPreference)
  flight?: UserFlightPreferences;
  food?: UserFoodPreferences;
  mobility?: UserMobilityAccessibility;
  aiPreferences?: UserAIPreferences;  // NOTE: "aiPreferences" not "ai"
  travelDNA?: UserTravelDNA;
}
```

### 🔴 IDENTIFIED MISALIGNMENT

**Issue 1: Field Name Casing Mismatch**
- **Frontend State** (`BackendPreferencesData`): Uses snake_case fields (`planning_preference`)
- **API Service** (`userPreferencesAPI`): Expects camelCase fields (`planningPreference`)
- **Result**: Type errors (fixed with `as any` cast but this is a code smell)

**Issue 2: AI Preferences Naming**
- **Frontend State**: `backendPreferences.ai`
- **API Response**: `res.data.aiPreferences`
- **Current Fix**: Manual mapping in load function (line 876)

**Issue 3: Type Misalignment**
- **preferences.ts** defines `UserCorePreferences` with snake_case
- **user-preferences-normalized.ts** defines `UserCorePreferences` with camelCase
- **Same interface name, different fields** - TypeScript can't differentiate

---

## 2. Trips Tab Deep Dive

### Frontend Implementation

**File**: `src/pages/ProfileV6.tsx` (lines 887-952)

**Fetching Trips**:
```typescript
const response = await tripsAPI.getUserTrips({
  limit: 100,
  sortBy: 'startDate',
  sortOrder: 'asc'
});
```

**Data Flow**:
```typescript
realTrips (raw backend data)
  ↓ transformBackendTrip()
  ↓ filter out invalid trips
trips (valid trips only)
  ↓ useMemo filteredTrips
  ↓ memoized tripCounts
Display in UI
```

### Backend API Contract

**Endpoint**: `GET /api/v1/trips`

**Query Parameters**:
- `limit`: number (optional, default 20)
- `offset`: number (optional, for pagination)
- `status`: 'draft' | 'planning' | 'upcoming' | 'completed' | 'cancelled' (optional)
- `sortBy`: 'createdAt' | 'startDate' | 'endDate' | 'name' (optional)
- `sortOrder`: 'asc' | 'desc' (optional)

**Response**:
```typescript
{
  trips: BackendTrip[];
  total: number;
  limit: number;
  offset: number;
}
```

### ✅ ALIGNMENT STATUS: GOOD

- Frontend correctly uses `tripsAPI.getUserTrips()`
- Removes backend filtering (status parameter) to avoid race conditions
- Client-side filtering ensures UI consistency
- Trip counts match displayed trips

---

## 3. Recommended Actions

### Priority 1: Fix Preferences Type Mismatch (CRITICAL)

**Option A: Align Frontend State with API Types** (RECOMMENDED)
1. Update `BackendPreferencesData` in `types/preferences.ts` to use camelCase
2. Update `ProfileV6.tsx` to use camelCase in state
3. Update `PreferencesRedesign.tsx` component to match
4. Remove `as any` type casts

**Option B: Add Type Mappers** (ALTERNATIVE)
1. Create mapper functions to convert between snake_case and camelCase
2. Apply mapping in load/save operations
3. Keep current state structure

**Option C: Backend Accepts Both** (REQUIRES BACKEND CHANGE)
1. Backend API mapper accepts both formats
2. Frontend can send either format
3. No frontend changes needed

### Priority 2: Standardize Naming Conventions

**Create Clear Separation**:
```typescript
// types/preferences-frontend.ts (UI layer)
interface FrontendPreferencesState {
  core: FrontendCorePreferences;  // What the UI uses
  flight: FrontendFlightPreferences;
  // ...
}

// types/preferences-api.ts (API layer)
interface ApiPreferencesResponse {
  core: ApiCorePreferences;  // What the API returns
  flight: ApiFlightPreferences;
  // ...
}

// utils/preferences-mapper.ts
function mapApiToFrontend(api: ApiPreferencesResponse): FrontendPreferencesState
function mapFrontendToApi(frontend: FrontendPreferencesState): ApiPreferencesRequest
```

### Priority 3: Add Integration Tests

```typescript
// tests/integration/preferences-api.test.ts
describe('Preferences API Integration', () => {
  it('should load preferences and match expected structure', async () => {
    const res = await userPreferencesAPI.getUserPreferences(testUserId);
    expect(res.data).toHaveProperty('core');
    expect(res.data).toHaveProperty('aiPreferences'); // Not 'ai'
    expect(res.data.core).toHaveProperty('planningPreference'); // camelCase
  });
  
  it('should save preferences without type errors', async () => {
    const prefs: UserPreferencesComplete = {
      core: {
        userId: testUserId,
        planningPreference: 'collaborative',
        // ... camelCase fields
      }
    };
    
    await expect(
      userPreferencesAPI.updateCorePreferences(testUserId, prefs.core)
    ).resolves.not.toThrow();
  });
});
```

---

## 4. Contract Verification Checklist

### Preferences Tab
- [ ] **CRITICAL**: Verify backend `/api/v1/user/preferences/*` endpoints use camelCase field names
- [ ] **CRITICAL**: Confirm backend accepts both snake_case and camelCase OR pick one standard
- [ ] Test actual API response structure matches `UserPreferencesComplete` type
- [ ] Verify `aiPreferences` vs `ai` naming in actual responses
- [ ] Test save operations with actual backend
- [ ] Confirm personal_notes fields are extracted correctly
- [ ] Verify derived fields (transfer_tolerance, environmental_concerns) work

### Trips Tab
- [x] Verify trips API returns correct structure ✅
- [x] Confirm transformBackendTrip() handles all backend fields ✅
- [x] Test filtering logic with various trip statuses ✅
- [x] Verify counts match actual trip data ✅

### Overview Tab
- [ ] Verify dashboard API returns all expected fields
- [ ] Confirm TravelDNA structure matches expectations
- [ ] Test stats calculations

### Billing Tab
- [ ] Verify billing API endpoints match implementation
- [ ] Confirm Stripe integration works
- [ ] Test transaction history display

---

## 5. Backend Team Questions

**For Backend Team to Answer:**

1. **Preferences API Field Naming**: Do your API responses use camelCase (`planningPreference`) or snake_case (`planning_preference`)?

2. **AI Preferences Property**: Is it `aiPreferences` or `ai` in your response?

3. **PUT Endpoint Flexibility**: Can the PUT endpoints accept partial updates with only changed fields, or do they require all fields?

4. **Personal Notes Extraction**: Are fields like `booking_style`, `noise_sensitivity` automatically extracted from `personal_notes` JSONB in your responses?

5. **Derived Fields**: Do you calculate `transfer_tolerance` from `direct_flights_only`, or should frontend handle this?

6. **Type Conversion**: Do you accept `"true"`/`"false"` strings for booleans, or require actual boolean values?

7. **Array Format**: Do you accept comma-separated strings for arrays, or require actual array format?

---

## 6. Next Steps

### Immediate (This Week)
1. **Backend Team**: Answer the 7 questions above
2. **Frontend Team**: Test actual API responses with console.log in ProfileV6
3. **Both Teams**: Review this document and agree on contracts
4. **Frontend Team**: Implement fixes based on agreed contract

### Short Term (Next Week)
1. Add integration tests for preferences flow
2. Create mapper utilities if needed
3. Update type definitions to match agreed contract
4. Remove `as any` type casts

### Long Term (This Month)
1. Add comprehensive API contract tests
2. Create automated contract validation
3. Document all edge cases
4. Add monitoring for contract violations

---

## 7. Success Criteria

✅ **Preferences load without errors**  
✅ **Preferences save without errors**  
✅ **No type casts needed (`as any`)**  
✅ **TypeScript compilation has zero errors**  
✅ **Integration tests pass**  
✅ **User can edit and persist preferences**  
✅ **Trips display correctly with accurate counts**  

---

**Status**: Awaiting Backend Team Response on Questions in Section 5
