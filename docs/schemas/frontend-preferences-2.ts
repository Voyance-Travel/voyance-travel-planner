/**
 * Frontend Preferences Schema
 * Based on TRIP_PREFERENCES_PROFILE_SOURCE_OF_TRUTH.md
 */

import { z } from "zod";

// Core preferences schema
const CorePreferencesSchema = z.object({
  budget: z.string().optional(),
  budget_tier: z.string().optional(),
  currency: z.string().default("USD").optional(),
  accommodation_style: z.string().optional(),
  hotel_style: z.string().optional(),
  room_preferences: z.string().optional(),
  planning_preference: z.string().optional(),
  trip_structure_preference: z.string().optional(),
  packing_style: z.string().optional(),
  travel_pace: z.string().optional(),
  comfort_vs_authenticity: z.string().optional(),
  spontaneity: z.string().optional(),
  booking_advance: z.string().optional(),
  eco_friendly: z.boolean().optional(),
  booking_style: z.string().optional(),
}).optional();

// Flight preferences schema
const FlightPreferencesSchema = z.object({
  departure_airport: z.string().optional(),
  home_airport: z.string().optional(),
  airport_code: z.string().optional(),
  direct_flights_only: z.boolean().optional(),
  flight_time_preference: z.string().optional(),
  seat_preference: z.string().optional(),
  baggage_type: z.string().optional(),
  lounge_access: z.boolean().optional(),
  preferred_airlines: z.array(z.string()).optional(),
  airline_loyalty: z.string().optional(),
  tsa_precheck: z.boolean().optional(),
  global_entry: z.boolean().optional(),
  passport_number: z.string().optional(),
  passport_expiry: z.string().optional(),
  transfer_tolerance: z.string().optional(),
}).optional();

// Food preferences schema
const FoodPreferencesSchema = z.object({
  dietary_restrictions: z.array(z.string()).optional(),
  food_dislikes: z.array(z.string()).optional(),
  food_likes: z.array(z.string()).optional(),
  celebration_food: z.string().optional(),
  comfort_food: z.string().optional(),
  local_cuisine_adventure: z.string().optional(),
  alcohol_preference: z.string().optional(),
  coffee_tea_preference: z.string().optional(),
  sweet_tooth: z.string().optional(),
  taste_graph: z.record(z.number()).optional(),
  price_sensitivity: z.string().optional(),
}).optional();

// Mobility preferences schema
const MobilityPreferencesSchema = z.object({
  accessibility_needs: z.array(z.string()).optional(),
  mobility_level: z.string().optional(),
  medical_considerations: z.string().optional(),
  travel_companions: z.string().optional(),
  pet_travel: z.boolean().optional(),
  allergies: z.array(z.string()).optional(),
  medication_schedule: z.string().optional(),
  emergency_contact: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relation: z.string().optional(),
  travel_insurance: z.string().optional(),
  doctor_contact: z.string().optional(),
  blood_type: z.string().optional(),
  languages_spoken: z.array(z.string()).optional(),
  noise_sensitivity: z.string().optional(),
}).optional();

// AI preferences schema
const AIPreferencesSchema = z.object({
  personalization_level: z.string().optional(),
  recommendation_style: z.string().optional(),
  interaction_frequency: z.string().optional(),
}).optional();

// Travel DNA schema
const TravelDNASchema = z.object({
  primary_archetype: z.string().optional(),
  secondary_archetype: z.string().optional(),
  trait_scores: z.record(z.number()).optional(),
  activity_preferences: z.record(z.number()).optional(),
  emotional_tags: z.array(z.string()).optional(),
  emotional_drivers: z.array(z.string()).optional(),
  stress_triggers: z.array(z.string()).optional(),
  joy_amplifiers: z.array(z.string()).optional(),
  energy_rhythm: z.string().optional(),
  social_battery: z.string().optional(),
  decision_style: z.string().optional(),
}).optional();

// Activity preferences schema
const ActivityPreferencesSchema = z.object({
  active_hours_per_day: z.string().optional(),
  recovery_style: z.string().optional(),
  meal_timing_preference: z.string().optional(),
  jet_lag_profile: z.string().optional(),
}).optional();

// Values preferences schema
const ValuesPreferencesSchema = z.object({
  environmental_concerns: z.string().optional(),
  cultural_immersion_level: z.string().optional(),
  privacy_threshold: z.string().optional(),
  special_accessibility_needs: z.string().optional(),
}).optional();

// Memory preferences schema
const MemoryPreferencesSchema = z.object({
  trip_rituals: z.string().optional(),
  collection_preference: z.string().optional(),
  favorite_trip_vibe: z.string().optional(),
  special_trip_reason: z.string().optional(),
}).optional();

// Main frontend preferences schema
export const FrontendPreferencesSchema = z.object({
  body: z.object({
    core: CorePreferencesSchema,
    flight: FlightPreferencesSchema,
    food: FoodPreferencesSchema,
    mobility: MobilityPreferencesSchema,
    ai: AIPreferencesSchema,
    travelDNA: TravelDNASchema,
    activity: ActivityPreferencesSchema,
    values: ValuesPreferencesSchema,
    memory: MemoryPreferencesSchema,
  }),
});

export type FrontendPreferencesInput = z.infer<typeof FrontendPreferencesSchema>;