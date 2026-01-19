
-- Drop and recreate the view with proper security settings
-- The security_invoker=on ensures RLS from base table (user_preferences) is applied

DROP VIEW IF EXISTS public.user_preferences_safe;

CREATE VIEW public.user_preferences_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  -- Core travel preferences (safe to expose)
  interests,
  travel_pace,
  budget_tier,
  dining_style,
  activity_level,
  travel_style,
  traveler_type,
  travel_companions,
  travel_frequency,
  trip_duration,
  -- Accommodation preferences
  accommodation_style,
  hotel_style,
  hotel_vs_flight,
  -- Dietary (needed for group trip blending, not PII)
  dietary_restrictions,
  food_likes,
  food_dislikes,
  -- Accessibility (needed for group trip blending)
  accessibility_needs,
  mobility_level,
  mobility_needs,
  -- Climate preferences
  climate_preferences,
  weather_preferences,
  preferred_regions,
  -- Activity settings
  activity_weights,
  max_activities_per_day,
  preferred_downtime_minutes,
  schedule_flexibility,
  daytime_bias,
  downtime_ratio,
  -- Flight preferences (safe)
  flight_preferences,
  flight_time_preference,
  seat_preference,
  direct_flights_only,
  preferred_airlines,
  home_airport,
  airport_radius_miles,
  loyalty_programs,
  -- Eco preferences
  eco_friendly,
  -- Notification settings (safe)
  email_notifications,
  push_notifications,
  trip_reminders,
  price_alerts,
  marketing_emails,
  -- Quiz/system metadata
  quiz_completed,
  quiz_version,
  completed_at,
  created_at,
  updated_at
  -- EXCLUDED: phone_number, personal_notes (PII)
FROM public.user_preferences;

-- Add comment documenting the view's purpose
COMMENT ON VIEW public.user_preferences_safe IS 
'Public-safe view of user_preferences excluding PII (phone_number, personal_notes). Uses security_invoker=on to inherit RLS policies from base table. Use this for group preference blending.';
