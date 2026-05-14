UPDATE public.destinations
SET hero_image_url = stock_image_url
WHERE hero_image_url IS NULL
  AND stock_image_url LIKE '%/storage/v1/object/public/site-images/%';