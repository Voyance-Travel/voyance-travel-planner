-- Add category tagging columns to attractions
ALTER TABLE public.attractions 
ADD COLUMN IF NOT EXISTS experience_categories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS vibe TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS crowd_level TEXT DEFAULT 'moderate',
ADD COLUMN IF NOT EXISTS physical_intensity TEXT DEFAULT 'moderate',
ADD COLUMN IF NOT EXISTS requires_reservation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS budget_level TEXT DEFAULT 'moderate',
ADD COLUMN IF NOT EXISTS best_time_of_day TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS indoor_outdoor TEXT DEFAULT 'both',
ADD COLUMN IF NOT EXISTS typical_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS family_friendly BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS romantic BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS solo_friendly BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS group_friendly BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE;

-- Create index for category queries (GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_attractions_experience_categories 
  ON public.attractions USING GIN (experience_categories);

CREATE INDEX IF NOT EXISTS idx_attractions_vibe 
  ON public.attractions USING GIN (vibe);

CREATE INDEX IF NOT EXISTS idx_attractions_budget_level
  ON public.attractions (budget_level);

-- Create archetype guide cache table for AI-generated destination guides
CREATE TABLE IF NOT EXISTS public.archetype_destination_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype TEXT NOT NULL,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  guide JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '90 days',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(archetype, destination_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_archetype_guides_lookup 
  ON public.archetype_destination_guides(archetype, destination_id);

-- Enable RLS
ALTER TABLE public.archetype_destination_guides ENABLE ROW LEVEL SECURITY;

-- Public read access (guides are not user-specific)
CREATE POLICY "Archetype guides are publicly readable"
  ON public.archetype_destination_guides
  FOR SELECT
  USING (true);

-- Only service role can insert/update (via edge functions)
CREATE POLICY "Service role can manage archetype guides"
  ON public.archetype_destination_guides
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE public.archetype_destination_guides IS 'Cached AI-generated travel guides for archetype × destination combinations';
COMMENT ON COLUMN public.attractions.experience_categories IS 'Array of experience category tags (e.g., museum, street_food, viewpoint)';
COMMENT ON COLUMN public.attractions.vibe IS 'Array of vibe descriptors (e.g., touristy, local, hidden_gem, romantic)';