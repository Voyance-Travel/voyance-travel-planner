/**
 * Backend Preferences Data Types
 * Matches the structure expected by the API
 */

export interface CorePreferences {
  travel_pace?: string | null;
  budget_tier?: string | null;
  budget?: number | null;
  currency?: string | null;
  eco_friendly?: boolean | null;
  accommodation_style?: string | null;
  hotel_style?: string | null;
  hotel_vs_flight?: string | null;
  room_preferences?: string | null;
  trip_structure_preference?: string | null;
  planning_preference?: string | null;
}

export interface FlightPreferences {
  home_airport?: string | null;
  airport_code?: string | null;
  direct_flights_only?: boolean | null;
  preferred_cabin_class?: string | null;
  seat_preference?: string | null;
  preferred_airlines?: string[] | null;
  flight_time_preference?: string | null;
}

export interface FoodPreferences {
  dietary_restrictions?: string[] | null;
  food_likes?: string[] | null;
  food_dislikes?: string[] | null;
  comfort_food?: string | null;
  celebration_food?: string | null;
  taste_graph?: Record<string, unknown> | null;
}

export interface MobilityPreferences {
  mobility_level?: string | null;
  accessibility_needs?: string[] | null;
  allergies?: string[] | null;
  medical_considerations?: string | null;
}

export interface AIPreferences {
  ai_assistance_level?: string | null;
  recommendation_frequency?: string | null;
}

export interface BackendPreferencesData {
  core: CorePreferences;
  flight: FlightPreferences;
  food: FoodPreferences;
  mobility: MobilityPreferences;
  ai: AIPreferences;
}

export const createEmptyPreferences = (): BackendPreferencesData => ({
  core: {
    travel_pace: null,
    budget_tier: null,
    budget: null,
    currency: 'USD',
    eco_friendly: null,
    accommodation_style: null,
    hotel_style: null,
    hotel_vs_flight: null,
    room_preferences: null,
    trip_structure_preference: null,
    planning_preference: null,
  },
  flight: {
    home_airport: null,
    airport_code: null,
    direct_flights_only: null,
    preferred_cabin_class: null,
    seat_preference: null,
    preferred_airlines: null,
    flight_time_preference: null,
  },
  food: {
    dietary_restrictions: null,
    food_likes: null,
    food_dislikes: null,
    comfort_food: null,
    celebration_food: null,
    taste_graph: null,
  },
  mobility: {
    mobility_level: 'full',
    accessibility_needs: null,
    allergies: null,
    medical_considerations: null,
  },
  ai: {
    ai_assistance_level: 'balanced',
    recommendation_frequency: 'mixed',
  },
});
