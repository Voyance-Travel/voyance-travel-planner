# Itinerary Parsing Rules - Source of Truth

## Overview
This document defines how we transform raw itinerary text from the backend into the structured schema that the frontend expects.

## Backend Raw Data Structure

The backend sends:
```json
{
  "days": [
    {
      "dayNumber": 1,
      "date": "2025-11-09",
      "title": "Day 1",
      "description": "9:00 AM - Arrive at Heathrow Airport...\n10:30 AM - Clear customs...",
      "activities": []  // Often empty, with data in description
    }
  ]
}
```

## Parsing Rules

### 1. Time Pattern Detection

We look for these patterns in order of priority:

#### Pattern 1: Time Range
```
9:00 AM - 10:30 AM - Activity description
```
- Extract: startTime="09:00", endTime="10:30"

#### Pattern 2: Single Time with AM/PM
```
9:00 AM - Activity description
```
- Extract: startTime="09:00"
- endTime = startTime of next activity OR +2 hours

#### Pattern 3: 24-Hour Format
```
14:00 - Activity description
```
- Extract: startTime="14:00"

#### Pattern 4: Hour Only
```
9 AM - Activity description
```
- Extract: startTime="09:00"

### 2. Activity Title Extraction

The title is extracted as:
1. Text after the time pattern
2. Up to the first comma, period, or dash
3. Maximum 60 characters

Example:
```
Input: "9:00 AM - Visit British Museum - One of the world's greatest museums"
Title: "Visit British Museum"
Description: "Visit British Museum - One of the world's greatest museums"
```

### 3. Activity Type Determination

Based on keyword matching (case-insensitive):

| Keywords | Type |
|----------|------|
| flight, airport, train, bus, taxi, uber | `transport` |
| breakfast, lunch, dinner, brunch, restaurant, cafe | `restaurant` |
| hotel, check-in, check-out | `accommodation` |
| museum, gallery, church, palace, castle | `attraction` |
| shop, market, store, mall | `shopping` |
| tour, guide | `activity` |
| Default (no match) | `activity` |

### 4. Location Extraction

We look for these patterns:
1. "at [Location]" → Location
2. "in [Location]" → Location
3. "near [Location]" → Location
4. "to [Location]" → Location
5. Capitalized words (likely place names)

Example:
```
Input: "Visit British Museum at Great Russell Street"
Location: "Great Russell Street"
```

### 5. Special Cases

#### Headers to Skip
- Lines starting with: Morning, Afternoon, Evening, Night
- Lines starting with: "Day X"
- Empty lines

#### Flexible Activities (No Time)
If a line contains activity-like content but no time:
- If it has bullet points (-, •, *)
- If it has numbers (1., 2., 3.)
- Assign default time based on position in day

### 6. Time Sequencing

After parsing all activities:
1. Sort by startTime
2. Fill missing endTimes with next activity's startTime
3. Last activity gets +2 hour default duration

### 7. Cost Extraction (Future Enhancement)

Look for patterns:
- "$XX" or "£XX" → Extract amount
- "Free" → cost = 0
- "Included" → cost = 0

## Example Transformation

### Input (Raw Backend)
```
9:00 AM - Arrive at Heathrow Airport
10:30 AM - Clear customs and immigration
11:30 AM - Take Heathrow Express to Paddington Station (£25)
12:30 PM - Check into The Zetter Townhouse near Paddington
2:00 PM - Lunch at Dishoom (Indian cuisine, ~£30 per person)
3:30 PM - Walk through Hyde Park
5:00 PM - Visit Victoria & Albert Museum (Free entry)
7:30 PM - Dinner at Borough Market
```

### Output (Structured Activities)
```json
[
  {
    "id": "day1-activity0-xxx",
    "title": "Arrive at Heathrow Airport",
    "time": "9:00 AM",
    "startTime": "09:00",
    "endTime": "10:30",
    "type": "transport",
    "description": "Arrive at Heathrow Airport",
    "location": { "name": "Heathrow Airport" }
  },
  {
    "id": "day1-activity1-xxx",
    "title": "Clear customs and immigration",
    "time": "10:30 AM",
    "startTime": "10:30",
    "endTime": "11:30",
    "type": "activity",
    "description": "Clear customs and immigration",
    "location": { "name": "Location" }
  },
  {
    "id": "day1-activity2-xxx",
    "title": "Take Heathrow Express to Paddington Station",
    "time": "11:30 AM",
    "startTime": "11:30",
    "endTime": "12:30",
    "type": "transport",
    "description": "Take Heathrow Express to Paddington Station (£25)",
    "location": { "name": "Paddington Station" },
    "estimatedCost": { "amount": 25, "currency": "GBP" }
  }
  // ... more activities
]
```

## Error Handling

1. **No time found**: Skip line or assign to "Additional Notes"
2. **Invalid time format**: Use "09:00" as default
3. **No activities found**: Return empty array (UI will show description)
4. **Malformed text**: Log warning and continue parsing

## Future Enhancements

1. **Multi-line activities**: Detect activities that span multiple lines
2. **Nested information**: Extract booking URLs, phone numbers
3. **Smart grouping**: Group related activities (e.g., "Morning: Multiple activities")
4. **Cost parsing**: Extract all currency formats
5. **Duration calculation**: Based on activity type (museums = 2h, meals = 1.5h)
6. **GPS extraction**: Parse "51.5194° N, 0.1270° W" format

## Testing Examples

The parser should handle these edge cases:

1. **No times**: "Visit British Museum" → Default to next available slot
2. **Military time**: "1400 - Lunch" → "14:00"
3. **Ranges**: "9-11 AM - Museum" → "09:00" to "11:00"
4. **Typos**: "9:00AM-Museum" (no space) → Still parse correctly
5. **Mixed formats**: Some activities with times, some without