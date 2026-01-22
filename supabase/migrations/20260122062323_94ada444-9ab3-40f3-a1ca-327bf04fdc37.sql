-- Trip invites table for shareable invite links
CREATE TABLE IF NOT EXISTS public.trip_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT generate_share_token(),
  email TEXT, -- optional: if sent to specific email
  role TEXT NOT NULL DEFAULT 'attendee', -- 'attendee', 'organizer'
  max_uses INTEGER DEFAULT 1, -- how many times this link can be used
  uses_count INTEGER DEFAULT 0, -- current usage count
  expires_at TIMESTAMPTZ, -- optional expiration
  accepted_at TIMESTAMPTZ, -- when someone accepted
  accepted_by UUID REFERENCES auth.users(id), -- who accepted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique active invite per email per trip
  CONSTRAINT unique_active_email_invite UNIQUE NULLS NOT DISTINCT (trip_id, email)
);

-- Index for token lookup
CREATE INDEX idx_trip_invites_token ON public.trip_invites(token);

-- Enable RLS
ALTER TABLE public.trip_invites ENABLE ROW LEVEL SECURITY;

-- Trip owners can manage invites
CREATE POLICY "Trip owners can manage invites"
ON public.trip_invites
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()
  )
);

-- Anyone can view an invite by token (needed for accept flow)
CREATE POLICY "Anyone can view invites by token"
ON public.trip_invites
FOR SELECT
USING (true);

-- Function to accept a trip invite
CREATE OR REPLACE FUNCTION public.accept_trip_invite(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_trip record;
  v_current_members integer;
  v_max_members integer;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated', 'requiresAuth', true);
  END IF;
  
  -- Get the invite
  SELECT * INTO v_invite FROM trip_invites WHERE token = p_token;
  
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite link');
  END IF;
  
  -- Check if already accepted
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has already been used');
  END IF;
  
  -- Check uses count
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite link has reached its maximum uses');
  END IF;
  
  -- Check expiration
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has expired');
  END IF;
  
  -- Get the trip
  SELECT * INTO v_trip FROM trips WHERE id = v_invite.trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
  END IF;
  
  -- Check if user is already trip owner
  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the owner of this trip');
  END IF;
  
  -- Check current member count vs travelers limit
  SELECT COUNT(*) INTO v_current_members 
  FROM trip_collaborators 
  WHERE trip_id = v_invite.trip_id AND accepted_at IS NOT NULL;
  
  v_max_members := COALESCE(v_trip.travelers, 1) - 1; -- minus the owner
  
  IF v_current_members >= v_max_members THEN
    RETURN jsonb_build_object('success', false, 'error', 'This trip has reached its maximum number of travelers');
  END IF;
  
  -- Check if already a collaborator
  IF EXISTS (
    SELECT 1 FROM trip_collaborators 
    WHERE trip_id = v_invite.trip_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this trip');
  END IF;
  
  -- Add as collaborator
  INSERT INTO trip_collaborators (trip_id, user_id, permission, invited_by, accepted_at)
  VALUES (v_invite.trip_id, v_user_id, 'view', v_invite.invited_by, now())
  ON CONFLICT (trip_id, user_id) DO UPDATE SET accepted_at = now();
  
  -- Also add as trip member
  INSERT INTO trip_members (trip_id, user_id, email, name, role, accepted_at)
  SELECT 
    v_invite.trip_id, 
    v_user_id, 
    u.email, 
    COALESCE(p.display_name, split_part(u.email, '@', 1)),
    'attendee',
    now()
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = v_user_id
  ON CONFLICT (trip_id, email) DO UPDATE SET 
    user_id = v_user_id,
    accepted_at = now();
  
  -- Create friend connection if not exists
  INSERT INTO friends (user_id, friend_id, status)
  VALUES (v_invite.invited_by, v_user_id, 'approved')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO friends (user_id, friend_id, status)
  VALUES (v_user_id, v_invite.invited_by, 'approved')
  ON CONFLICT DO NOTHING;
  
  -- Mark invite as used
  UPDATE trip_invites 
  SET 
    uses_count = uses_count + 1,
    accepted_at = now(),
    accepted_by = v_user_id
  WHERE id = v_invite.id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'tripId', v_invite.trip_id,
    'tripName', v_trip.name,
    'destination', v_trip.destination
  );
END;
$$;

-- Function to get invite info (for preview before accepting)
CREATE OR REPLACE FUNCTION public.get_trip_invite_info(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite record;
  v_trip record;
  v_inviter record;
  v_current_members integer;
  v_max_members integer;
BEGIN
  -- Get the invite
  SELECT * INTO v_invite FROM trip_invites WHERE token = p_token;
  
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite link');
  END IF;
  
  -- Check if already fully used
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite link is no longer valid');
  END IF;
  
  -- Check expiration
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has expired');
  END IF;
  
  -- Get the trip
  SELECT * INTO v_trip FROM trips WHERE id = v_invite.trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Trip not found');
  END IF;
  
  -- Get inviter info
  SELECT display_name, avatar_url INTO v_inviter 
  FROM profiles WHERE id = v_invite.invited_by;
  
  -- Check member count
  SELECT COUNT(*) INTO v_current_members 
  FROM trip_collaborators 
  WHERE trip_id = v_invite.trip_id AND accepted_at IS NOT NULL;
  
  v_max_members := COALESCE(v_trip.travelers, 1) - 1;
  
  IF v_current_members >= v_max_members THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This trip has reached its maximum number of travelers');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'tripName', v_trip.name,
    'destination', v_trip.destination,
    'startDate', v_trip.start_date,
    'endDate', v_trip.end_date,
    'inviterName', v_inviter.display_name,
    'inviterAvatar', v_inviter.avatar_url,
    'spotsRemaining', v_max_members - v_current_members
  );
END;
$$;