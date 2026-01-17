# Current Parser Capabilities

## Overview
The current parser (`itineraryTextParser.ts`) extracts structured activity data from raw text descriptions.

## What It Currently Extracts

### 1. Time Information
- **Start Time**: Converts various formats to 24-hour
  - "9:00 AM" → "09:00"
  - "9 AM" → "09:00"
  - "14:00" → "14:00"
- **End Time**: 
  - From ranges: "9:00 AM - 10:30 AM" → endTime: "10:30"
  - Or calculated from next activity's start time
  - Last activity gets +2 hours default

### 2. Activity Title
- Extracts first phrase before comma, period, or dash
- Example: "Visit British Museum - One of the world's..." → "Visit British Museum"
- Maximum 60 characters (implied by regex)

### 3. Activity Type (via keyword matching)
```typescript
Transport: flight, train, bus, taxi, uber, drive, airport
Restaurant: breakfast, lunch, dinner, brunch, restaurant, cafe, food
Accommodation: hotel, check-in, check-out
Attraction: museum, gallery, theatre, church, palace, castle
Shopping: shop, market, store, mall
Activity: tour, guide, walking tour
Default: 'activity' if no match
```

### 4. Location Name
- Patterns detected:
  - "at [Location]" → Location
  - "in [Location]" → Location
  - "near [Location]" → Location
  - "to/from [Location]" → Location
  - Capitalized words as fallback
- Default: "Location" if nothing found

### 5. Basic Structure
```typescript
{
  id: "day1-activity0-[timestamp]",
  name: "Activity Title",          // Same as title
  title: "Activity Title",         
  description: "Full line text",   // Entire activity description
  startTime: "09:00",             // 24-hour format
  endTime: "10:30",               // 24-hour format or undefined
  category: "attraction",         // Same as type
  type: "attraction",             // From keyword matching
  location: "British Museum",     // Extracted name only
  estimatedCost: {
    amount: 0,                    // Always 0
    currency: "USD"               // Always USD
  },
  tags: []                        // Always empty
}
```

## What It Does NOT Extract

### 1. Cost Information
- Pattern exists in regex but NOT implemented
- All costs default to 0
- No currency detection beyond default USD

### 2. Location Details
- No address extraction
- No coordinates
- No neighborhood/district info

### 3. Duration
- Not explicitly extracted (only calculated via endTime - startTime)
- No parsing of "2 hours", "90 minutes", etc.

### 4. Rich Information
- No booking URLs
- No phone numbers
- No email addresses
- No opening hours
- No tips or special notes

### 5. Transportation Between Activities
- No "how to get there" information
- No transit details
- No walking directions

### 6. Activity Metadata
- No tags generation
- No categorization beyond basic type
- No priority/importance markers
- No booking requirements detection

## Supported Input Formats

### Time Formats
```
9:00 AM - Activity
9:00 AM - 10:30 AM - Activity
9:00 to 10:30 - Activity
9 AM - Activity
14:00 - Activity
```

### Activity Markers
```
- Activity description
• Activity description
* Activity description
1. Activity description
```

### Skip Patterns
- Lines starting with: Morning, Afternoon, Evening, Night
- Lines starting with: "Day X"
- Empty lines

## Current Limitations

1. **Single Line Processing**: Each activity must be on one line
2. **Time Required**: Activities without time get default "09:00"
3. **English Only**: Keywords and patterns are English-specific
4. **No Context**: Each line processed independently
5. **No Learning**: Can't improve based on patterns in specific itinerary
6. **Basic Extraction**: Many advanced patterns marked as "future enhancement"