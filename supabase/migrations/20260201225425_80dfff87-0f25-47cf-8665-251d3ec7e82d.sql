-- Create trip_notifications table for tracking email sends
CREATE TABLE IF NOT EXISTS public.trip_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_trip_notification UNIQUE (trip_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.trip_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own trip notifications"
ON public.trip_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can manage all notifications (for cron jobs)
CREATE POLICY "Service role can manage all notifications"
ON public.trip_notifications
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create index for efficient lookups
CREATE INDEX idx_trip_notifications_trip_id ON public.trip_notifications(trip_id);
CREATE INDEX idx_trip_notifications_type_sent ON public.trip_notifications(notification_type, sent);

-- Add trigger for updated_at
CREATE TRIGGER update_trip_notifications_updated_at
BEFORE UPDATE ON public.trip_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();