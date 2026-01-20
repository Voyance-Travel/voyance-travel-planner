-- Add intake form token to agency_accounts for public intake forms
ALTER TABLE public.agency_accounts 
ADD COLUMN IF NOT EXISTS intake_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS intake_enabled BOOLEAN DEFAULT false;

-- Create index for token lookup
CREATE INDEX IF NOT EXISTS idx_agency_accounts_intake_token 
ON public.agency_accounts(intake_token) WHERE intake_token IS NOT NULL;

-- Function to generate intake token
CREATE OR REPLACE FUNCTION public.generate_intake_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
BEGIN
  token := 'intake_';
  FOR i IN 1..10 LOOP
    token := token || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN token;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- RLS policy: Allow public to view account by intake token (for form context)
CREATE POLICY "Public can view account by intake token"
ON public.agency_accounts
FOR SELECT
USING (intake_enabled = true AND intake_token IS NOT NULL);

-- RLS policy: Allow public insert of travelers when intake is enabled
-- First need to temporarily drop the foreign key check or use a service role
-- Instead, we'll create a secure function for public intake

-- Create a secure intake function that handles the insert
CREATE OR REPLACE FUNCTION public.submit_client_intake(
  p_intake_token TEXT,
  p_legal_first_name TEXT,
  p_legal_last_name TEXT,
  p_preferred_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_passport_country TEXT DEFAULT NULL,
  p_passport_expiry DATE DEFAULT NULL,
  p_seat_preference TEXT DEFAULT NULL,
  p_meal_preference TEXT DEFAULT NULL,
  p_dietary_restrictions TEXT[] DEFAULT NULL,
  p_allergies TEXT[] DEFAULT NULL,
  p_mobility_needs TEXT DEFAULT NULL,
  p_medical_notes TEXT DEFAULT NULL,
  p_emergency_contact JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
  v_traveler_id UUID;
BEGIN
  -- Find the account by intake token
  SELECT id, agent_id, name INTO v_account
  FROM public.agency_accounts
  WHERE intake_token = p_intake_token
    AND intake_enabled = true;
  
  IF v_account.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired intake link');
  END IF;
  
  -- Check if traveler with same email already exists for this account
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_traveler_id
    FROM public.agency_travelers
    WHERE account_id = v_account.id AND email = p_email;
    
    IF v_traveler_id IS NOT NULL THEN
      -- Update existing traveler
      UPDATE public.agency_travelers SET
        legal_first_name = COALESCE(p_legal_first_name, legal_first_name),
        legal_last_name = COALESCE(p_legal_last_name, legal_last_name),
        preferred_name = COALESCE(p_preferred_name, preferred_name),
        phone = COALESCE(p_phone, phone),
        date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
        gender = COALESCE(p_gender, gender),
        passport_country = COALESCE(p_passport_country, passport_country),
        passport_expiry = COALESCE(p_passport_expiry, passport_expiry),
        seat_preference = COALESCE(p_seat_preference, seat_preference),
        meal_preference = COALESCE(p_meal_preference, meal_preference),
        dietary_restrictions = COALESCE(p_dietary_restrictions, dietary_restrictions),
        allergies = COALESCE(p_allergies, allergies),
        mobility_needs = COALESCE(p_mobility_needs, mobility_needs),
        medical_notes = COALESCE(p_medical_notes, medical_notes),
        emergency_contact = COALESCE(p_emergency_contact, emergency_contact),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
      WHERE id = v_traveler_id;
      
      RETURN jsonb_build_object('success', true, 'traveler_id', v_traveler_id, 'updated', true);
    END IF;
  END IF;
  
  -- Insert new traveler
  INSERT INTO public.agency_travelers (
    account_id, agent_id, legal_first_name, legal_last_name, preferred_name,
    email, phone, date_of_birth, gender, passport_country, passport_expiry,
    seat_preference, meal_preference, dietary_restrictions, allergies,
    mobility_needs, medical_notes, emergency_contact, notes, is_primary_contact
  ) VALUES (
    v_account.id, v_account.agent_id, p_legal_first_name, p_legal_last_name, p_preferred_name,
    p_email, p_phone, p_date_of_birth, p_gender, p_passport_country, p_passport_expiry,
    p_seat_preference, p_meal_preference, p_dietary_restrictions, p_allergies,
    p_mobility_needs, p_medical_notes, p_emergency_contact, p_notes, false
  ) RETURNING id INTO v_traveler_id;
  
  RETURN jsonb_build_object('success', true, 'traveler_id', v_traveler_id, 'updated', false);
END;
$$;