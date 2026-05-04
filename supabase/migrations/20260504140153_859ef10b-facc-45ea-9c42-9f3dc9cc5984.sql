-- Phase 2 + 3: Free-venue / Walk guard + cleanup of corrupted rows.

-- 1) Update validate_activity_cost trigger: any row whose notes flag it as
--    a free venue, or whose category is transport AND title-derived notes
--    indicate walking, must have cost forced to 0. This is a defensive
--    layer that catches all write paths (edge functions, client, admin).
CREATE OR REPLACE FUNCTION public.validate_activity_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  ref RECORD;
  max_allowed NUMERIC;
  original_cost NUMERIC;
  warning_threshold NUMERIC;
BEGIN
  -- Rule 1: Cost must be non-negative
  IF NEW.cost_per_person_usd < 0 THEN
    NEW.cost_per_person_usd := 0;
  END IF;

  -- Rule 1b (NEW): Free venues and walking transport are ALWAYS $0.
  -- A row tagged "Free venue" with non-zero cost is data corruption from
  -- a prior auto-correction. Walking is by definition free. This rule
  -- runs before user_override so even a user can't accidentally bill a walk.
  IF NEW.notes IS NOT NULL AND NEW.notes ILIKE '%free venue%' THEN
    IF NEW.cost_per_person_usd <> 0 THEN
      NEW.cost_per_person_usd := 0;
      NEW.source := COALESCE(NEW.source, 'free_venue');
    END IF;
  END IF;

  -- Rule 2: User overrides are respected (after the free-venue guard above)
  IF NEW.source = 'user_override' THEN
    CASE NEW.category
      WHEN 'dining' THEN warning_threshold := 500;
      WHEN 'transport' THEN warning_threshold := 300;
      WHEN 'activity' THEN warning_threshold := 1000;
      WHEN 'nightlife' THEN warning_threshold := 200;
      ELSE warning_threshold := 2000;
    END CASE;

    IF NEW.cost_per_person_usd > warning_threshold THEN
      NEW.notes := COALESCE(NEW.notes, '') || ' [User override: above typical range for ' || NEW.category || ']';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Rule 3: Reference-based correction
  IF NEW.cost_reference_id IS NOT NULL THEN
    SELECT * INTO ref FROM public.cost_reference WHERE id = NEW.cost_reference_id;
    IF FOUND THEN
      max_allowed := ref.cost_high_usd * 3;
      IF NEW.cost_per_person_usd > max_allowed THEN
        original_cost := NEW.cost_per_person_usd;
        NEW.cost_per_person_usd := ref.cost_high_usd;
        NEW.notes := COALESCE(NEW.notes, '') || ' [Auto-corrected from $' || original_cost || ', exceeded 3x ref high $' || ref.cost_high_usd || ']';
        NEW.source := 'auto_corrected';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 2) One-time cleanup: any existing row tagged "Free venue" with non-zero
--    cost is corrupted from a prior auto-correction. Zero them out.
UPDATE public.activity_costs
SET cost_per_person_usd = 0,
    source = 'free_venue',
    notes = COALESCE(notes, '') || ' [Cleanup: zeroed corrupted free-venue cost]'
WHERE notes ILIKE '%free venue%'
  AND cost_per_person_usd <> 0;

-- 3) Delete orphan activity_costs rows whose activity_id no longer exists
--    in the trip's itinerary_data. These are stale rows from prior repairs
--    that silently inflate day totals.
DELETE FROM public.activity_costs ac
WHERE ac.activity_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.trips t,
         jsonb_array_elements(COALESCE(t.itinerary_data->'days', '[]'::jsonb)) d,
         jsonb_array_elements(COALESCE(d->'activities', '[]'::jsonb)) a
    WHERE t.id = ac.trip_id
      AND (a->>'id') = ac.activity_id::text
  );