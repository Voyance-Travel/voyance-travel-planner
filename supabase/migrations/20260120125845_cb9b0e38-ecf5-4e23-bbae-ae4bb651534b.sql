-- Add commission_split_config to user_preferences for host agency split tracking
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS commission_split_config JSONB DEFAULT '{"is_host_agency": false, "host_agency_split_percent": 20, "agent_split_percent": 80, "payout_method": "via_host", "split_applies_to": "all"}'::jsonb;