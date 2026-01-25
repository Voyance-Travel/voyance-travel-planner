-- Add interaction_count column for behavioral tracking
ALTER TABLE public.user_enrichment 
ADD COLUMN IF NOT EXISTS interaction_count integer DEFAULT 1;

-- Add index for efficient querying by enrichment type
CREATE INDEX IF NOT EXISTS idx_user_enrichment_type_lookup 
ON public.user_enrichment (user_id, enrichment_type);

-- Add index for aggregate queries
CREATE INDEX IF NOT EXISTS idx_user_enrichment_aggregate 
ON public.user_enrichment (user_id, enrichment_type, entity_id);