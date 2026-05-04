-- Cleanup: zero out activity_costs rows that represent placeholder departure transfers
-- (no transport mode chosen). These show as inflated airport-transfer prices in the
-- Payments tab even though the itinerary card is just a placeholder.
UPDATE public.activity_costs ac
SET cost_per_person_usd = 0,
    source = 'placeholder_departure',
    notes = COALESCE(notes, '') || ' [Cleanup: zeroed placeholder departure transfer]',
    updated_at = now()
WHERE ac.category = 'transport'
  AND ac.cost_per_person_usd > 0
  AND EXISTS (
    SELECT 1
    FROM public.trips t,
         jsonb_array_elements(COALESCE(t.itinerary_data->'days', '[]'::jsonb)) d,
         jsonb_array_elements(COALESCE(d->'activities', '[]'::jsonb)) a
    WHERE t.id = ac.trip_id
      AND (a->>'id') = ac.activity_id::text
      AND (
        (a->>'title') ~* '^(transfer|travel|head|go|depart|leave)\s+(to|for)\s+(the\s+)?(airport|station|terminal|port)'
        OR (a->>'title') ~* '^collect\s+luggage\s*(&|and)\s*transfer'
      )
      AND (a->>'title') !~* '\y(taxi|cab|uber|lyft|rideshare|private\s+car|car\s+service|metro|subway|train|rer|tgv|shuttle|bus|tram|ferry|boat)\y'
      AND COALESCE(a->>'description', '') !~* '\y(taxi|cab|uber|lyft|rideshare|private\s+car|car\s+service|metro|subway|train|rer|tgv|shuttle|bus|tram|ferry|boat)\y'
      AND COALESCE((a->>'bookingRequired')::boolean, false) = false
      AND COALESCE(a->'cost'->>'basis', '') NOT IN ('user', 'user_override')
  );

-- Also patch the JSONB so the itinerary card shows $0 (placeholder) instead of the
-- stale inflated number. We update cost.amount and estimatedCost.amount to 0 for
-- matching activities across all trips.
UPDATE public.trips t
SET itinerary_data = jsonb_set(
  itinerary_data,
  '{days}',
  (
    SELECT jsonb_agg(
      jsonb_set(
        d,
        '{activities}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN (a->>'title') ~* '^(transfer|travel|head|go|depart|leave)\s+(to|for)\s+(the\s+)?(airport|station|terminal|port)'
                   OR (a->>'title') ~* '^collect\s+luggage\s*(&|and)\s*transfer'
              THEN
                CASE
                  WHEN (a->>'title') ~* '\y(taxi|cab|uber|lyft|rideshare|private\s+car|car\s+service|metro|subway|train|rer|tgv|shuttle|bus|tram|ferry|boat)\y'
                    OR COALESCE(a->>'description','') ~* '\y(taxi|cab|uber|lyft|rideshare|private\s+car|car\s+service|metro|subway|train|rer|tgv|shuttle|bus|tram|ferry|boat)\y'
                    OR COALESCE((a->>'bookingRequired')::boolean, false) = true
                    OR COALESCE(a->'cost'->>'basis', '') IN ('user','user_override')
                  THEN a
                  ELSE jsonb_set(
                         jsonb_set(a, '{cost}', '{"amount":0,"currency":"USD"}'::jsonb, true),
                         '{estimatedCost}', '{"amount":0,"currency":"USD"}'::jsonb, true
                       )
                END
              ELSE a
            END
          )
          FROM jsonb_array_elements(COALESCE(d->'activities', '[]'::jsonb)) a
        )
      )
    )
    FROM jsonb_array_elements(COALESCE(itinerary_data->'days', '[]'::jsonb)) d
  )
)
WHERE itinerary_data ? 'days'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(itinerary_data->'days', '[]'::jsonb)) d,
         jsonb_array_elements(COALESCE(d->'activities', '[]'::jsonb)) a
    WHERE (
        (a->>'title') ~* '^(transfer|travel|head|go|depart|leave)\s+(to|for)\s+(the\s+)?(airport|station|terminal|port)'
        OR (a->>'title') ~* '^collect\s+luggage\s*(&|and)\s*transfer'
      )
      AND (a->>'title') !~* '\y(taxi|cab|uber|lyft|rideshare|private\s+car|car\s+service|metro|subway|train|rer|tgv|shuttle|bus|tram|ferry|boat)\y'
      AND COALESCE(a->>'description','') !~* '\y(taxi|cab|uber|lyft|rideshare|private\s+car|car\s+service|metro|subway|train|rer|tgv|shuttle|bus|tram|ferry|boat)\y'
      AND COALESCE((a->>'bookingRequired')::boolean, false) = false
      AND COALESCE(a->'cost'->>'basis','') NOT IN ('user','user_override')
      AND (
        ((a->'cost'->>'amount')::numeric > 0)
        OR ((a->'estimatedCost'->>'amount')::numeric > 0)
      )
  );
