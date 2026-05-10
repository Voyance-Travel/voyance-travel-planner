CREATE OR REPLACE FUNCTION public.complete_quiz(_prefs jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.user_preferences (
    user_id,
    quiz_completed,
    completed_at,
    budget_tier,
    travel_pace,
    accommodation_style,
    planning_preference,
    interests,
    travel_companions,
    travel_vibes,
    traveler_type,
    primary_goal
  )
  VALUES (
    uid,
    true,
    now(),
    NULLIF(_prefs->>'budget', ''),
    NULLIF(_prefs->>'pace', ''),
    NULLIF(_prefs->>'accommodation', ''),
    NULLIF(_prefs->>'planning', ''),
    CASE WHEN jsonb_typeof(_prefs->'interests') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(_prefs->'interests')) END,
    CASE WHEN jsonb_typeof(_prefs->'travel_companions') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(_prefs->'travel_companions')) END,
    CASE WHEN jsonb_typeof(_prefs->'travel_vibes') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(_prefs->'travel_vibes')) END,
    NULLIF(_prefs->>'traveler_type', ''),
    NULLIF(_prefs->>'primary_goal', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    quiz_completed       = true,
    completed_at         = now(),
    budget_tier          = COALESCE(EXCLUDED.budget_tier,          public.user_preferences.budget_tier),
    travel_pace          = COALESCE(EXCLUDED.travel_pace,          public.user_preferences.travel_pace),
    accommodation_style  = COALESCE(EXCLUDED.accommodation_style,  public.user_preferences.accommodation_style),
    planning_preference  = COALESCE(EXCLUDED.planning_preference,  public.user_preferences.planning_preference),
    interests            = COALESCE(EXCLUDED.interests,            public.user_preferences.interests),
    travel_companions    = COALESCE(EXCLUDED.travel_companions,    public.user_preferences.travel_companions),
    travel_vibes         = COALESCE(EXCLUDED.travel_vibes,         public.user_preferences.travel_vibes),
    traveler_type        = COALESCE(EXCLUDED.traveler_type,        public.user_preferences.traveler_type),
    primary_goal         = COALESCE(EXCLUDED.primary_goal,         public.user_preferences.primary_goal);

  INSERT INTO public.profiles (id, quiz_completed, updated_at)
  VALUES (uid, true, now())
  ON CONFLICT (id) DO UPDATE SET
    quiz_completed = true,
    updated_at     = now();
END;
$$;

REVOKE ALL ON FUNCTION public.complete_quiz(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_quiz(jsonb) TO authenticated;