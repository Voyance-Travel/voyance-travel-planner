/**
 * Preferences Mapping Utilities
 * Maps between user-friendly labels and backend codes
 */

// Travel Pace
export const TRAVEL_PACE_LABEL_TO_CODE = {
  'Relaxed (1-2 activities/day)': 'slow',
  'Moderate (3-4 activities/day)': 'moderate',
  'Active (5+ activities/day)': 'fast',
} as const;

export const TRAVEL_PACE_CODE_TO_LABEL = {
  slow: 'Relaxed (1-2 activities/day)',
  moderate: 'Moderate (3-4 activities/day)',
  fast: 'Active (5+ activities/day)',
} as const;

// Budget Tier
export const BUDGET_TIER_LABEL_TO_CODE = {
  'Budget-friendly': 'budget',
  'Comfort': 'moderate',
  'Luxury experiences': 'luxury',
} as const;

export const BUDGET_TIER_CODE_TO_LABEL = {
  budget: 'Budget-friendly',
  moderate: 'Comfort',
  luxury: 'Luxury experiences',
} as const;

// Planning Preference
export const PLANNING_PREFERENCE_LABEL_TO_CODE = {
  'Balanced planning': 'balanced',
  'Flexible approach': 'flexible',
  'Detailed planning': 'meticulous',
} as const;

export const PLANNING_PREFERENCE_CODE_TO_LABEL = {
  balanced: 'Balanced planning',
  flexible: 'Flexible approach',
  meticulous: 'Detailed planning',
} as const;

// Trip Structure
export const TRIP_STRUCTURE_LABEL_TO_CODE = {
  'Structured itinerary': 'structured',
  'Flexible schedule': 'flexible',
  'Spontaneous adventure': 'spontaneous',
} as const;

export const TRIP_STRUCTURE_CODE_TO_LABEL = {
  structured: 'Structured itinerary',
  flexible: 'Flexible schedule',
  spontaneous: 'Spontaneous adventure',
} as const;

// Accommodation Style
export const ACCOMMODATION_STYLE_LABEL_TO_CODE = {
  'Hotels': 'hotel',
  'Hostels': 'hostel',
  'Vacation Rentals': 'airbnb',
  'Resorts': 'resort',
  'Luxury Suites': 'luxury_cocoon',
} as const;

export const ACCOMMODATION_STYLE_CODE_TO_LABEL = {
  hotel: 'Hotels',
  hostel: 'Hostels',
  airbnb: 'Vacation Rentals',
  resort: 'Resorts',
  luxury_cocoon: 'Luxury Suites',
} as const;

// Hotel Style
export const HOTEL_STYLE_LABEL_TO_CODE = {
  'Boutique': 'boutique',
  'Business': 'business',
  'Luxury': 'luxury',
  'Budget': 'budget',
} as const;

export const HOTEL_STYLE_CODE_TO_LABEL = {
  boutique: 'Boutique',
  business: 'Business',
  luxury: 'Luxury',
  budget: 'Budget',
} as const;

// Hotel vs Flight Priority
export const HOTEL_VS_FLIGHT_LABEL_TO_CODE = {
  'Prioritize hotel quality': 'hotel_focused',
  'Balance both equally': 'balanced',
  'Prioritize flight options': 'flight_focused',
} as const;

export const HOTEL_VS_FLIGHT_CODE_TO_LABEL = {
  hotel_focused: 'Prioritize hotel quality',
  balanced: 'Balance both equally',
  flight_focused: 'Prioritize flight options',
} as const;

// Hotel Floor Preference
export const HOTEL_FLOOR_LABEL_TO_CODE = {
  'Lower floors': 'low',
  'Higher floors': 'high',
  'No preference': 'no_preference',
} as const;

export const HOTEL_FLOOR_CODE_TO_LABEL = {
  low: 'Lower floors',
  high: 'Higher floors',
  no_preference: 'No preference',
} as const;

// Room Preferences
export const ROOM_PREFERENCES_LABEL_TO_CODE = {
  'Single room': 'single',
  'Double room': 'double',
  'Suite': 'suite',
  'Family room': 'family',
} as const;

export const ROOM_PREFERENCES_CODE_TO_LABEL = {
  single: 'Single room',
  double: 'Double room',
  suite: 'Suite',
  family: 'Family room',
} as const;

// Type exports
export type TravelPaceLabel = keyof typeof TRAVEL_PACE_LABEL_TO_CODE;
export type TravelPaceCode = keyof typeof TRAVEL_PACE_CODE_TO_LABEL;
export type BudgetTierLabel = keyof typeof BUDGET_TIER_LABEL_TO_CODE;
export type BudgetTierCode = keyof typeof BUDGET_TIER_CODE_TO_LABEL;
export type PlanningPreferenceLabel = keyof typeof PLANNING_PREFERENCE_LABEL_TO_CODE;
export type PlanningPreferenceCode = keyof typeof PLANNING_PREFERENCE_CODE_TO_LABEL;
export type TripStructureLabel = keyof typeof TRIP_STRUCTURE_LABEL_TO_CODE;
export type TripStructureCode = keyof typeof TRIP_STRUCTURE_CODE_TO_LABEL;
export type AccommodationStyleLabel = keyof typeof ACCOMMODATION_STYLE_LABEL_TO_CODE;
export type AccommodationStyleCode = keyof typeof ACCOMMODATION_STYLE_CODE_TO_LABEL;
export type HotelStyleLabel = keyof typeof HOTEL_STYLE_LABEL_TO_CODE;
export type HotelStyleCode = keyof typeof HOTEL_STYLE_CODE_TO_LABEL;
export type HotelVsFlightLabel = keyof typeof HOTEL_VS_FLIGHT_LABEL_TO_CODE;
export type HotelVsFlightCode = keyof typeof HOTEL_VS_FLIGHT_CODE_TO_LABEL;
export type RoomPreferencesLabel = keyof typeof ROOM_PREFERENCES_LABEL_TO_CODE;
export type RoomPreferencesCode = keyof typeof ROOM_PREFERENCES_CODE_TO_LABEL;
