CREATE OR REPLACE FUNCTION public.save_onboarding_dna(
  p_user_id           uuid,
  p_primary_archetype text,
  p_secondary_archetype text,
  p_confidence        int,
  p_trait_scores      jsonb,
  p_preferences       jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller must be the target user' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.travel_dna_profiles (
    user_id, primary_archetype_name, secondary_archetype_name,
    dna_confidence_score, trait_scores, calculated_at, updated_at
  )
  VALUES (
    p_user_id, p_primary_archetype, p_secondary_archetype,
    p_confidence, p_trait_scores, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    primary_archetype_name = EXCLUDED.primary_archetype_name,
    secondary_archetype_name = EXCLUDED.secondary_archetype_name,
    dna_confidence_score = EXCLUDED.dna_confidence_score,
    trait_scores = EXCLUDED.trait_scores,
    calculated_at = v_now,
    updated_at = v_now;

  INSERT INTO public.profiles (id, quiz_completed, updated_at)
  VALUES (p_user_id, true, v_now)
  ON CONFLICT (id) DO UPDATE SET
    quiz_completed = true,
    updated_at = v_now;

  INSERT INTO public.user_preferences (
    user_id, travel_pace, travel_companions, planning_preference,
    budget_tier, quiz_completed, updated_at
  )
  VALUES (
    p_user_id,
    p_preferences->>'travel_pace',
    ARRAY[p_preferences->>'travel_companion']::text[],
    p_preferences->>'planning_preference',
    p_preferences->>'budget_tier',
    true,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    travel_pace = COALESCE(EXCLUDED.travel_pace, public.user_preferences.travel_pace),
    travel_companions = COALESCE(EXCLUDED.travel_companions, public.user_preferences.travel_companions),
    planning_preference = COALESCE(EXCLUDED.planning_preference, public.user_preferences.planning_preference),
    budget_tier = COALESCE(EXCLUDED.budget_tier, public.user_preferences.budget_tier),
    quiz_completed = true,
    updated_at = v_now;

  RETURN jsonb_build_object('success', true, 'saved_at', v_now);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;

REVOKE ALL ON FUNCTION public.save_onboarding_dna(uuid, text, text, int, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_onboarding_dna(uuid, text, text, int, jsonb, jsonb) TO authenticated;