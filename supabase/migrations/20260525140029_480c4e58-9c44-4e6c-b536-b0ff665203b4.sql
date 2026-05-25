-- Backfill Rome trip d18b2e8a... whose Days 1 & 3 were collapsed to
-- "Culinary Day in Rome" by the pre-fix coherence pass. Re-derive
-- using the new headline-first logic.
-- Day 1 headline: Wander Trastevere Neighborhood (cultural)
-- Day 3 headline: Pizzarium Bonci (dining-only day; fall back to vibe)
-- For Day 3 the headline is dining-only; we use a content-aware label.

UPDATE public.itinerary_days
SET title = 'Trastevere & Colosseum',
    theme = 'Trastevere & Colosseum'
WHERE trip_id = 'd18b2e8a-310e-42c8-a7aa-aac61076a234'
  AND day_number = 1;

UPDATE public.itinerary_days
SET title = 'Roman Pizza & Markets',
    theme = 'Roman Pizza & Markets'
WHERE trip_id = 'd18b2e8a-310e-42c8-a7aa-aac61076a234'
  AND day_number = 3;

-- Mirror into trips.itinerary_data JSON so UI shows the fix immediately.
UPDATE public.trips
SET itinerary_data = jsonb_set(
  itinerary_data,
  '{days}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (d->>'dayNumber')::int = 1 THEN
          jsonb_set(jsonb_set(d, '{title}', '"Trastevere & Colosseum"'), '{theme}', '"Trastevere & Colosseum"')
        WHEN (d->>'dayNumber')::int = 3 THEN
          jsonb_set(jsonb_set(d, '{title}', '"Roman Pizza & Markets"'), '{theme}', '"Roman Pizza & Markets"')
        ELSE d
      END
      ORDER BY (d->>'dayNumber')::int
    )
    FROM jsonb_array_elements(itinerary_data->'days') d
  )
)
WHERE id = 'd18b2e8a-310e-42c8-a7aa-aac61076a234'
  AND itinerary_data ? 'days';