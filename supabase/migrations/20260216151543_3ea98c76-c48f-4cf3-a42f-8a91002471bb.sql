-- Enable realtime for trip_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_notifications;

-- Add a 'read' column so users can mark notifications as read (currently only 'sent' exists)
ALTER TABLE public.trip_notifications ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;

-- Add a 'scheduled_for' column for compatibility with NotificationBell display
ALTER TABLE public.trip_notifications ADD COLUMN IF NOT EXISTS scheduled_for timestamptz DEFAULT now();

-- Create a trigger function to auto-create notifications when a member joins a trip
CREATE OR REPLACE FUNCTION public.notify_trip_members_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trip record;
  v_new_member_name text;
  v_member record;
BEGIN
  -- Only fire when accepted_at is set (not on initial insert without acceptance)
  IF NEW.accepted_at IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip if this is an update and accepted_at didn't change
  IF TG_OP = 'UPDATE' AND OLD.accepted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get trip info
  SELECT id, name, destination, user_id INTO v_trip
  FROM public.trips WHERE id = NEW.trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get new member's name
  SELECT COALESCE(display_name, split_part(u.email, '@', 1)) INTO v_new_member_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = NEW.user_id;

  v_new_member_name := COALESCE(v_new_member_name, 'A new traveler');

  -- Notify trip owner
  IF v_trip.user_id != NEW.user_id THEN
    INSERT INTO public.trip_notifications (trip_id, user_id, notification_type, scheduled_for, metadata)
    VALUES (
      NEW.trip_id,
      v_trip.user_id,
      'member_joined',
      now(),
      jsonb_build_object(
        'title', 'New trip member',
        'message', v_new_member_name || ' joined your trip to ' || COALESCE(v_trip.destination, v_trip.name) || '.',
        'memberName', v_new_member_name,
        'memberId', NEW.user_id,
        'tripName', v_trip.name
      )
    );
  END IF;

  -- Notify existing collaborators
  FOR v_member IN
    SELECT tc.user_id FROM public.trip_collaborators tc
    WHERE tc.trip_id = NEW.trip_id
      AND tc.accepted_at IS NOT NULL
      AND tc.user_id != NEW.user_id
      AND tc.user_id != v_trip.user_id
  LOOP
    INSERT INTO public.trip_notifications (trip_id, user_id, notification_type, scheduled_for, metadata)
    VALUES (
      NEW.trip_id,
      v_member.user_id,
      'member_joined',
      now(),
      jsonb_build_object(
        'title', 'New trip member',
        'message', v_new_member_name || ' joined the trip to ' || COALESCE(v_trip.destination, v_trip.name) || '.',
        'memberName', v_new_member_name,
        'memberId', NEW.user_id,
        'tripName', v_trip.name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach trigger to trip_collaborators
DROP TRIGGER IF EXISTS trigger_notify_on_member_join ON public.trip_collaborators;
CREATE TRIGGER trigger_notify_on_member_join
  AFTER INSERT OR UPDATE ON public.trip_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_trip_members_on_join();

-- Add UPDATE policy so users can mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
  ON public.trip_notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
