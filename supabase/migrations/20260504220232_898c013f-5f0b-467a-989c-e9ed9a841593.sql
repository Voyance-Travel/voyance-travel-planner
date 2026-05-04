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
  IF NEW.cost_per_person_usd < 0 THEN
    NEW.cost_per_person_usd := 0;
  END IF;

  IF NEW.notes IS NOT NULL AND NEW.notes ILIKE '%free venue%' THEN
    IF NEW.cost_per_person_usd <> 0 THEN
      NEW.cost_per_person_usd := 0;
      NEW.source := COALESCE(NEW.source, 'free_venue');
    END IF;
  END IF;

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

  -- Skip the 3x cap when the price was intentionally floored by repair logic
  -- (Michelin venue, acclaimed bistro, ticketed attraction, etc.) — otherwise
  -- the cap silently clips €120 splurge dinners to ~€65 and erases the user's
  -- splurge-forward intent.
  IF NEW.source IN ('michelin_floor', 'ticketed_attraction_floor', 'acclaimed_bistro') THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

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