# Voyance Profile Preferences - Complete Data Fields Documentation

This document lists all data fields in the Preferences tab of the user profile, including labels, input types, helper text, and data model mappings.

## 1. Flight Identity & Preferences

### Preferred Departure Time
- **Label**: "Preferred Departure Time"
- **Type**: Select/Dropdown
- **Options**: 
  - Early AM (6-9am)
  - Midday (9-12pm)
  - Afternoon (12-6pm)
  - Red-eye (after 10pm)
  - No preference
- **Helper Text**: "Impacts flight selection and airport timing"
- **Data Path**: `backendPreferences.flight.flight_time_preference`

### Seating Class Preference
- **Label**: "Seating Class Preference"
- **Type**: Select/Dropdown
- **Options**: 
  - Economy
  - Premium Economy
  - Business
  - First Class
- **Helper Text**: "Adjusts budget zones and airline filters"
- **Data Path**: `backendPreferences.flight.seat_preference`

### Airlines to Avoid
- **Label**: "Airlines to Avoid"
- **Type**: Text Input
- **Placeholder**: "e.g., Spirit, Frontier"
- **Helper Text**: "Prevents mismatches in recommendations"
- **Data Path**: `backendPreferences.flight.preferred_airlines` (array)

### Transfer Tolerance
- **Label**: "Transfer Tolerance"
- **Type**: Select/Dropdown
- **Options**: 
  - Nonstop only
  - 1 stop maximum
  - Any number of stops
- **Helper Text**: "Activates transfer risk model"
- **Data Path**: `backendPreferences.flight.direct_flights_only` (boolean)

## 2. Hotel Psychology & Deal-Breakers

### Bed Type Requirement
- **Label**: "Bed Type Requirement"
- **Type**: Select/Dropdown
- **Options**: 
  - No preference
  - King bed
  - Queen bed
  - Two beds
- **Data Path**: `backendPreferences.core.room_preferences`

### Accessibility Needs
- **Label**: "Accessibility Needs"
- **Type**: Select/Dropdown
- **Options**: 
  - No requirements
  - Elevator required
  - Ground floor only
  - ADA compliant
- **Data Path**: `backendPreferences.mobility.accessibility_needs` (array)

### Noise Sensitivity
- **Label**: "Noise Sensitivity"
- **Type**: Select/Dropdown
- **Options**: 
  - Not sensitive
  - Moderate - avoid street level
  - High - quiet rooms only
  - White noise is fine

### Booking Style
- **Label**: "Booking Style"
- **Type**: Select/Dropdown
- **Options**: 
  - Book well in advance
  - Flexible bookings preferred
  - Decide last-minute
  - Mix of both

### Must-Have Amenities
- **Label**: "Must-Have Amenities"
- **Type**: Checkbox Group
- **Options**: 
  - Pool
  - Spa
  - Ocean View
  - Gym
  - Business Center
  - Pet Friendly
  - Kitchen
  - Balcony

## 3. Budget Personality

### Daily Budget Range
- **Label**: "Daily Budget Range"
- **Type**: Dual Number Input (Min/Max)
- **Helper Text**: "Per person, per day (USD)"
- **Data Path**: `backendPreferences.core.budget`

### When Do You Splurge?
- **Label**: "When Do You Splurge?"
- **Type**: Select/Dropdown
- **Options**: 
  - Arrival day
  - One special meal per trip
  - Spa/wellness day
  - Last night celebration
  - Never splurge
  - Every day is special
- **Data Path**: `backendPreferences.core.budget_tier`

### Price Sensitivity for Meals
- **Label**: "Price Sensitivity for Meals"
- **Type**: Select/Dropdown
- **Options**: 
  - Very price-conscious
  - Moderate - balance quality/price
  - Not price-sensitive
  - Depends on the occasion

### Loyalty vs. Price
- **Label**: "Loyalty vs. Price"
- **Type**: Select/Dropdown
- **Options**: 
  - Always choose loyalty points
  - Price wins over loyalty
  - Balance both factors
  - Depends on the trip

## 4. Pacing & Recovery Modeling

### Active Hours Per Day
- **Label**: "Active Hours Per Day"
- **Type**: Select/Dropdown
- **Options**: 
  - 3-5 hours (light touring)
  - 6-8 hours (moderate pace)
  - 9+ hours (all day adventure)
  - Varies by mood

### How You Recover
- **Label**: "How You Recover"
- **Type**: Select/Dropdown
- **Options**: 
  - Spa treatments
  - Alone time in room
  - Drinks & socializing
  - Early sleep
  - Light walking/exploring

### Meal Timing Preference
- **Label**: "Meal Timing Preference"
- **Type**: Select/Dropdown
- **Options**: 
  - Early dinners (5-7pm)
  - Late brunches (10am-12pm)
  - Small bites all day
  - Traditional meal times

### Jet Lag Profile
- **Label**: "Jet Lag Profile"
- **Type**: Select/Dropdown
- **Options**: 
  - Adjusts quickly
  - Needs a full day to adjust
  - Avoids big time zone changes
  - Plans for jet lag recovery

## 5. Values & Deal-Breakers

### Environmental Concerns
- **Label**: "Environmental Concerns"
- **Type**: Select/Dropdown
- **Options**: 
  - No specific concerns
  - Prefer low-impact travel
  - Avoid flights when possible
  - Carbon-offset everything

### Cultural Immersion Level
- **Label**: "Cultural Immersion Level"
- **Type**: Select/Dropdown
- **Options**: 
  - Deep cultural experiences
  - Surface-level is fine
  - Tourist attractions preferred
  - Mix of both

### Privacy Threshold
- **Label**: "Privacy Threshold"
- **Type**: Select/Dropdown
- **Options**: 
  - Love meeting new people
  - Small groups preferred
  - Avoid crowds when possible
  - Private experiences only

### Special Accessibility Needs
- **Label**: "Special Accessibility Needs"
- **Type**: Text Input
- **Placeholder**: "Describe any specific requirements"

## 6. Trip Memory & Ritual Patterns

### Trip Rituals & Traditions
- **Label**: "Trip Rituals & Traditions"
- **Type**: Textarea
- **Placeholder**: "e.g., Always get a massage on arrival, buy a journal from each city, find the best rooftop bar..."
- **Helper Text**: "Adds signature moments for emotional continuity"

### What Do You Collect?
- **Label**: "What Do You Collect?"
- **Type**: Select/Dropdown
- **Options**: 
  - Photos & memories
  - Physical souvenirs
  - Recipes & local food
  - Stories & experiences
  - Nothing specific

### Favorite Past Trip Vibe
- **Label**: "Favorite Past Trip Vibe"
- **Type**: Text Input
- **Placeholder**: "e.g., Kyoto 2022 - peaceful temples & autumn colors"

### Why Was That Trip Special?
- **Label**: "Why Was That Trip Special?"
- **Type**: Textarea
- **Placeholder**: "What made it memorable? The pace, the discoveries, the feeling?"
- **Helper Text**: "Helps Voyance echo emotional patterns and tone"

## 7. Health & Safety Essentials

_Note: This section header appears but the fields are cut off in the provided content_

## Data Structure Notes

The preferences are stored in the `backendPreferences` object with the following main sections:
- `core`: Basic preferences like budget, accommodation style
- `flight`: Flight-related preferences
- `food`: Dietary preferences (not shown in visible content)
- `mobility`: Accessibility and mobility needs
- `ai`: AI assistance preferences (not shown in visible content)
- `travelDNA`: Travel personality data (not shown in visible content)

## UI/UX Notes

- All fields use consistent styling with Tailwind classes
- Focus states use teal color (`#0ABAB5`)
- Helper text is displayed in small gray text below inputs
- Save button shows real-time status (saving, saved, error)
- Manual save approach - changes must be explicitly saved