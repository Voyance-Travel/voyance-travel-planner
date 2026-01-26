-- Create consent_records table to track user consent for GDPR/CCPA compliance
CREATE TABLE public.consent_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL, -- 'cookies', 'marketing', 'data_processing', etc.
  consent_version TEXT NOT NULL, -- Version of the consent policy
  preferences JSONB, -- Detailed preferences (analytics, marketing, etc.)
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE, -- If consent was later revoked
  ip_hash TEXT, -- Optional: hashed IP for record-keeping
  user_agent TEXT, -- Optional: browser/device info
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint per user and consent type
  CONSTRAINT consent_records_user_type_unique UNIQUE (user_id, consent_type)
);

-- Enable Row Level Security
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own consent records
CREATE POLICY "Users can view their own consent records" 
ON public.consent_records 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own consent records
CREATE POLICY "Users can insert their own consent records" 
ON public.consent_records 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own consent records
CREATE POLICY "Users can update their own consent records" 
ON public.consent_records 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Create index for efficient lookups
CREATE INDEX idx_consent_records_user_id ON public.consent_records(user_id);
CREATE INDEX idx_consent_records_type ON public.consent_records(consent_type);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_consent_records_updated_at
BEFORE UPDATE ON public.consent_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.consent_records IS 'Stores user consent records for GDPR/CCPA compliance. Tracks cookie preferences, marketing consent, etc.';