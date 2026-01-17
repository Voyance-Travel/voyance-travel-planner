# Backend Integration Guide for Voyance Frontend

**Date**: 2026-01-17  
**Contract Version**: v1 (schemaVersion: "v1")  
**Base URL**: `https://voyance-backend.railway.app`

---

## Quick Reference

### Authentication
```typescript
// All requests require Supabase JWT
Authorization: Bearer <supabase_jwt>
```

### Core Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/trips` | Create trip |
| GET | `/api/v1/trips` | List trips |
| GET | `/api/v1/trips/:id` | Get trip |
| PATCH | `/api/v1/trips/:id` | Update trip |
| DELETE | `/api/v1/trips/:id` | Delete trip |
| POST | `/api/v1/trips/:id/itinerary/generate-now` | Generate itinerary |
| GET | `/api/v1/trips/:id/itinerary` | Get itinerary/status |
| GET | `/api/v1/user/preferences` | Get preferences |
| POST | `/api/v1/user/preferences` | Save preferences |

---

## 1. User Preferences (5 Core Enums)

```typescript
type BudgetPreference = 'tight' | 'moderate' | 'flexible' | 'luxury';
type PacePreference = 'relaxed' | 'balanced' | 'packed';
type StylePreference = 'local' | 'tourist' | 'mixed';
type ComfortPreference = 'basic' | 'standard' | 'premium';
type PlanningPreference = 'structured' | 'flexible' | 'spontaneous';
```

**Defaults**: moderate, balanced, mixed, standard, flexible

---

## 2. Trip Creation

### Request
```typescript
POST /api/v1/trips
{
  "name": "London Adventure",      // REQUIRED
  "destination": "London",         // REQUIRED
  "startDate": "2026-06-01",       // Optional (YYYY-MM-DD)
  "endDate": "2026-06-15",         // Optional
  "totalDays": 15,                 // Optional (auto-calculated)
  "travelers": 2,                  // Optional (default: 1)
  "budgetRange": "moderate",       // Optional
  "emotionalTags": ["relaxing"],   // Optional
  "departureCity": "New York"      // Optional
}
```

### Response (201)
```typescript
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "London Adventure",
    "destination": "London",
    "status": "draft",
    "createdAt": "2026-01-17T10:00:00Z"
  }
}
```

---

## 3. Itinerary Generation

### Start Generation
```typescript
POST /api/v1/trips/:id/itinerary/generate-now
// Optional: ?force=true to regenerate
```

### Response (202 - Queued)
```typescript
{
  "success": true,
  "status": "queued",
  "schemaVersion": "v1",
  "tripId": "uuid",
  "progress": 0
}
```

### Poll for Status
```typescript
GET /api/v1/trips/:id/itinerary
// Poll every 3-5 seconds until status === "ready"
```

### Response (200 - Ready)
```typescript
{
  "success": true,
  "status": "ready",
  "schemaVersion": "v1",
  "tripId": "uuid",
  "destination": "London",
  "title": "London - 15 Days",
  "totalDays": 15,
  "itineraryId": "uuid",
  
  "days": [                    // ⚠️ AT ROOT LEVEL!
    {
      "dayNumber": 1,
      "date": "2026-06-01",
      "title": "Arrival Day",
      "theme": "Getting settled",
      "activities": [...]
    }
  ],
  
  "overview": {
    "budgetBreakdown": {...},
    "highlights": [...],
    "localTips": [...]
  }
}
```

### Status Values
- `not_started` - No generation initiated
- `queued` - Generation queued
- `running` - In progress
- `ready` - Complete ✅
- `failed` - Error occurred
- `empty` - Generated but no data

---

## 4. Frontend Integration Files

### API Client
`src/services/voyanceAPI.ts`
- Full typed API client
- Authentication handling
- Error handling
- Polling utilities

### React Query Hooks
`src/hooks/useVoyanceAPI.ts`
- `useTrips()` - List trips
- `useTrip(id)` - Get single trip
- `useCreateTrip()` - Create mutation
- `useUpdateTrip()` - Update mutation
- `useDeleteTrip()` - Delete mutation
- `useItinerary(tripId)` - Get itinerary
- `useGenerateItinerary()` - Generate with polling
- `usePreferences()` - Get preferences
- `useSavePreferences()` - Save preferences

---

## 5. Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Unauthorized | Redirect to login |
| 404 | Not found | Show not found message |
| 400 | Validation error | Show field errors |
| 500 | Server error | Show retry button |

---

## 6. Important Notes

1. **Days Array Location**: Always at ROOT level, not nested in `itinerary` object
2. **Schema Version**: Always check `schemaVersion === "v1"`
3. **Polling Timeout**: 5 minutes max for generation
4. **Required Fields**: Only `name` and `destination` for trip creation
5. **Auth Flow**: Backend auto-creates user from Supabase JWT
