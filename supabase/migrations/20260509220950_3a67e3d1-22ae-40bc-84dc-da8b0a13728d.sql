ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS avoid_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoid_venues     TEXT[] NOT NULL DEFAULT '{}';