UPDATE public.destinations
SET hero_image_url = NULL
WHERE hero_image_url ILIKE '%images.unsplash.com%'
   OR hero_image_url ILIKE '%source.unsplash.com%';

UPDATE public.trips
SET metadata = metadata - 'hero_image'
WHERE metadata->>'hero_image' ILIKE '%images.unsplash.com%'
   OR metadata->>'hero_image' ILIKE '%source.unsplash.com%';

UPDATE public.curated_images
SET is_blacklisted = true
WHERE (image_url ILIKE '%images.unsplash.com%'
   OR image_url ILIKE '%source.unsplash.com%')
  AND is_blacklisted = false;