
-- Voyance Picks: Founder-curated destinations picks that ALWAYS get recommended
CREATE TABLE public.voyance_picks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'dining',
  description TEXT,
  why_essential TEXT NOT NULL,
  insider_tip TEXT,
  neighborhood TEXT,
  price_range TEXT,
  best_time TEXT,
  address TEXT,
  coordinates JSONB,
  tags TEXT[] DEFAULT '{}',
  added_by TEXT DEFAULT 'founder',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast destination lookup
CREATE INDEX idx_voyance_picks_destination ON public.voyance_picks(lower(destination)) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.voyance_picks ENABLE ROW LEVEL SECURITY;

-- Public read access (these are editorial picks, not user data)
CREATE POLICY "Voyance picks are publicly readable"
  ON public.voyance_picks FOR SELECT
  USING (true);

-- Only authenticated users can manage (admin-level, enforced in app)
CREATE POLICY "Authenticated users can manage voyance picks"
  ON public.voyance_picks FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed Zeerovers as the first pick
INSERT INTO public.voyance_picks (destination, name, category, description, why_essential, insider_tip, neighborhood, price_range, best_time, tags, added_by, priority)
VALUES (
  'Aruba',
  'Zeerovers',
  'dining',
  'A no-frills seaside fish shack in Savaneta where locals and visitors alike line up for the freshest catch on the island — fried whole fish, shrimp, and mahi mahi served on paper plates with panoramic ocean views.',
  'This IS the Aruba dining experience. No tablecloths, no reservations, no pretense — just the best seafood on the island at honest prices. Every local will tell you this is their #1 spot. Missing Zeerovers is like going to Naples and skipping pizza.',
  'Go between 12-1pm before the lunch rush. Order the catch of the day fried whole with funchi and pan bati on the side. Grab a Balashi beer from the cooler. Sit at the water''s edge tables — the ones on the left side have the best breeze and sunset angle.',
  'Savaneta',
  '$15-25 per person',
  'Lunch (11:30am-2pm) for best selection, or sunset for atmosphere',
  ARRAY['seafood', 'local-favorite', 'casual', 'waterfront', 'must-visit', 'budget-friendly'],
  'founder',
  1
);
