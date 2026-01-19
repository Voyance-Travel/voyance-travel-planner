-- Add unique constraint on handle column to prevent duplicate handles
-- First, check for any existing duplicates and handle them
-- Then add the unique constraint

-- Create unique index on handle (allows NULL - multiple users can have no handle)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique_idx 
ON public.profiles (handle) 
WHERE handle IS NOT NULL;