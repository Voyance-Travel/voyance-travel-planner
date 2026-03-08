ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS local_tips JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_tips JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS getting_around TEXT,
  ADD COLUMN IF NOT EXISTS best_neighborhoods JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS food_scene TEXT,
  ADD COLUMN IF NOT EXISTS nightlife_info TEXT,
  ADD COLUMN IF NOT EXISTS dress_code TEXT,
  ADD COLUMN IF NOT EXISTS tipping_custom TEXT,
  ADD COLUMN IF NOT EXISTS common_scams JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS emergency_numbers JSONB,
  ADD COLUMN IF NOT EXISTS last_local_knowledge_update TIMESTAMPTZ;