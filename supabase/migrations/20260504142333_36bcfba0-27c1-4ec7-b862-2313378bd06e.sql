ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS coach_protected_categories text[];