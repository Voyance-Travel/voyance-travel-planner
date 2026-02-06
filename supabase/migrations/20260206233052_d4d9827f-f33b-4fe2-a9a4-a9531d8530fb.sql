
-- Analytics event tracking table
CREATE TABLE public.page_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID,
  event_type TEXT NOT NULL, -- 'page_view', 'click', 'scroll', 'form_start', 'form_submit', 'search', 'modal_open', 'cta_click'
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  event_data JSONB DEFAULT '{}',
  element_id TEXT, -- for click events
  element_text TEXT, -- button label etc
  scroll_depth INTEGER, -- 0-100
  time_on_page_ms INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for admin queries
CREATE INDEX idx_page_events_session ON public.page_events(session_id);
CREATE INDEX idx_page_events_created ON public.page_events(created_at DESC);
CREATE INDEX idx_page_events_page_path ON public.page_events(page_path);
CREATE INDEX idx_page_events_event_type ON public.page_events(event_type);
CREATE INDEX idx_page_events_user_id ON public.page_events(user_id);

-- Enable RLS
ALTER TABLE public.page_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous + authenticated)
CREATE POLICY "Anyone can insert page events"
  ON public.page_events FOR INSERT
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read page events"
  ON public.page_events FOR SELECT
  USING (public.has_role('admin'));

-- No update/delete needed
