-- Feature flags and plan entitlements system
-- ============================================

-- Plan definitions
CREATE TABLE public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stripe_price_id TEXT,
  is_addon BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Feature flag definitions
CREATE TABLE public.feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'ai', 'trip', 'booking', 'enrich'
  value_type TEXT NOT NULL DEFAULT 'boolean', -- 'boolean', 'number', 'enum'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Plan entitlements (what each plan gets)
CREATE TABLE public.plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  flag_id TEXT NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  value_number INTEGER, -- for numeric limits
  value_json JSONB, -- for complex values (enums, etc)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, flag_id)
);

-- User overrides (for comps/beta/internal)
CREATE TABLE public.user_entitlement_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  flag_id TEXT NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  value_number INTEGER,
  value_json JSONB,
  reason TEXT, -- 'beta', 'comp', 'internal', 'promo'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, flag_id)
);

-- Usage tracking for quotas
CREATE TABLE public.user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  metric_key TEXT NOT NULL, -- 'ai.itinerary.generate', etc.
  period TEXT NOT NULL, -- '2025-01' (monthly)
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, metric_key, period)
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Plans and flags are public read
CREATE POLICY "Plans are publicly readable" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Feature flags are publicly readable" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "Plan entitlements are publicly readable" ON public.plan_entitlements FOR SELECT USING (true);

-- User overrides: users can only see their own
CREATE POLICY "Users can view own overrides" ON public.user_entitlement_overrides FOR SELECT USING (auth.uid() = user_id);

-- Usage: users can view and update their own
CREATE POLICY "Users can view own usage" ON public.user_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON public.user_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.user_usage FOR UPDATE USING (auth.uid() = user_id);

-- Seed plans
INSERT INTO public.plans (id, name, description, stripe_price_id, is_addon, display_order) VALUES
  ('free', 'Free', 'Basic access with limited AI features', NULL, false, 0),
  ('paid', 'Voyance Pro', 'Full AI trip design and personalization', 'price_1RpYVWFYxIg9jcJU4t3JVCy0', false, 1),
  ('addon_voyagermaps', 'VoyagerMaps', 'Deep venue enrichment, reviews, photos, live refresh', 'price_1RpYWpFYxIg9jcJUPrSLmFsu', true, 2);

-- Seed feature flags
INSERT INTO public.feature_flags (id, name, description, category, value_type) VALUES
  -- AI / LLM
  ('ai.itinerary.generate', 'Generate AI Itinerary', 'Can generate AI-powered itineraries', 'ai', 'boolean'),
  ('ai.itinerary.generate_quota_month', 'Monthly Generation Limit', 'Number of itineraries per month', 'ai', 'number'),
  ('ai.itinerary.regenerate', 'Regenerate Itinerary', 'Can regenerate/optimize itineraries', 'ai', 'boolean'),
  ('ai.itinerary.max_regenerations_per_trip', 'Max Regenerations per Trip', 'Regeneration limit per trip', 'ai', 'number'),
  ('ai.itinerary.reasoning', 'AI Reasoning', 'Show why recommendations are made', 'ai', 'boolean'),
  ('ai.dream_quiz', 'Dream Quiz', 'Access to travel personality quiz', 'ai', 'boolean'),
  ('ai.chat_assistant', 'AI Chat Assistant', 'In-product AI assistant', 'ai', 'boolean'),
  
  -- Trip saving
  ('trip.save.enabled', 'Save Trips', 'Can save trip drafts', 'trip', 'boolean'),
  ('trip.save.max_drafts', 'Max Saved Drafts', 'Maximum number of saved drafts', 'trip', 'number'),
  ('trip.export', 'Export Trips', 'Can export trips to PDF/share', 'trip', 'boolean'),
  
  -- Booking (available to all)
  ('booking.flight_search', 'Flight Search', 'Can search flights', 'booking', 'boolean'),
  ('booking.hotel_search', 'Hotel Search', 'Can search hotels', 'booking', 'boolean'),
  ('booking.checkout', 'Checkout', 'Can complete bookings', 'booking', 'boolean'),
  ('booking.price_lock', 'Price Lock', 'Can lock prices temporarily', 'booking', 'boolean'),
  
  -- Enrichment add-on
  ('enrich.venue_details', 'Venue Details', 'Detailed venue information', 'enrich', 'boolean'),
  ('enrich.photos', 'Venue Photos', 'Aggregated venue photos', 'enrich', 'boolean'),
  ('enrich.reviews', 'Venue Reviews', 'Aggregated reviews from multiple sources', 'enrich', 'boolean'),
  ('enrich.live_refresh', 'Live Refresh', 'Background updates and re-fetch on demand', 'enrich', 'boolean'),
  ('enrich.max_venues_per_trip', 'Max Venues per Trip', 'Venue enrichment limit per trip', 'enrich', 'number');

-- Seed FREE plan entitlements
INSERT INTO public.plan_entitlements (plan_id, flag_id, enabled, value_number) VALUES
  -- AI (limited teaser)
  ('free', 'ai.itinerary.generate', true, NULL),
  ('free', 'ai.itinerary.generate_quota_month', true, 1),
  ('free', 'ai.itinerary.regenerate', false, NULL),
  ('free', 'ai.itinerary.max_regenerations_per_trip', false, 0),
  ('free', 'ai.itinerary.reasoning', false, NULL),
  ('free', 'ai.dream_quiz', true, NULL), -- Full quiz for everyone
  ('free', 'ai.chat_assistant', false, NULL),
  -- Trip saving (limited)
  ('free', 'trip.save.enabled', true, NULL),
  ('free', 'trip.save.max_drafts', true, 2),
  ('free', 'trip.export', false, NULL),
  -- Booking (full access)
  ('free', 'booking.flight_search', true, NULL),
  ('free', 'booking.hotel_search', true, NULL),
  ('free', 'booking.checkout', true, NULL),
  ('free', 'booking.price_lock', false, NULL),
  -- Enrichment (none)
  ('free', 'enrich.venue_details', false, NULL),
  ('free', 'enrich.photos', false, NULL),
  ('free', 'enrich.reviews', false, NULL),
  ('free', 'enrich.live_refresh', false, NULL),
  ('free', 'enrich.max_venues_per_trip', false, 0);

-- Seed PAID plan entitlements
INSERT INTO public.plan_entitlements (plan_id, flag_id, enabled, value_number) VALUES
  -- AI (full)
  ('paid', 'ai.itinerary.generate', true, NULL),
  ('paid', 'ai.itinerary.generate_quota_month', true, 999),
  ('paid', 'ai.itinerary.regenerate', true, NULL),
  ('paid', 'ai.itinerary.max_regenerations_per_trip', true, 10),
  ('paid', 'ai.itinerary.reasoning', true, NULL),
  ('paid', 'ai.dream_quiz', true, NULL),
  ('paid', 'ai.chat_assistant', true, NULL),
  -- Trip saving (full)
  ('paid', 'trip.save.enabled', true, NULL),
  ('paid', 'trip.save.max_drafts', true, 50),
  ('paid', 'trip.export', true, NULL),
  -- Booking (full)
  ('paid', 'booking.flight_search', true, NULL),
  ('paid', 'booking.hotel_search', true, NULL),
  ('paid', 'booking.checkout', true, NULL),
  ('paid', 'booking.price_lock', true, NULL),
  -- Enrichment (limited or none - requires add-on)
  ('paid', 'enrich.venue_details', false, NULL),
  ('paid', 'enrich.photos', false, NULL),
  ('paid', 'enrich.reviews', false, NULL),
  ('paid', 'enrich.live_refresh', false, NULL),
  ('paid', 'enrich.max_venues_per_trip', false, 5);

-- Seed ADD-ON entitlements (these override when present)
INSERT INTO public.plan_entitlements (plan_id, flag_id, enabled, value_number) VALUES
  ('addon_voyagermaps', 'enrich.venue_details', true, NULL),
  ('addon_voyagermaps', 'enrich.photos', true, NULL),
  ('addon_voyagermaps', 'enrich.reviews', true, NULL),
  ('addon_voyagermaps', 'enrich.live_refresh', true, NULL),
  ('addon_voyagermaps', 'enrich.max_venues_per_trip', true, 50);

-- Add triggers for updated_at
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_entitlements_updated_at BEFORE UPDATE ON public.plan_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_entitlement_overrides_updated_at BEFORE UPDATE ON public.user_entitlement_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_usage_updated_at BEFORE UPDATE ON public.user_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();