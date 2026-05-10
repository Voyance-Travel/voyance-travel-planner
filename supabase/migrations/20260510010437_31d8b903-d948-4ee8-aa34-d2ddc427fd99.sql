ALTER TABLE public.trip_date_versions
  ADD COLUMN IF NOT EXISTS restored_at    timestamptz,
  ADD COLUMN IF NOT EXISTS times_restored integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata       jsonb   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS label          text;