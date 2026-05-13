-- One-shot repair: clear stale wrong-destination hotel enrichment
-- for the reported trip and any other San-Juan trip whose hotel address
-- still points to a US mainland location.

WITH bad_trips AS (
  SELECT
    t.id,
    t.destination,
    elem.idx AS arr_idx,
    elem.value AS hotel
  FROM public.trips t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(t.hotel_selection) = 'array'
         THEN t.hotel_selection
         ELSE jsonb_build_array(t.hotel_selection) END
  ) WITH ORDINALITY AS elem(value, idx)
  WHERE t.hotel_selection IS NOT NULL
    AND lower(t.destination) LIKE '%san juan%'
    AND (
      (elem.value->>'address') ~* '\b(CA|California|Dana Point|Laguna Niguel|United States|USA)\b'
      OR (elem.value->>'name') ~* ',\s*(Laguna Niguel|Dana Point|California|CA)\b'
    )
)
UPDATE public.trips t
SET hotel_selection = (
  SELECT jsonb_agg(
    CASE WHEN bt.arr_idx IS NOT NULL THEN
      (elem.value
        - 'address' - 'placeId' - 'website' - 'googleMapsUrl'
        - 'images' - 'imageUrl' - 'photos'
      )
      || jsonb_build_object(
        'name', regexp_replace(elem.value->>'name', ',\s*(Laguna Niguel|Dana Point|California|CA).*$', '', 'i'),
        'isEnriched', false,
        'needsHotelPick', true,
        'destinationMismatchReason', 'address in United States, expected San Juan (auto-cleaned)'
      )
    ELSE elem.value END
    ORDER BY elem.idx
  )
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(t.hotel_selection) = 'array'
         THEN t.hotel_selection
         ELSE jsonb_build_array(t.hotel_selection) END
  ) WITH ORDINALITY AS elem(value, idx)
  LEFT JOIN bad_trips bt
    ON bt.id = t.id AND bt.arr_idx = elem.idx
)
WHERE t.id IN (SELECT DISTINCT id FROM bad_trips);
