-- Add missing user identity fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Comment explaining the relationship
COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users. The id column matches auth.users.id. Email is denormalized here for display purposes.';