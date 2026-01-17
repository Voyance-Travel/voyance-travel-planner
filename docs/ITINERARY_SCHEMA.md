# Itinerary Schema - Source of Truth

## Overview
This document defines the exact schema that the frontend itinerary page expects, what each field means, and why it exists for the user.

## Trip Summary Section

### `destination`
- **Type**: `string`
- **Example**: "London"
- **Purpose**: Shows the user where their trip is taking place
- **Required**: Yes

### `startDate` / `endDate`
- **Type**: `string` (ISO date format)
- **Example**: "2025-11-09"
- **Purpose**: Shows the user the duration of their trip and helps with calendar planning
- **Required**: Yes

### `travelers`
- **Type**: `number`
- **Example**: 2
- **Purpose**: Helps user verify the trip is planned for the correct number of people
- **Required**: Yes

### `totalCost`
- **Type**: `number`
- **Example**: 2500
- **Purpose**: Shows estimated total budget for the trip
- **Required**: No (defaults to sum of activities)

## Day Structure

### `dayNumber`
- **Type**: `number`
- **Example**: 1
- **Purpose**: Sequential ordering of days in the itinerary
- **Required**: Yes

### `date`
- **Type**: `string` (ISO date format)
- **Example**: "2025-11-09"
- **Purpose**: Actual calendar date for this day of the trip
- **Required**: Yes

### `theme`
- **Type**: `string`
- **Example**: "Arrival and City Orientation"
- **Purpose**: High-level summary of what this day is about
- **Required**: No (defaults to "Day X")

### `description`
- **Type**: `string`
- **Example**: "Arrive in London and get settled into your hotel. Light exploration of the neighborhood."
- **Purpose**: Brief overview of the day's plan
- **Required**: No

### `weather`
- **Type**: `object`
- **Structure**: 
  ```typescript
  {
    high: number;        // Temperature in Fahrenheit
    low: number;         // Temperature in Fahrenheit
    condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy';
    description: string; // "Perfect weather for sightseeing"
  }
  ```
- **Purpose**: Helps user plan appropriate clothing and activities
- **Required**: No

### `estimatedWalkingTime`
- **Type**: `string`
- **Example**: "2-3 hours"
- **Purpose**: Helps user understand physical activity level for the day
- **Required**: No

### `estimatedDistance`
- **Type**: `string`
- **Example**: "5-7 miles"
- **Purpose**: Helps user gauge how much ground they'll cover
- **Required**: No

### `totalCost`
- **Type**: `number`
- **Example**: 150
- **Purpose**: Daily budget estimate
- **Required**: No

## Activity Structure (The Core of Each Day)

### `id`
- **Type**: `string`
- **Example**: "act-123-456"
- **Purpose**: Unique identifier for updates/edits
- **Required**: Yes

### `title`
- **Type**: `string`
- **Example**: "British Museum Visit"
- **Purpose**: Quick identification of what the activity is
- **Required**: Yes

### `time`
- **Type**: `string`
- **Example**: "9:00 AM" or "09:00"
- **Purpose**: When the activity starts
- **Required**: Yes

### `startTime` / `endTime`
- **Type**: `string` (24-hour format)
- **Example**: "09:00", "11:30"
- **Purpose**: Precise timing for the activity
- **Required**: startTime is required

### `duration`
- **Type**: `string`
- **Example**: "2h 30m"
- **Purpose**: How long the activity takes
- **Required**: No (calculated from start/end)

### `type`
- **Type**: `ActivityType` enum
- **Values**: 
  - `'dining'` - Restaurant, cafe, food experience
  - `'activity'` - General activity
  - `'transport'` - Transportation between locations
  - `'accommodation'` - Hotel check-in/out
  - `'attraction'` - Museums, landmarks, sights
  - `'shopping'` - Markets, stores
  - `'restaurant'` - Specific dining experiences
- **Purpose**: Visual categorization and filtering
- **Required**: Yes

### `description`
- **Type**: `string`
- **Example**: "Explore one of the world's greatest museums with collections from ancient civilizations"
- **Purpose**: Detailed information about what the user will do/see
- **Required**: Yes

### `location`
- **Type**: `object`
- **Structure**:
  ```typescript
  {
    name: string;        // "British Museum"
    address?: string;    // "Great Russell St, London WC1B 3DG"
    coordinates?: {      // For mapping
      lat: number;
      lng: number;
    }
  }
  ```
- **Purpose**: Where the activity takes place
- **Required**: Yes (at least name)

### `cost`
- **Type**: `number`
- **Example**: 0 (British Museum is free)
- **Purpose**: Individual activity cost for budgeting
- **Required**: No (defaults to 0)

### `estimatedCost`
- **Type**: `object`
- **Structure**:
  ```typescript
  {
    amount: number;
    currency: string;  // "USD", "GBP", etc
  }
  ```
- **Purpose**: More detailed cost information with currency
- **Required**: No

### `transportation`
- **Type**: `object`
- **Structure**:
  ```typescript
  {
    method: string;       // "Underground"
    line?: string;        // "Piccadilly Line"
    station?: string;     // "Russell Square"
    duration: string;     // "15 minutes"
    instructions: string; // "Take Piccadilly Line to Russell Square, 5 min walk"
    cost?: number;        // 2.80
  }
  ```
- **Purpose**: How to get to this activity from previous location
- **Required**: No

### `rating`
- **Type**: `number`
- **Example**: 4.7
- **Purpose**: Quality indicator from reviews
- **Required**: No

### `tags`
- **Type**: `string[]`
- **Example**: ["history", "culture", "free-entry"]
- **Purpose**: Quick categorization and user preferences matching
- **Required**: Yes (can be empty array)

### `bookingRequired`
- **Type**: `boolean`
- **Example**: true
- **Purpose**: Alert user if advance booking needed
- **Required**: No

### `bookingUrl`
- **Type**: `string`
- **Example**: "https://britishmuseum.org/tickets"
- **Purpose**: Direct link to make reservations
- **Required**: No

### `notes`
- **Type**: `string`
- **Example**: "Free entry but donation suggested. Very crowded on weekends."
- **Purpose**: Helpful tips specific to this activity
- **Required**: No

### `matchScore`
- **Type**: `number` (0-100)
- **Example**: 95
- **Purpose**: How well this matches user's preferences
- **Required**: No

### `whyRecommended`
- **Type**: `string`
- **Example**: "Based on your interest in history and culture"
- **Purpose**: Personalization explanation
- **Required**: No

## Additional Top-Level Itinerary Fields

### `budgetBreakdown`
- **Type**: `object`
- **Structure**:
  ```typescript
  {
    accommodations: number;
    activities: number;
    food: number;
    transportation: number;
    other: number;
    total: number;
  }
  ```
- **Purpose**: Help user understand where money is being spent
- **Required**: No

### `transportation`
- **Type**: `object`
- **Purpose**: Overall trip transportation recommendations
- **Required**: No

### `highlights`
- **Type**: `string[]`
- **Example**: ["See the Crown Jewels", "Ride the London Eye", "West End show"]
- **Purpose**: Quick preview of trip's best moments
- **Required**: No

### `localTips`
- **Type**: `string[]`
- **Example**: ["Oyster card for public transport", "Tipping 10-15% at restaurants"]
- **Purpose**: Practical advice for the destination
- **Required**: No

## Visual Hierarchy

The UI displays this data in the following hierarchy:

1. **Trip Header**: Destination, dates, travelers
2. **Overview Cards**: Budget, highlights, tips
3. **Day Blocks**: 
   - Day header (number, date, theme)
   - Weather widget
   - Walking time/distance
   - Activities list in chronological order
4. **Each Activity**:
   - Time block
   - Title and type icon
   - Description
   - Location and transportation
   - Cost and booking info
   - Action buttons (edit, lock, alternatives)