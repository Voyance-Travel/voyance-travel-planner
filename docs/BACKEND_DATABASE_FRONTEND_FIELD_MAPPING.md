# Backend Database → API → Frontend Field Mapping

**Last Updated:** 2025-01-19
**Database:** Lovable Cloud (PostgreSQL via Supabase)
**Purpose:** Complete field mapping for itinerary data structure

> **Note**: This document was originally written for the Neon/Railway architecture. 
> The field mappings remain accurate - only the data access method has changed 
> (now using Supabase client instead of REST API).

---

## 📊 Database Schema (Lovable Cloud PostgreSQL)

### Table: `itinerary_frontend_ready`

Pre-computed itinerary data optimized for frontend consumption.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `trip_id` | `uuid` | Foreign key → `trips.id` |
| `itinerary_data` | `jsonb` | **Complete itinerary in frontend format** |
| `parser_version` | `varchar(20)` | Parser version (e.g., "2.0.0") |
| `generator_version` | `varchar(20)` | Generator version (e.g., "strict-1.0") |
| `total_days` | `integer` | Total number of days |
| `total_activities` | `integer` | Total number of activities |
| `generated_at` | `timestamp` | When itinerary was generated |
| `created_at` | `timestamp` | Record creation time |
| `updated_at` | `timestamp` | Last update time |
| `parser_warnings` | `jsonb` | Any warnings during parsing |

### Table: `trips`

Trip metadata and configuration.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `name` | `text` | Trip name |
| `destination` | `text` | Destination name (e.g., "London") |
| `start_date` | `date` | Trip start date |
| `end_date` | `date` | Trip end date |
| `total_days` | `integer` | Auto-calculated from dates |
| `metadata` | `jsonb` | Contains `preferences` object |
| `itinerary_id` | `uuid` | Links to itinerary |

---

## 🔄 Backend API Response Structure

### Endpoint: `GET /api/v1/trips/:tripId/itinerary`

**Status:** `ready` (itinerary exists)

```json
{
  "success": true,
  "status": "ready",
  "itinerary": {
    "title": "London - 15 Days",
    "destination": "London",
    "totalDays": 15,
    "generatedAt": "2025-12-20T10:00:00Z",
    "days": [ /* array of day objects */ ],
    "budgetBreakdown": { /* budget object */ },
    "highlights": [ /* array of strings */ ],
    "localTips": [ /* array of strings */ ],
    "personalizationFactors": { /* preferences object */ },
    "transportation": { /* optional */ },
    "accommodationRecommendations": [ /* optional */ ]
  }
}
```

---

## 🗺️ Complete Field Mapping

### Top-Level Response Fields

| Field Path | Type | Source | Required | Description |
|------------|------|--------|----------|-------------|
| `success` | `boolean` | Backend | ✅ | Always `true` for successful response |
| `status` | `string` | Backend | ✅ | `"ready"`, `"queued"`, `"running"`, `"failed"`, or `"not_started"` |

### Itinerary Object Fields

All fields inside the `itinerary` object when `status === "ready"`:

| Field Path | Type | Source | Required | Description |
|------------|------|--------|----------|-------------|
| `itinerary.title` | `string` | `trips.name` + `trips.total_days` | ✅ | Format: `"{name} - {days} Days"` |
| `itinerary.destination` | `string` | `trips.destination` | ✅ | Destination name (e.g., "London") |
| `itinerary.totalDays` | `number` | `trips.total_days` | ✅ | Total number of days in itinerary |
| `itinerary.generatedAt` | `string` (ISO 8601) | `itinerary_frontend_ready.generated_at` | ✅ | When itinerary was first generated |
| `itinerary.days` | `array` | `itinerary_frontend_ready.itinerary_data.days` | ✅ | Array of day objects |
| `itinerary.budgetBreakdown` | `object` | `itinerary_frontend_ready.itinerary_data.overview.budgetBreakdown` | ❓ | Budget summary (optional) |
| `itinerary.highlights` | `array<string>` | `itinerary_frontend_ready.itinerary_data.overview.highlights` | ❓ | Trip highlights (optional) |
| `itinerary.localTips` | `array<string>` | `itinerary_frontend_ready.itinerary_data.overview.localTips` | ❓ | Local tips (optional) |
| `itinerary.personalizationFactors` | `object` | `trips.metadata.preferences` | ✅ | User preferences/personalization |
| `itinerary.transportation` | `object` | `itinerary_frontend_ready.itinerary_data.overview.transportationTips` | ❓ | Transportation info (optional) |
| `itinerary.accommodationRecommendations` | `array` | Backend (currently empty) | ❓ | Accommodation suggestions (optional) |

---

## 📅 Day Object Structure

Each object in `itinerary.days[]`:

| Field Path | Type | Source | Required | Description |
|------------|------|--------|----------|-------------|
| `dayNumber` | `number` | `itinerary_data.days[].dayNumber` | ✅ | Day number (1-indexed) |
| `date` | `string` (YYYY-MM-DD) | `itinerary_data.days[].date` | ✅ | ISO date string |
| `title` | `string` | `itinerary_data.days[].title` | ✅ | Day title/theme |
| `description` | `string` | `itinerary_data.days[].description` | ❓ | Day description (optional) |
| `theme` | `string` | `itinerary_data.days[].theme` | ❓ | Day theme (optional) |
| `totalEstimatedCost` | `number` | `itinerary_data.days[].totalEstimatedCost` | ❓ | Total cost for day (optional) |
| `mealsIncluded` | `number` | `itinerary_data.days[].mealsIncluded` | ❓ | Number of meals (optional) |
| `pacingLevel` | `string` | `itinerary_data.days[].pacingLevel` | ❓ | "relaxed", "moderate", or "packed" (optional) |
| `activities` | `array` | `itinerary_data.days[].activities` | ✅ | Array of activity objects |

---

## 🎯 Activity Object Structure

Each object in `day.activities[]`:

### Core Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | `string` | ✅ | Unique activity ID |
| `title` | `string` | ✅ | Activity title (frontend primary display) |
| `description` | `string` | ✅ | Activity description |
| `type` | `string` | ✅ | Category: "sightseeing", "dining", "cultural", "shopping", "entertainment", "outdoor", "relaxation" |

### Timing Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| `time` | `string` | ✅ | Display time in 12-hour format (e.g., "10:00 AM") |
| `startTime` | `string` | ❓ | 24-hour format (e.g., "10:00") - optional |
| `endTime` | `string` | ❓ | 24-hour format (e.g., "11:30") - optional |
| `duration` | `string` | ✅ | Human-readable (e.g., "1h 30min", "2.5 hours") |

### Cost Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| `cost` | `number` | ✅ | Simple cost number for display |
| `estimatedCost` | `object` | ❓ | Detailed cost object (optional) |
| `estimatedCost.amount` | `number` | ❓ | Cost amount |
| `estimatedCost.currency` | `string` | ❓ | Currency code (e.g., "GBP", "USD") |

### Location Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| `location` | `object` | ✅ | Location information |
| `location.name` | `string` | ✅ | Venue/location name |
| `location.address` | `string` | ✅ | Full address |
| `location.coordinates` | `object` | ❓ | GPS coordinates (optional) |
| `location.coordinates.lat` | `number` | ❓ | Latitude |
| `location.coordinates.lng` | `number` | ❓ | Longitude |

### Metadata Fields

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| `tags` | `array<string>` | ✅ | Activity tags |
| `isLocked` | `boolean` | ✅ | Whether activity is locked (user-pinned) |
| `bookingRequired` | `boolean` | ❓ | Whether booking is required (optional) |
| `bookingUrl` | `string` | ❓ | URL for booking (optional) |

### Enrichment Fields (Optional)

| Field Path | Type | Required | Description |
|------------|------|----------|-------------|
| `rating` | `number` | ❓ | Rating score (e.g., 4.7 out of 5) |
| `images` | `array<string>` | ❓ | Array of image URLs |
| `matchScore` | `number` | ❓ | Match score 0-100 |
| `whyRecommended` | `string` | ❓ | Recommendation reason |
| `transportation` | `object` | ❓ | How to get there |
| `transportation.method` | `string` | ❓ | Transportation method |
| `transportation.duration` | `string` | ❓ | Travel duration |
| `transportation.estimatedCost` | `object` | ❓ | Travel cost |
| `transportation.instructions` | `string` | ❓ | Travel instructions |

---

## 💰 Budget Breakdown Object

Structure of `itinerary.budgetBreakdown`:

```typescript
{
  accommodations: number,
  activities: number,
  food: number,
  transportation: number,
  total: number
}
```

---

## 🎨 Personalization Factors Object

Structure of `itinerary.personalizationFactors`:

```typescript
{
  pace: string,           // "relaxed", "moderate", or "packed"
  interests: string[]     // Array of interest tags
}
```

**Backend Mapping:**
- `pace`: From `trips.metadata.preferences.pace` (default: "moderate")
- `interests`: Currently empty array (TODO: Extract from trip metadata)

---

## 📝 Database → Backend Transformation

### Step 1: Query Database

```sql
SELECT
  t.id as trip_id,
  t.name,
  t.destination,
  t.total_days,
  t.metadata,
  ifr.itinerary_data,
  ifr.generated_at
FROM trips t
JOIN itinerary_frontend_ready ifr ON ifr.trip_id = t.id
WHERE t.id = :tripId
```

### Step 2: Transform to Response

```typescript
const responsePayload = {
  success: true,
  status: "ready",
  itinerary: {
    // From trips table
    title: `${trip.name} - ${trip.total_days} Days`,
    destination: trip.destination,
    totalDays: trip.total_days,
    generatedAt: ifr.generated_at.toISOString(),

    // From itinerary_data JSONB
    days: ifr.itinerary_data.days,

    // Flatten overview fields to top level
    budgetBreakdown: ifr.itinerary_data.overview?.budgetBreakdown,
    highlights: ifr.itinerary_data.overview?.highlights,
    localTips: ifr.itinerary_data.overview?.localTips,

    // From trips.metadata.preferences
    personalizationFactors: {
      pace: trip.metadata.preferences?.pace || "moderate",
      interests: []  // TODO: Extract from metadata
    },

    // Optional fields
    transportation: {/* if transportationTips exist */},
    accommodationRecommendations: []
  }
}
```

---

## ⚠️ Important Notes for Frontend

### 1. **Status Field Location**
- `status` is at **TOP LEVEL** of response, NOT inside `itinerary`
- Check `response.data.status` to determine what to render

### 2. **Field Nesting**
- `title`, `destination`, `totalDays` are **INSIDE** `itinerary` object
- Do NOT expect these at top level

### 3. **Overview Fields Are Flattened**
- `budgetBreakdown`, `highlights`, `localTips` are at **top level** of `itinerary`
- They are NOT nested inside an `overview` object

### 4. **Field Name Changes**
- Backend uses `personalizationFactors` (NOT `preferences`)
- Activities use `type` field (which maps to backend `category`)

### 5. **Optional Fields**
- Fields marked with ❓ may be `undefined` or `null`
- Always check for existence before accessing

### 6. **Activity Images**
- Backend sends `images` array (NOT `photos`)
- Each element is a full URL string

---

## 🔍 Example: Complete Response

See actual production data for trip `70f76ed9-cda0-40a9-b561-e2001fbc7d99`:

```json
{
  "success": true,
  "status": "ready",
  "itinerary": {
    "title": "London Adventure - 15 Days",
    "destination": "London",
    "totalDays": 15,
    "generatedAt": "2025-12-20T10:00:00.000Z",
    "days": [
      {
        "dayNumber": 1,
        "date": "2025-11-09",
        "title": "Arrival & Explore Westminster",
        "theme": "Arrival & Explore Westminster",
        "activities": [
          {
            "id": "activity-1767465324377-0.7834442051498229",
            "title": "Visit the Houses of Parliament",
            "description": "Iconic Gothic architecture and the seat of UK politics; guided tours available.",
            "type": "sightseeing",
            "time": "10:00 AM",
            "startTime": "10:00",
            "endTime": "11:30",
            "duration": "1h 30min",
            "cost": 30,
            "estimatedCost": {
              "amount": 30,
              "currency": "GBP"
            },
            "location": {
              "name": "Houses of Parliament",
              "address": "Parliament Square, Westminster, London SW1A 0AA, UK",
              "coordinates": {
                "lat": 51.5010711,
                "lng": -0.1270599
              }
            },
            "tags": ["historical", "architecture", "guided-tour", "political"],
            "isLocked": false,
            "bookingRequired": true,
            "bookingUrl": "https://www.google.com/search?q=...",
            "matchScore": 100,
            "rating": null,
            "images": [
              "https://images.pexels.com/photos/27064529/pexels-photo-27064529.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
              "https://images.pexels.com/photos/3100710/pexels-photo-3100710.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
            ],
            "whyRecommended": "Recommended for: historical, architecture, popular attraction"
          }
        ]
      }
    ],
    "budgetBreakdown": {
      "accommodations": 1500,
      "activities": 800,
      "food": 600,
      "transportation": 300,
      "total": 3200
    },
    "highlights": [
      "Visit iconic landmarks like Big Ben and Tower Bridge",
      "Experience world-class museums",
      "Explore vibrant neighborhoods"
    ],
    "localTips": [
      "Use the Oyster card for public transport",
      "Book major attractions in advance",
      "Try traditional afternoon tea"
    ],
    "personalizationFactors": {
      "pace": "moderate",
      "interests": []
    },
    "accommodationRecommendations": []
  }
}
```

---

## 🚨 Common Pitfalls to Avoid

1. ❌ **Looking for `status` inside `itinerary`** → It's at top level
2. ❌ **Looking for `destination` at top level** → It's inside `itinerary`
3. ❌ **Looking for `overview.budgetBreakdown`** → It's `itinerary.budgetBreakdown`
4. ❌ **Using `preferences`** → Field is named `personalizationFactors`
5. ❌ **Expecting `success` field** → It exists but isn't required for logic

---

## 📚 Related Documentation

**Backend Repository:**
- Database schema definition: `src/db/schema/itineraryFrontendReady.ts`
- API endpoint implementation: `src/routes/itinerary.ts` (lines 821-864)
- Data transformation service: `src/services/itinerary-frontend-adapter.ts`

**Backend API Base URL:**
- Production: `https://voyance-backend-production.up.railway.app`

---

## 📞 Questions?

If you need clarification on any field mappings or discover mismatches between this documentation and actual responses, please:

1. Check the actual API response from Railway
2. Verify against the database using the trip ID
3. Update this document with corrections
4. Notify both frontend and backend teams

**Last Verified:** 2026-01-10 (Commit `09c22c4b`)
