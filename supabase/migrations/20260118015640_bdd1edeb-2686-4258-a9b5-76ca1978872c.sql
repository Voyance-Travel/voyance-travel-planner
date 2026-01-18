-- Tighten RLS on profiles: explicitly restrict to authenticated role

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile and friends profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- SELECT: only authenticated users, and only self or accepted friends
CREATE POLICY "Users can view own profile and friends profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id)
  OR EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE friendships.status = 'accepted'::friendship_status
      AND (
        (friendships.requester_id = auth.uid() AND friendships.addressee_id = profiles.id)
        OR
        (friendships.addressee_id = auth.uid() AND friendships.requester_id = profiles.id)
      )
  )
);

-- INSERT: only authenticated users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- UPDATE: only authenticated users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
