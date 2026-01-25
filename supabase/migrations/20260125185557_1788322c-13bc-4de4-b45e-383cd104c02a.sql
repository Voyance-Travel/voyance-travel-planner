-- Add preferred_cabin_class column to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS preferred_cabin_class text;