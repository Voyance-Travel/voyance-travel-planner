-- Structured per-day user intent storage. Each user-stated activity, restaurant,
-- avoid, time block, transport need or note becomes ITS OWN row, scoped to a
-- specific day of a specific trip. Replaces ad-hoc parsing of metadata blobs
-- (mustDoActivities / additionalNotes / userIntents / userAnchors / perDayActivities)
-- as the working source of truth for the Day Brief.

CREATE TABLE IF NOT EXISTS public.trip_day_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Day scoping. day_number is the canonical anchor; date is informational and may be null
  -- for trip-wide intents (e.g. "no seafood the whole trip").
  day_number INTEGER,                  -- NULL = trip-wide
  date DATE,                           -- optional informational mirror of itinerary_days.date
  destination TEXT,                    -- optional city for multi-city clarity

  -- Where this intent came from. One of:
  -- chat_planner | fine_tune | manual_paste | manual_add | assistant_chat | pin | edit | system
  source_entry_point TEXT NOT NULL,

  -- What kind of intent. One of:
  -- restaurant | dinner | lunch | breakfast | drinks | activity | event | spa
  -- transport | avoid | constraint | note
  intent_kind TEXT NOT NULL,

  -- The user-facing title (e.g. "Belcanto", "Ramen for dinner", "Avoid seafood").
  title TEXT NOT NULL,

  -- The original raw text the user typed. Preserved for audit & re-parsing.
  raw_text TEXT,

  -- Time hints. start_time / end_time are HH:MM 24h strings.
  start_time TEXT,
  end_time TEXT,

  -- must = AI must include this; should = preference; avoid = AI must not include.
  priority TEXT NOT NULL DEFAULT 'should',

  -- Locked rows are produced by manual paste / manual add / pin / edit. They MUST
  -- never be silently dropped or replaced by AI.
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_source TEXT,                  -- fingerprint matching userAnchors.lockedSource

  -- Lifecycle. The save-itinerary checker updates these.
  -- active     — still needs to land in the itinerary
  -- fulfilled  — matched to an activity in the saved itinerary
  -- superseded — replaced by a newer intent
  -- dismissed  — user said no thanks
  status TEXT NOT NULL DEFAULT 'active',
  fulfilled_activity_id TEXT,          -- itinerary activity id (text — UUID or generated)
  fulfilled_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT trip_day_intents_priority_chk CHECK (priority IN ('must', 'should', 'avoid')),
  CONSTRAINT trip_day_intents_status_chk   CHECK (status IN ('active', 'fulfilled', 'superseded', 'dismissed')),
  CONSTRAINT trip_day_intents_kind_chk     CHECK (intent_kind IN (
    'restaurant','dinner','lunch','breakfast','drinks',
    'activity','event','spa',
    'transport','avoid','constraint','note'
  )),
  CONSTRAINT trip_day_intents_source_chk   CHECK (source_entry_point IN (
    'chat_planner','fine_tune','manual_paste','manual_add','assistant_chat','pin','edit','system'
  ))
);

CREATE INDEX IF NOT EXISTS idx_trip_day_intents_trip_day
  ON public.trip_day_intents(trip_id, day_number)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_trip_day_intents_trip_status
  ON public.trip_day_intents(trip_id, status);

CREATE INDEX IF NOT EXISTS idx_trip_day_intents_locked
  ON public.trip_day_intents(trip_id, locked)
  WHERE locked = true;

-- Soft uniqueness: prevent obvious duplicates of the same intent on the same day
-- from the same source. (locked_source is included so two different anchors with
-- the same title don't collide.) Use lower(title) for case-insensitivity.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_day_intents_dedupe
  ON public.trip_day_intents(
    trip_id,
    COALESCE(day_number, -1),
    source_entry_point,
    intent_kind,
    lower(title),
    COALESCE(locked_source, '')
  )
  WHERE status IN ('active','fulfilled');

ALTER TABLE public.trip_day_intents ENABLE ROW LEVEL SECURITY;

-- View: trip owner OR accepted collaborator.
CREATE POLICY "View trip day intents"
ON public.trip_day_intents FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators tc
    WHERE tc.trip_id = trip_day_intents.trip_id
      AND tc.user_id = auth.uid()
      AND tc.accepted_at IS NOT NULL
  )
);

-- Insert: owner or edit-capable collaborator.
CREATE POLICY "Insert trip day intents"
ON public.trip_day_intents FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators tc
    WHERE tc.trip_id = trip_day_intents.trip_id
      AND tc.user_id = auth.uid()
      AND tc.accepted_at IS NOT NULL
      AND tc.permission IN ('edit','admin','editor','contributor')
  )
);

-- Update: owner or edit-capable collaborator.
CREATE POLICY "Update trip day intents"
ON public.trip_day_intents FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators tc
    WHERE tc.trip_id = trip_day_intents.trip_id
      AND tc.user_id = auth.uid()
      AND tc.accepted_at IS NOT NULL
      AND tc.permission IN ('edit','admin','editor','contributor')
  )
);

-- Delete: owner only.
CREATE POLICY "Delete trip day intents"
ON public.trip_day_intents FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
);

CREATE TRIGGER update_trip_day_intents_updated_at
BEFORE UPDATE ON public.trip_day_intents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();