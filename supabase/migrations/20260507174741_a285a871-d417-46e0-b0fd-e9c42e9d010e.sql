WITH walks AS (
  SELECT ac.id
  FROM public.activity_costs ac
  JOIN public.itinerary_activities ia ON ia.id::text = ac.activity_id
  WHERE ac.cost_per_person_usd > 0
    AND (
      ia.title ~* '^\s*(walk|stroll)\b'
      OR ia.title ~* '\bwalking\s+(to|along|through|around)\b'
      OR COALESCE(ia.description, '') ~* '\bwalking\s+(to|along|through|around)\b'
    )
    AND NOT (
      COALESCE(ia.booking_required, false) = true
      AND (ia.title ~* '\bwalking\s+tour\b' OR COALESCE(ia.description, '') ~* '\bwalking\s+tour\b')
    )
)
UPDATE public.activity_costs
SET cost_per_person_usd = 0,
    source = 'walking_free',
    notes = COALESCE(notes, '') || ' [scrubbed: walking leg]'
WHERE id IN (SELECT id FROM walks);