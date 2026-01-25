-- Add social_energy column to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS social_energy text;