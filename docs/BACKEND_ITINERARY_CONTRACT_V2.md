# Backend Itinerary Contract v2.0

## Overview
This document defines the **exact** data format the backend must send for the frontend to display itineraries correctly after the production fixes.

## Critical Changes from v1.0
1. **Field Names**: Use `title` and `type` (NOT `name` and `category`)
2. **Parsed Data**: Send structured activities, not raw text
3. **Consistent Format**: Same format for all responses (no variations)

## API Endpoints

### GET `/api/v1/trips/{tripId}/itinerary`

#### Response Status Codes
- `200 OK` - Itinerary exists (ready or generating)
- `404 Not Found` - No itinerary exists for this trip

#### Response Format

##### When No Itinerary Exists
```http
404 Not Found
```

##### When Generation In Progress
```json
{
  "status": "running",  // or "queued"
  "percentComplete": 45,
  "message": "Generating day 3 of 7..."
}
```

##### When Generation Failed
```json
{
  "status": "failed",
  "message": "Failed to generate itinerary: [specific error]"
}
```

##### When Itinerary Ready
```json
{
  "status": "ready",
  "destination": "London",
  "title": "London Adventure - 7 Days",
  "totalDays": 7,
  "days": [
    {
      "dayNumber": 1,
      "date": "2025-01-20",
      "theme": "Arrival & City Orientation",
      "description": "Arrive in London and get oriented with the city's iconic landmarks",
      "activities": [
        {
          "id": "act-day1-0-uuid",
          "title": "Heathrow Express to Paddington",     // ✅ NOT "name"
          "type": "transport",                          // ✅ NOT "category"
          "description": "Fast train from Heathrow Airport to central London",
          "time": "9:00 AM",
          "startTime": "09:00",
          "endTime": "09:30",
          "duration": "30 minutes",
          "cost": 25,
          "estimatedCost": {
            "amount": 25,
            "currency": "GBP"
          },
          "location": {
            "name": "Heathrow Express",
            "address": "Heathrow Airport Terminal 2-3, London",
            "coordinates": {
              "lat": 51.4700,
              "lng": -0.4543
            }
          },
          "tags": ["transport", "airport", "train"],
          "isLocked": false,
          "bookingRequired": true,
          "bookingUrl": "https://www.heathrowexpress.com",
          "transportation": {
            "method": "walk",
            "duration": "5 minutes",
            "instructions": "Follow signs to Heathrow Express platform"
          }
        },
        {
          "id": "act-day1-1-uuid",
          "title": "Hotel Check-in",
          "type": "accommodation",
          "description": "Check into your hotel and freshen up",
          "time": "10:00 AM",
          "startTime": "10:00",
          "endTime": "10:30",
          "duration": "30 minutes",
          "cost": 0,
          "location": {
            "name": "The Zetter Townhouse",
            "address": "28-30 Seymour St, London W1H 7JB",
            "coordinates": {
              "lat": 51.5147,
              "lng": -0.1611
            }
          },
          "tags": ["hotel", "check-in"],
          "isLocked": true,
          "transportation": {
            "method": "taxi",
            "duration": "20 minutes",
            "instructions": "Take taxi from Paddington Station",
            "cost": 15
          }
        },
        {
          "id": "act-day1-2-uuid",
          "title": "British Museum Visit",
          "type": "attraction",
          "description": "Explore one of the world's greatest museums with artifacts from global civilizations",
          "time": "2:00 PM",
          "startTime": "14:00",
          "endTime": "16:30",
          "duration": "2.5 hours",
          "cost": 0,
          "location": {
            "name": "British Museum",
            "address": "Great Russell St, London WC1B 3DG",
            "coordinates": {
              "lat": 51.5194,
              "lng": -0.1270
            }
          },
          "tags": ["museum", "history", "culture", "free-entry", "must-see"],
          "isLocked": false,
          "rating": 4.7,
          "matchScore": 95,
          "whyRecommended": "Perfect match for your interest in history and culture",
          "bookingRequired": false,
          "transportation": {
            "method": "subway",
            "line": "Piccadilly Line",
            "station": "Russell Square",
            "duration": "15 minutes",
            "instructions": "Take Piccadilly Line to Russell Square, 5 min walk",
            "cost": 2.80
          }
        }
      ],
      "weather": {
        "high": 62,
        "low": 48,
        "condition": "partly-cloudy",
        "description": "Mild with occasional clouds"
      },
      "totalCost": 40,
      "estimatedWalkingTime": "1.5 hours",
      "estimatedDistance": "3 miles"
    }
    // ... more days
  ],
  "budgetBreakdown": {
    "accommodations": 700,
    "activities": 250,
    "food": 420,
    "transportation": 180,
    "other": 50,
    "total": 1600
  },
  "highlights": [
    "See the Crown Jewels at Tower of London",
    "Experience a West End theatre show",
    "Traditional afternoon tea at Fortnum & Mason"
  ],
  "localTips": [
    "Get an Oyster Card for public transport",
    "Museums are free but donations appreciated",
    "Book restaurants in advance"
  ]
}
```

## Field Specifications

### Activity Fields

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | ✅ | Unique identifier | `"act-day1-0-uuid"` |
| `title` | string | ✅ | Activity name (NOT `name`) | `"British Museum Visit"` |
| `type` | string | ✅ | Activity type (NOT `category`) | `"attraction"` |
| `description` | string | ✅ | Detailed description | `"Explore world history..."` |
| `time` | string | ✅ | Display time | `"2:00 PM"` |
| `startTime` | string | ✅ | 24-hour start time | `"14:00"` |
| `endTime` | string | ✅ | 24-hour end time | `"16:30"` |
| `duration` | string | ✅ | Human-readable duration | `"2.5 hours"` |
| `cost` | number | ✅ | Activity cost | `25` |
| `location` | object | ✅ | Location details | See structure below |
| `tags` | string[] | ✅ | Activity tags | `["museum", "culture"]` |
| `isLocked` | boolean | ✅ | If activity is locked | `false` |

### Location Structure
```json
{
  "name": "British Museum",
  "address": "Great Russell St, London WC1B 3DG",
  "coordinates": {
    "lat": 51.5194,
    "lng": -0.1270
  }
}
```

### Valid Activity Types
- `transport`
- `accommodation`
- `attraction`
- `restaurant`
- `shopping`
- `activity`
- `outdoor`
- `cultural`
- `relaxation`

## Important Notes

### 1. **No Raw Text in Activities**
❌ **Wrong**:
```json
{
  "activities": [],
  "description": "9:00 AM - British Museum Visit..."
}
```

✅ **Correct**:
```json
{
  "activities": [
    {
      "title": "British Museum Visit",
      "time": "9:00 AM",
      // ... full structured data
    }
  ]
}
```

### 2. **Consistent Field Names**
❌ **Wrong**: `name`, `category`
✅ **Correct**: `title`, `type`

### 3. **Always Include Required Fields**
Every activity MUST have all required fields, even if some have default values.

### 4. **Coordinates Are Important**
Include lat/lng coordinates for all activities to enable map features.

### 5. **Transportation Between Activities**
Each activity (except the first) should include transportation details from the previous activity.

## Testing Checklist

Before deploying backend changes:

- [ ] All activities have `title` field (not `name`)
- [ ] All activities have `type` field (not `category`)
- [ ] All required fields are present
- [ ] No empty `activities` arrays with data in `description`
- [ ] Coordinates included for all locations
- [ ] Transportation details between activities
- [ ] Response matches exact schema above