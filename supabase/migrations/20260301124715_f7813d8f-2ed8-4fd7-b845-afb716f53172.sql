
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
  -- Rule 1: Cost must be non-negative (hard rule, always enforced)
  IF NEW.cost_per_person_usd < 0 THEN
    NEW.cost_per_person_usd := 0;
  END IF;

  -- Rule 2: User overrides are always respected
  IF NEW.source = 'user_override' THEN
    -- Just log a note if the cost is above typical range for the category
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

    -- Never modify the user's value
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Rule 3: AI/system-generated costs — apply reference-based correction only
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

  -- No category caps for AI costs either — the reference-based check above is sufficient.
  -- This prevents silent data rewrites that confuse users.

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
