ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS enrichment_expires_at TIMESTAMPTZ;

UPDATE public.destinations
SET enrichment_expires_at = enriched_at + INTERVAL '90 days'
WHERE enriched_at IS NOT NULL
  AND enrichment_expires_at IS NULL;