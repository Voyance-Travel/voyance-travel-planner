-- Add airport transfer minutes column to destinations
ALTER TABLE public.destinations 
ADD COLUMN IF NOT EXISTS airport_transfer_minutes INTEGER DEFAULT 45;

-- Add comments
COMMENT ON COLUMN public.destinations.airport_transfer_minutes IS 'Estimated transfer time from main airport to city center in minutes';

-- Populate initial values for major destinations
UPDATE public.destinations SET airport_transfer_minutes = 45 WHERE city ILIKE '%rome%';
UPDATE public.destinations SET airport_transfer_minutes = 60 WHERE city ILIKE '%paris%';
UPDATE public.destinations SET airport_transfer_minutes = 90 WHERE city ILIKE '%tokyo%';
UPDATE public.destinations SET airport_transfer_minutes = 60 WHERE city ILIKE '%london%';
UPDATE public.destinations SET airport_transfer_minutes = 60 WHERE city ILIKE '%new york%';
UPDATE public.destinations SET airport_transfer_minutes = 35 WHERE city ILIKE '%barcelona%';
UPDATE public.destinations SET airport_transfer_minutes = 20 WHERE city ILIKE '%amsterdam%';
UPDATE public.destinations SET airport_transfer_minutes = 45 WHERE city ILIKE '%bangkok%';
UPDATE public.destinations SET airport_transfer_minutes = 45 WHERE city ILIKE '%bali%';
UPDATE public.destinations SET airport_transfer_minutes = 25 WHERE city ILIKE '%lisbon%';
UPDATE public.destinations SET airport_transfer_minutes = 40 WHERE city ILIKE '%florence%';
UPDATE public.destinations SET airport_transfer_minutes = 30 WHERE city ILIKE '%venice%';
UPDATE public.destinations SET airport_transfer_minutes = 35 WHERE city ILIKE '%milan%';
UPDATE public.destinations SET airport_transfer_minutes = 50 WHERE city ILIKE '%dubai%';
UPDATE public.destinations SET airport_transfer_minutes = 45 WHERE city ILIKE '%singapore%';
UPDATE public.destinations SET airport_transfer_minutes = 60 WHERE city ILIKE '%sydney%';
UPDATE public.destinations SET airport_transfer_minutes = 35 WHERE city ILIKE '%berlin%';
UPDATE public.destinations SET airport_transfer_minutes = 25 WHERE city ILIKE '%vienna%';
UPDATE public.destinations SET airport_transfer_minutes = 30 WHERE city ILIKE '%prague%';
UPDATE public.destinations SET airport_transfer_minutes = 30 WHERE city ILIKE '%budapest%';