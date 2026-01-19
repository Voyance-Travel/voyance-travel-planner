-- Add budget_alerts preference column to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS budget_alerts boolean DEFAULT true;