# GET /itinerary Response - Source of Truth

**Last Updated**: 2026-01-13
**Status**: Production Reality
**Commit**: 45a855c4 (Schema Fix)

---

## CRITICAL: Where Frontend Finds the Data

### Response Structure (EXACT)

```typescript
GET /api/v1/trips/:tripId/itinerary

Response (200 OK):
{
  success: true,
  preventedRegeneration: boolean,
  status: "ready" | "not_started" | "queued" | "running" | "failed",
  destination: string,              // e.g., "London"
  title: string,                    // e.g., "London - 15 Days"
  itineraryId: string,              // UUID
  totalDays: number,                // e.g., 15
  itinerary: {                      // ← THE DATA IS HERE
    days: Array<{                   // ← DAYS ARRAY IS HERE
      // ✅ NEW (as of 2026-01-13, commit 45a855c4):
      id: string,                   // Stable ID: "{tripId}-day-{dayNumber}"
      tripId: string,               // Trip UUID reference

      // Core fields:
      dayNumber: number,            // 1, 2, 3, ...
      date: string,                 // "YYYY-MM-DD"
      title: string,                // "Arrival & Iconic Landmarks"
      description?: string,         // Optional

      // Day metadata:
      theme?: string,               // "Historic Paris"
      totalEstimatedCost?: number,  // 245.50
      mealsIncluded?: number,       // 3
      pacingLevel?: "relaxed" | "moderate" | "packed",

      // Activities:
      activities: Array<{
        // ✅ NEW: Stable ID (as of 2026-01-13):
        id: string,                 // "{tripId}-day{dayNumber}-act{index}"

        // Core fields:
        title: string,
        description: string,

        // Timing:
        time: string,               // "9:00 AM" (display format)
        startTime: string,          // "09:00" (24-hour format)
        endTime: string,            // "11:30"
        duration: string,           // "2h 30min"

        // Classification:
        type: string,               // "sightseeing", "dining", etc.

        // Cost:
        cost: number,               // Simple number for display
        estimatedCost?: {           // Detailed cost object
          amount: number,
          currency: string
        },

        // Location:
        location: {
          name: string,
          address: string,
          coordinates?: {
            lat: number,
            lng: number
          }
        },

        // Tags and metadata:
        tags: string[],             // ["iconic", "must-see"]
        bookingRequired?: boolean,
        bookingUrl?: string,

        // Enriched data (optional):
        rating?: number,            // 4.7
        images?: string[],          // Array of URLs

        // Recommendation data (optional):
        matchScore?: number,        // 0-100
        whyRecommended?: string,    // "Recommended for: highly rated..."

        // Transportation (optional):
        transportation?: {
          method: string,
          duration: string,
          estimatedCost: {
            amount: number,
            currency: string
          },
          instructions: string
        }
      }>
    }>,

    // Optional overview (may not be present):
    overview?: {
      highlights: string[],
      localTips: string[],
      budgetBreakdown: {
        accommodations: number,
        activities: number,
        food: number,
        transportation: number,
        total: number
      },
      bestTimeToVisit?: string,
      language?: string,
      transportationTips?: string,
      culturalTips?: string
    }
  }
}
```

---

## Frontend Access Path

### Using Axios

```typescript
const response = await axios.get(`/api/v1/trips/${tripId}/itinerary`);

// STEP 1: Check status field
if (response.data.status !== "ready") {
  // Handle not ready states
  return;
}

// STEP 2: Access the days array
const days = response.data.itinerary.days; // ← THIS IS THE PATH

// STEP 3: Use the data
console.log("Days count:", days.length); // 15
console.log("First day ID:", days[0].id); // "70f76ed9-...-day-1"
console.log("First day tripId:", days[0].tripId); // "70f76ed9-..."
```

### Using Fetch

```typescript
const response = await fetch(`/api/v1/trips/${tripId}/itinerary`);
const data = await response.json();

if (data.status === "ready") {
  const days = data.itinerary.days; // ← THIS IS THE PATH
}
```

---

## Schema Fix (Commit 45a855c4)

### What Changed on 2026-01-13

**Problem**: Frontend expected `id` and `tripId` fields on day objects that backend wasn't sending.

**Fix**: Backend now generates these fields:

1. **Day IDs** (stable, deterministic):
   - Format: `{tripId}-day-{dayNumber}`
   - Example: `"70f76ed9-cda0-40a9-b561-e2001fbc7d99-day-1"`
   - Stable across requests

2. **Day tripId** (reference field):
   - Value: The trip's UUID
   - Example: `"70f76ed9-cda0-40a9-b561-e2001fbc7d99"`

3. **Activity IDs** (stable, deterministic):
   - Old: `activity-${Date.now()}-${Math.random()}` (changed every request!)
   - New: `{tripId}-day{dayNumber}-act{index}`
   - Example: `"70f76ed9-...-day1-act0"`
   - Stable across requests

### Before vs After

**Before (missing fields)**:

```json
{
  "itinerary": {
    "days": [{
      "dayNumber": 1,
      "date": "2025-11-09",
      "title": "Arrival Day",
      "activities": [...]
      // ❌ NO "id" field
      // ❌ NO "tripId" field
    }]
  }
}
```

**After (with schema fix)**:

```json
{
  "itinerary": {
    "days": [{
      "id": "70f76ed9-cda0-40a9-b561-e2001fbc7d99-day-1",  // ✅ Added
      "tripId": "70f76ed9-cda0-40a9-b561-e2001fbc7d99",    // ✅ Added
      "dayNumber": 1,
      "date": "2025-11-09",
      "title": "Arrival Day",
      "activities": [{
        "id": "70f76ed9-...-day1-act0",  // ✅ Now stable
        "title": "...",
        ...
      }]
    }]
  }
}
```

---

## Backend Implementation

### Data Source: itinerary_frontend_ready Table

The backend uses a dedicated table for frontend-optimized data:

**File**: `src/db/schema/itineraryFrontendReady.ts`

```typescript
export const itineraryFrontendReady = pgTable("itinerary_frontend_ready", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .unique()
    .references(() => trip.id),

  // The complete itinerary in frontend format (JSONB):
  itineraryData: jsonb("itinerary_data").notNull(),

  // Metadata:
  parserVersion: varchar("parser_version", { length: 20 }),
  generatorVersion: varchar("generator_version", { length: 20 }),
  totalDays: integer("total_days").notNull(),
  totalActivities: integer("total_activities").notNull(),

  // Timestamps:
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Parser warnings:
  parserWarnings: jsonb("parser_warnings"),
});
```

### Data Transformation

**File**: `src/services/itinerary-frontend-adapter.ts`

The `ItineraryFrontendAdapter` service transforms enriched itinerary data into the exact format frontend expects:

```typescript
// Generate stable day ID
id: `${tripId}-day-${day.dayNumber}`;

// Add trip reference
tripId: tripId;

// Generate stable activity ID
id: `${tripId}-day${dayNumber}-act${activityIndex}`;
```

### GET Endpoint Flow

**File**: `src/routes/itinerary.ts` (lines 360-386)

```typescript
// 1. Fetch from frontend-ready table
const frontendData = await itineraryFrontendAdapter.getFrontendReady(tripId);

// 2. Return response
return reply.code(200).send({
  success: true,
  preventedRegeneration: true,
  status: "ready",
  destination: tripData.destination,
  title: `${tripData.name || tripData.destination} - ${tripData.totalDays} Days`,
  itineraryId: tripCheck.itineraryId,
  totalDays: frontendData.days.length,
  itinerary: frontendData, // ← Direct use, zero transformation!
});
```

---

## Frontend Integration Guide

### Step 1: Make API Call

```typescript
import { api } from "@/lib/api";

const { data } = await api.get(`/trips/${tripId}/itinerary`);
```

### Step 2: Check Status

```typescript
if (data.status !== "ready") {
  // Handle other states
  switch (data.status) {
    case "not_started":
      // Show "Generate Itinerary" button
      break;
    case "queued":
    case "running":
      // Show loading with progress
      break;
    case "failed":
      // Show error with retry option
      break;
  }
  return;
}
```

### Step 3: Access Data

```typescript
// The days are at: data.itinerary.days
const days = data.itinerary.days;

// Each day now has stable IDs
days.forEach((day) => {
  console.log(day.id); // "tripId-day-1"
  console.log(day.tripId); // "tripId"
  console.log(day.dayNumber); // 1

  day.activities.forEach((activity) => {
    console.log(activity.id); // "tripId-day1-act0" (stable!)
  });
});
```

### Step 4: TypeScript Types

```typescript
interface ItineraryResponse {
  success: boolean;
  preventedRegeneration?: boolean;
  status: "ready" | "not_started" | "queued" | "running" | "failed";
  destination: string;
  title: string;
  itineraryId: string;
  totalDays: number;
  itinerary: {
    days: Day[];
    overview?: Overview;
  };
}

interface Day {
  id: string; // ✅ Now present
  tripId: string; // ✅ Now present
  dayNumber: number;
  date: string;
  title: string;
  description?: string;
  theme?: string;
  totalEstimatedCost?: number;
  mealsIncluded?: number;
  pacingLevel?: "relaxed" | "moderate" | "packed";
  activities: Activity[];
}

interface Activity {
  id: string; // ✅ Now stable
  title: string;
  description: string;
  time: string;
  startTime?: string;
  endTime?: string;
  duration: string;
  type: string;
  cost: number;
  estimatedCost?: { amount: number; currency: string };
  location: {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
  };
  tags: string[];
  bookingRequired?: boolean;
  bookingUrl?: string;
  rating?: number;
  images?: string[];
  matchScore?: number;
  whyRecommended?: string;
  transportation?: {
    method: string;
    duration: string;
    estimatedCost: { amount: number; currency: string };
    instructions: string;
  };
}
```

---

## Debugging in Browser Console

```javascript
// After fetching itinerary:
const { data } = await api.get("/trips/YOUR_TRIP_ID/itinerary");

// Check response structure
console.log("Status:", data.status); // "ready"
console.log("Has itinerary:", !!data.itinerary); // true
console.log("Has days:", !!data.itinerary?.days); // true
console.log("Days length:", data.itinerary?.days?.length); // 15

// Check first day
const firstDay = data.itinerary.days[0];
console.log("First day:", firstDay);
console.log("Has id:", "id" in firstDay); // true ✅
console.log("Has tripId:", "tripId" in firstDay); // true ✅
console.log("ID value:", firstDay.id); // "tripId-day-1"
console.log("tripId value:", firstDay.tripId); // "tripId"

// Check first activity
const firstActivity = firstDay.activities[0];
console.log("Activity ID:", firstActivity.id); // "tripId-day1-act0" ✅
```

---

## Common Errors and Solutions

### Error: "Cannot read property 'days' of undefined"

**Cause**: Accessing `data.days` instead of `data.itinerary.days`

**Fix**:

```typescript
// ❌ WRONG
const days = data.days;

// ✅ CORRECT
const days = data.itinerary.days;
```

### Error: "Property 'id' does not exist on type 'Day'"

**Cause**: TypeScript types not updated to include new fields

**Fix**: Update your TypeScript interfaces to match the schema above.

### Error: "Days array is empty but status is 'ready'"

**Cause**: Data corruption or backend issue

**Fix**: Check Railway logs for errors, verify data in database.

---

## Production Verification

### How to Verify Schema Fix is Deployed

Use the verification script:

```bash
JWT_TOKEN="your-token" bash scripts/verify-schema-fix.sh
```

Expected output:

```
✅ Day objects now have required ID fields!
  • day.id value: 70f76ed9-...-day-1
  • day.tripId value: 70f76ed9-...

✅ Activity ID uses stable format (tripId-dayN-actN)

✅ SCHEMA FIX DEPLOYED AND WORKING!
```

---

## Status Values

| Status        | Meaning                          | Frontend Action            |
| ------------- | -------------------------------- | -------------------------- |
| `ready`       | Itinerary complete and available | Display itinerary          |
| `not_started` | Never generated                  | Show "Generate" button     |
| `queued`      | Waiting in job queue             | Show loading spinner       |
| `running`     | Actively generating              | Show loading with progress |
| `failed`      | Generation failed                | Show error + retry option  |

---

## Related Files

### Backend

- Response builder: `src/routes/itinerary.ts` (lines 360-386)
- Data transformer: `src/services/itinerary-frontend-adapter.ts`
- Schema definition: `src/db/schema/itineraryFrontendReady.ts`

### Frontend

- API integration: Check your API client implementation
- Type definitions: Update to match schema above

---

## Change Log

### 2026-01-13: Schema Fix (Commit 45a855c4)

- **Added**: `day.id` field (stable, deterministic)
- **Added**: `day.tripId` field (trip reference)
- **Changed**: `activity.id` from random to stable format
- **Impact**: Frontend can now track days and activities across requests

### 2025-12-14: Initial Documentation

- Documented existing response structure
- Identified missing `id` and `tripId` fields as issue

---

**AUTHORITATIVE STATUS**: ✅ **CURRENT AS OF 2026-01-13**

This document describes the response structure as of commit `45a855c4` which adds the required ID fields.

**Verification Script**: `scripts/verify-schema-fix.sh`
**Deployment**: Railway auto-deploys from main branch
