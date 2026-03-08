
-- Create travel_guides table
CREATE TABLE public.travel_guides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  destination text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  selected_activities jsonb DEFAULT '[]'::jsonb,
  selected_photos text[] DEFAULT '{}',
  social_links jsonb DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Validation trigger instead of CHECK constraint for status
CREATE OR REPLACE FUNCTION public.validate_travel_guide_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_travel_guide_status
  BEFORE INSERT OR UPDATE ON public.travel_guides
  FOR EACH ROW EXECUTE FUNCTION public.validate_travel_guide_status();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_travel_guides_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_travel_guides_updated_at
  BEFORE UPDATE ON public.travel_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_travel_guides_updated_at();

-- RLS
ALTER TABLE public.travel_guides ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Users manage own guides"
  ON public.travel_guides FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anyone can read published guides
CREATE POLICY "Anyone can read published guides"
  ON public.travel_guides FOR SELECT
  USING (status = 'published');

-- Indexes
CREATE INDEX idx_travel_guides_user ON public.travel_guides(user_id);
CREATE INDEX idx_travel_guides_slug ON public.travel_guides(slug);
CREATE INDEX idx_travel_guides_trip ON public.travel_guides(trip_id);
