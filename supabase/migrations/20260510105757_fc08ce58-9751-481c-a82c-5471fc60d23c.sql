-- P0.9: DNA storage merge + derivation_source tracking
-- Fixes the quiz↔conversation overwrite bug where trait_scores JSONB was fully
-- replaced (8 traits clobbering 25), leaving primary_archetype_name stale.

-- 1) Add derivation_source column
ALTER TABLE public.travel_dna_profiles
  ADD COLUMN IF NOT EXISTS derivation_source text NOT NULL DEFAULT 'quiz';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'travel_dna_profiles_derivation_source_chk'
  ) THEN
    ALTER TABLE public.travel_dna_profiles
      ADD CONSTRAINT travel_dna_profiles_derivation_source_chk
      CHECK (derivation_source IN ('quiz', 'conversation', 'merged'));
  END IF;
END $$;

-- 2) Replace save_onboarding_dna() with merge-aware version + new p_derivation_source param.
--    trait_scores merges via JSONB || (newer keys override same-named older keys, others survive).
--    primary_archetype_name is still set from caller as a safety net; client immediately calls
--    recalculateArchetype() to overwrite with the canonical match against the merged keyset.
CREATE OR REPLACE FUNCTION public.save_onboarding_dna(
  p_user_id             uuid,
  p_primary_archetype   text,
  p_secondary_archetype text,
  p_confidence          int,
  p_trait_scores        jsonb,
  p_preferences         jsonb,
  p_derivation_source   text DEFAULT 'conversation'
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

  IF p_derivation_source NOT IN ('quiz', 'conversation', 'merged') THEN
    p_derivation_source := 'conversation';
  END IF;

  INSERT INTO public.travel_dna_profiles (
    user_id, primary_archetype_name, secondary_archetype_name,
    dna_confidence_score, trait_scores, derivation_source, calculated_at, updated_at
  )
  VALUES (
    p_user_id, p_primary_archetype, p_secondary_archetype,
    p_confidence, p_trait_scores, p_derivation_source, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    primary_archetype_name = EXCLUDED.primary_archetype_name,
    secondary_archetype_name = EXCLUDED.secondary_archetype_name,
    dna_confidence_score = EXCLUDED.dna_confidence_score,
    -- JSONB shallow merge: preserve quiz-only keys (~17), override 8 same-named with conversation values.
    trait_scores = COALESCE(public.travel_dna_profiles.trait_scores, '{}'::jsonb) || EXCLUDED.trait_scores,
    derivation_source = CASE
      WHEN public.travel_dna_profiles.derivation_source IS NULL THEN EXCLUDED.derivation_source
      WHEN public.travel_dna_profiles.derivation_source = EXCLUDED.derivation_source THEN EXCLUDED.derivation_source
      ELSE 'merged'
    END,
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

-- Grant execute on the new 7-arg signature; old 6-arg overload remains callable for backward compat.
REVOKE ALL ON FUNCTION public.save_onboarding_dna(uuid, text, text, int, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_onboarding_dna(uuid, text, text, int, jsonb, jsonb, text) TO authenticated;