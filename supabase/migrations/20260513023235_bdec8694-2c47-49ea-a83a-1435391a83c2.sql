UPDATE public.trips
SET hotel_selection = jsonb_build_array(
  (hotel_selection->0)
    - 'address' - 'placeId' - 'website' - 'googleMapsUrl' - 'images' - 'imageUrl' - 'photos'
  || jsonb_build_object(
    'name', 'The Ritz-Carlton',
    'isEnriched', false,
    'needsHotelPick', true,
    'destinationMismatchReason', 'address in United States, expected San Juan (auto-cleaned)'
  )
)
WHERE id = 'fea55309-9708-448e-b105-19b712d533ca'
  AND jsonb_typeof(hotel_selection) = 'array';
