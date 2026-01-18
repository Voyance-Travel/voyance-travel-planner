-- Add notification preference columns to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_notifications boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS marketing_emails boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trip_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS price_alerts boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS phone_number text;