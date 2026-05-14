DELETE FROM public.itinerary_activities
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      is_locked,
      ROW_NUMBER() OVER (
        PARTITION BY trip_id, itinerary_day_id, lower(coalesce(category, '')), lower(trim(coalesce(title, name, '')))
        ORDER BY sort_order ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.itinerary_activities
    WHERE coalesce(title, name, '') ~* '^(return to|travel to|walk to|taxi to|metro to|bus to|train to|drive to|check[- ]?in|check[- ]?out|luggage drop|freshen up|head to)'
  ) ranked
  WHERE rn > 1 AND is_locked = false
);