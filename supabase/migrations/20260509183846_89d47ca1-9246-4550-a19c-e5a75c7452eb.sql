ALTER TABLE public.trip_notifications
  ADD COLUMN IF NOT EXISTS sent_date date NOT NULL DEFAULT CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_notifications_unique_per_day
  ON public.trip_notifications (trip_id, user_id, notification_type, sent_date);