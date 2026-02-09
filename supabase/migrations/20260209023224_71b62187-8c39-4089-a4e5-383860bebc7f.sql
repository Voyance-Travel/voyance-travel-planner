-- Drop and recreate the view with all fields needed for group preference blending
DROP VIEW IF EXISTS public.user_preferences_safe;

CREATE VIEW public.user_preferences_safe AS
SELECT 
  user_id,
  travel_pace,
  budget_tier,
  activity_level,
  travel_style,
  interests,
  travel_vibes,
  traveler_type,
  dietary_restrictions,
  food_likes,
  food_dislikes,
  dining_style,
  mobility_level,
  accessibility_needs,
  eco_friendly,
  climate_preferences,
  weather_preferences,
  preferred_regions,
  accommodation_style,
  hotel_style,
  planning_preference,
  trip_structure_preference,
  social_energy,
  quiz_completed,
  created_at,
  updated_at
FROM user_preferences;