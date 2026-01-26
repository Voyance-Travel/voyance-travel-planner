-- Fix trip_invites RLS policy to prevent token enumeration
-- The broad "Anyone can view invites by token" USING (true) policy is overly permissive
-- All guest flows use SECURITY DEFINER RPCs which bypass RLS anyway
-- Trip owners already have full access via "Trip owners can manage invites" policy

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view invites by token" ON public.trip_invites;

-- Add a more restrictive policy: authenticated users can see their own invites
-- (invites where they are the inviter OR invites addressed to their email)
CREATE POLICY "Users can view their own invites"
ON public.trip_invites
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    invited_by = auth.uid() OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Update accept_trip_invite function to use standardized search_path
CREATE OR REPLACE FUNCTION public.accept_trip_invite(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public
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
  SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token;
  
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
  SELECT * INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
  END IF;
  
  -- Check if user is already trip owner
  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the owner of this trip');
  END IF;
  
  -- Check current member count vs travelers limit
  SELECT COUNT(*) INTO v_current_members 
  FROM public.trip_collaborators 
  WHERE trip_id = v_invite.trip_id AND accepted_at IS NOT NULL;
  
  v_max_members := COALESCE(v_trip.travelers, 1) - 1; -- minus the owner
  
  IF v_current_members >= v_max_members THEN
    RETURN jsonb_build_object('success', false, 'error', 'This trip has reached its maximum number of travelers');
  END IF;
  
  -- Check if already a collaborator
  IF EXISTS (
    SELECT 1 FROM public.trip_collaborators 
    WHERE trip_id = v_invite.trip_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this trip');
  END IF;
  
  -- Add as collaborator
  INSERT INTO public.trip_collaborators (trip_id, user_id, permission, invited_by, accepted_at)
  VALUES (v_invite.trip_id, v_user_id, 'view', v_invite.invited_by, now())
  ON CONFLICT (trip_id, user_id) DO UPDATE SET accepted_at = now();
  
  -- Also add as trip member
  INSERT INTO public.trip_members (trip_id, user_id, email, name, role, accepted_at)
  SELECT 
    v_invite.trip_id, 
    v_user_id, 
    u.email, 
    COALESCE(p.display_name, split_part(u.email, '@', 1)),
    'attendee',
    now()
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_user_id
  ON CONFLICT (trip_id, email) DO UPDATE SET 
    user_id = v_user_id,
    accepted_at = now();
  
  -- Create friend connection if not exists
  INSERT INTO public.friends (user_id, friend_id, status)
  VALUES (v_invite.invited_by, v_user_id, 'approved')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.friends (user_id, friend_id, status)
  VALUES (v_user_id, v_invite.invited_by, 'approved')
  ON CONFLICT DO NOTHING;
  
  -- Mark invite as used
  UPDATE public.trip_invites 
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

-- Update get_trip_invite_info function with standardized search_path
CREATE OR REPLACE FUNCTION public.get_trip_invite_info(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invite record;
  v_trip record;
  v_inviter record;
  v_current_members integer;
  v_max_members integer;
BEGIN
  -- Get the invite
  SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token;
  
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
  SELECT * INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Trip not found');
  END IF;
  
  -- Get inviter info (only display_name and avatar, no email)
  SELECT display_name, avatar_url INTO v_inviter 
  FROM public.profiles WHERE id = v_invite.invited_by;
  
  -- Check member count
  SELECT COUNT(*) INTO v_current_members 
  FROM public.trip_collaborators 
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