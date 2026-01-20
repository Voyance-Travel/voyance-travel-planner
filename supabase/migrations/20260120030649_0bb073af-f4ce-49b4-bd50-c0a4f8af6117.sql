-- =============================================
-- TRAVEL AGENCY CRM - FULL NORMALIZED SCHEMA
-- =============================================

-- Custom types for the CRM
CREATE TYPE agency_account_type AS ENUM ('individual', 'household', 'company');
CREATE TYPE booking_segment_type AS ENUM ('flight', 'hotel', 'transfer', 'rail', 'tour', 'cruise', 'insurance', 'car_rental', 'other');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'ticketed', 'cancelled', 'refunded', 'no_show');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded');
CREATE TYPE payment_method AS ENUM ('credit_card', 'bank_transfer', 'check', 'cash', 'stripe', 'other');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE document_type AS ENUM ('passport', 'visa', 'insurance', 'confirmation', 'invoice', 'receipt', 'waiver', 'itinerary', 'other');
CREATE TYPE communication_type AS ENUM ('email', 'sms', 'call', 'note', 'approval');

-- =============================================
-- 1. ACCOUNTS (who's paying / company / household)
-- =============================================
CREATE TABLE agency_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type agency_account_type NOT NULL DEFAULT 'individual',
  name TEXT NOT NULL,
  company_name TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  billing_address JSONB,
  notes TEXT,
  tags TEXT[],
  total_trips INTEGER DEFAULT 0,
  total_revenue_cents BIGINT DEFAULT 0,
  lifetime_value_cents BIGINT DEFAULT 0,
  referral_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 2. TRAVELERS (individual people who travel)
-- =============================================
CREATE TABLE agency_travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Identity (critical for bookings)
  legal_first_name TEXT NOT NULL,
  legal_middle_name TEXT,
  legal_last_name TEXT NOT NULL,
  preferred_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  -- Contact
  email TEXT,
  phone TEXT,
  -- Travel documents
  passport_number TEXT,
  passport_country TEXT,
  passport_expiry DATE,
  known_traveler_number TEXT,
  redress_number TEXT,
  global_entry_number TEXT,
  -- Preferences
  seat_preference TEXT,
  meal_preference TEXT,
  hotel_preferences JSONB,
  airline_loyalty JSONB, -- [{airline, number, tier}]
  hotel_loyalty JSONB,
  -- Medical / accessibility
  dietary_restrictions TEXT[],
  allergies TEXT[],
  mobility_needs TEXT,
  medical_notes TEXT,
  emergency_contact JSONB, -- {name, phone, relationship}
  -- Metadata
  notes TEXT,
  is_primary_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 3. AGENCY TRIPS (the container for bookings)
-- =============================================
CREATE TABLE agency_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  -- Trip basics
  name TEXT NOT NULL,
  description TEXT,
  destination TEXT,
  destinations JSONB, -- For multi-city
  start_date DATE,
  end_date DATE,
  -- Status / pipeline
  status TEXT DEFAULT 'inquiry', -- inquiry, discovery, quoted, deposit_paid, booked, final_paid, traveling, completed
  pipeline_stage INTEGER DEFAULT 1,
  -- Financials summary
  total_cost_cents BIGINT DEFAULT 0,
  total_paid_cents BIGINT DEFAULT 0,
  total_commission_cents BIGINT DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  -- Metadata
  trip_type TEXT, -- honeymoon, family, corporate, group, cruise, etc.
  traveler_count INTEGER DEFAULT 1,
  notes TEXT,
  internal_notes TEXT,
  tags TEXT[],
  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: which travelers are on which trip
CREATE TABLE agency_trip_travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES agency_trips(id) ON DELETE CASCADE,
  traveler_id UUID NOT NULL REFERENCES agency_travelers(id) ON DELETE CASCADE,
  is_lead_traveler BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, traveler_id)
);

-- =============================================
-- 4. BOOKING SEGMENTS (flights, hotels, etc.)
-- =============================================
CREATE TABLE agency_booking_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES agency_trips(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Segment type
  segment_type booking_segment_type NOT NULL,
  -- Status
  status booking_status DEFAULT 'pending',
  -- Core details (universal)
  vendor_name TEXT,
  vendor_code TEXT, -- airline code, hotel chain code
  confirmation_number TEXT,
  booking_reference TEXT,
  -- Dates/times
  start_date DATE,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  -- Location
  origin TEXT,
  origin_code TEXT,
  destination TEXT,
  destination_code TEXT,
  -- Flight-specific
  flight_number TEXT,
  cabin_class TEXT,
  aircraft_type TEXT,
  -- Hotel-specific
  room_type TEXT,
  room_count INTEGER,
  check_in_time TEXT,
  check_out_time TEXT,
  -- Financials
  net_cost_cents BIGINT DEFAULT 0,
  sell_price_cents BIGINT DEFAULT 0,
  commission_cents BIGINT DEFAULT 0,
  commission_rate DECIMAL(5,2),
  currency TEXT DEFAULT 'USD',
  -- Deadlines
  ticketing_deadline TIMESTAMPTZ,
  payment_deadline TIMESTAMPTZ,
  cancellation_deadline TIMESTAMPTZ,
  -- Cancellation terms
  cancellation_policy TEXT,
  penalty_amount_cents BIGINT,
  is_refundable BOOLEAN DEFAULT true,
  -- Supplier details
  supplier_id UUID,
  supplier_contact TEXT,
  -- Additional data
  travelers_on_segment UUID[], -- array of traveler IDs
  segment_details JSONB, -- flexible for segment-specific data
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 5. QUOTES (with versioning)
-- =============================================
CREATE TABLE agency_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES agency_trips(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Version tracking
  version_number INTEGER NOT NULL DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,
  parent_quote_id UUID REFERENCES agency_quotes(id),
  -- Quote details
  name TEXT, -- "Option A - Luxury", "Option B - Budget"
  description TEXT,
  -- Status
  status quote_status DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT, -- client name/email who approved
  expires_at TIMESTAMPTZ,
  -- Financials
  subtotal_cents BIGINT DEFAULT 0,
  agency_fee_cents BIGINT DEFAULT 0,
  discount_cents BIGINT DEFAULT 0,
  tax_cents BIGINT DEFAULT 0,
  total_cents BIGINT DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  -- Quote content snapshot
  line_items JSONB, -- snapshot of segments/services at quote time
  terms_and_conditions TEXT,
  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 6. INVOICES
-- =============================================
CREATE TABLE agency_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES agency_trips(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES agency_quotes(id),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  -- Invoice details
  invoice_number TEXT UNIQUE NOT NULL,
  status invoice_status DEFAULT 'draft',
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_date DATE,
  -- Amounts
  subtotal_cents BIGINT DEFAULT 0,
  agency_fee_cents BIGINT DEFAULT 0,
  discount_cents BIGINT DEFAULT 0,
  tax_cents BIGINT DEFAULT 0,
  total_cents BIGINT DEFAULT 0,
  amount_paid_cents BIGINT DEFAULT 0,
  balance_due_cents BIGINT DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  -- Line items
  line_items JSONB, -- [{description, quantity, unit_price, total}]
  -- Payment info
  payment_instructions TEXT,
  stripe_invoice_id TEXT,
  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 7. PAYMENTS
-- =============================================
CREATE TABLE agency_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES agency_invoices(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES agency_trips(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Payment details
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method payment_method NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- External references
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  transaction_reference TEXT,
  -- Status
  status TEXT DEFAULT 'completed', -- pending, completed, failed, refunded
  refund_amount_cents BIGINT DEFAULT 0,
  refunded_at TIMESTAMPTZ,
  -- Metadata
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 8. PAYMENT SCHEDULES (deposits, final payment)
-- =============================================
CREATE TABLE agency_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES agency_trips(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES agency_invoices(id),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Schedule details
  description TEXT NOT NULL, -- "Initial Deposit", "Final Payment"
  amount_cents BIGINT NOT NULL,
  due_date DATE NOT NULL,
  -- Status
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES agency_payments(id),
  -- Reminders
  reminder_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 9. TASKS / DEADLINES
-- =============================================
CREATE TABLE agency_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES agency_trips(id) ON DELETE CASCADE,
  account_id UUID REFERENCES agency_accounts(id),
  traveler_id UUID REFERENCES agency_travelers(id),
  booking_segment_id UUID REFERENCES agency_booking_segments(id),
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority DEFAULT 'medium',
  status task_status DEFAULT 'pending',
  -- Dates
  due_date DATE,
  due_time TIME,
  completed_at TIMESTAMPTZ,
  -- Auto-generated task types
  task_type TEXT, -- 'final_payment', 'ticketing_deadline', 'passport_expiry', 'visa_deadline', 'name_check', 'manual'
  is_system_generated BOOLEAN DEFAULT false,
  -- Reminders
  reminder_date TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT false,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 10. DOCUMENTS
-- =============================================
CREATE TABLE agency_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES agency_trips(id) ON DELETE CASCADE,
  account_id UUID REFERENCES agency_accounts(id),
  traveler_id UUID REFERENCES agency_travelers(id),
  -- Document details
  document_type document_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- File storage
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  -- Expiration (for passports, visas, insurance)
  expires_at DATE,
  -- Client visibility
  is_client_visible BOOLEAN DEFAULT false,
  -- Metadata
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 11. COMMUNICATIONS LOG
-- =============================================
CREATE TABLE agency_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES agency_trips(id) ON DELETE CASCADE,
  account_id UUID REFERENCES agency_accounts(id),
  traveler_id UUID REFERENCES agency_travelers(id),
  -- Communication details
  communication_type communication_type NOT NULL,
  subject TEXT,
  body TEXT,
  -- For emails
  from_address TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  -- Status
  is_incoming BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  -- Approval tracking
  is_approval BOOLEAN DEFAULT false,
  approval_response TEXT, -- 'approved', 'rejected'
  approved_item_reference TEXT,
  -- Metadata
  external_message_id TEXT,
  template_used TEXT,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 12. SUPPLIERS / VENDORS
-- =============================================
CREATE TABLE agency_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Supplier details
  name TEXT NOT NULL,
  supplier_type TEXT, -- airline, hotel, dmc, cruise_line, tour_op, insurance
  code TEXT, -- airline code, hotel chain code
  -- Contact
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  website TEXT,
  -- Commission terms
  default_commission_rate DECIMAL(5,2),
  payment_terms TEXT,
  -- Notes
  notes TEXT,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE agency_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_travelers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_trip_travelers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_booking_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_suppliers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - Agents can only access their own data
-- =============================================

-- Accounts
CREATE POLICY "Agents can manage their own accounts" ON agency_accounts
  FOR ALL USING (agent_id = auth.uid());

-- Travelers
CREATE POLICY "Agents can manage their own travelers" ON agency_travelers
  FOR ALL USING (agent_id = auth.uid());

-- Trips
CREATE POLICY "Agents can manage their own trips" ON agency_trips
  FOR ALL USING (agent_id = auth.uid());

-- Trip Travelers (via trip ownership)
CREATE POLICY "Agents can manage trip travelers" ON agency_trip_travelers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM agency_trips WHERE id = trip_id AND agent_id = auth.uid())
  );

-- Booking Segments
CREATE POLICY "Agents can manage their own segments" ON agency_booking_segments
  FOR ALL USING (agent_id = auth.uid());

-- Quotes
CREATE POLICY "Agents can manage their own quotes" ON agency_quotes
  FOR ALL USING (agent_id = auth.uid());

-- Invoices
CREATE POLICY "Agents can manage their own invoices" ON agency_invoices
  FOR ALL USING (agent_id = auth.uid());

-- Payments
CREATE POLICY "Agents can manage their own payments" ON agency_payments
  FOR ALL USING (agent_id = auth.uid());

-- Payment Schedules
CREATE POLICY "Agents can manage their own payment schedules" ON agency_payment_schedules
  FOR ALL USING (agent_id = auth.uid());

-- Tasks
CREATE POLICY "Agents can manage their own tasks" ON agency_tasks
  FOR ALL USING (agent_id = auth.uid());

-- Documents
CREATE POLICY "Agents can manage their own documents" ON agency_documents
  FOR ALL USING (agent_id = auth.uid());

-- Communications
CREATE POLICY "Agents can manage their own communications" ON agency_communications
  FOR ALL USING (agent_id = auth.uid());

-- Suppliers
CREATE POLICY "Agents can manage their own suppliers" ON agency_suppliers
  FOR ALL USING (agent_id = auth.uid());

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_agency_accounts_agent ON agency_accounts(agent_id);
CREATE INDEX idx_agency_travelers_account ON agency_travelers(account_id);
CREATE INDEX idx_agency_travelers_agent ON agency_travelers(agent_id);
CREATE INDEX idx_agency_trips_agent ON agency_trips(agent_id);
CREATE INDEX idx_agency_trips_account ON agency_trips(account_id);
CREATE INDEX idx_agency_trips_status ON agency_trips(status);
CREATE INDEX idx_agency_booking_segments_trip ON agency_booking_segments(trip_id);
CREATE INDEX idx_agency_quotes_trip ON agency_quotes(trip_id);
CREATE INDEX idx_agency_invoices_trip ON agency_invoices(trip_id);
CREATE INDEX idx_agency_invoices_status ON agency_invoices(status);
CREATE INDEX idx_agency_tasks_agent ON agency_tasks(agent_id);
CREATE INDEX idx_agency_tasks_due ON agency_tasks(due_date) WHERE status = 'pending';
CREATE INDEX idx_agency_documents_trip ON agency_documents(trip_id);
CREATE INDEX idx_agency_communications_trip ON agency_communications(trip_id);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================
CREATE TRIGGER update_agency_accounts_updated_at
  BEFORE UPDATE ON agency_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_travelers_updated_at
  BEFORE UPDATE ON agency_travelers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_trips_updated_at
  BEFORE UPDATE ON agency_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_booking_segments_updated_at
  BEFORE UPDATE ON agency_booking_segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_quotes_updated_at
  BEFORE UPDATE ON agency_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_invoices_updated_at
  BEFORE UPDATE ON agency_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_payment_schedules_updated_at
  BEFORE UPDATE ON agency_payment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_tasks_updated_at
  BEFORE UPDATE ON agency_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_suppliers_updated_at
  BEFORE UPDATE ON agency_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELPER FUNCTION: Generate invoice number
-- =============================================
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := to_char(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_num
  FROM agency_invoices
  WHERE invoice_number LIKE year_prefix || '-%';
  
  RETURN year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$;