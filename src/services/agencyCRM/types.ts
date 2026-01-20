// Travel Agency CRM Types

export type AgencyAccountType = 'individual' | 'household' | 'company';
export type BookingSegmentType = 'flight' | 'hotel' | 'transfer' | 'rail' | 'tour' | 'cruise' | 'insurance' | 'car_rental' | 'other';
export type BookingStatus = 'pending' | 'confirmed' | 'ticketed' | 'cancelled' | 'refunded' | 'no_show';
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'check' | 'cash' | 'stripe' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type DocumentType = 'passport' | 'visa' | 'insurance' | 'confirmation' | 'invoice' | 'receipt' | 'waiver' | 'itinerary' | 'other';
export type CommunicationType = 'email' | 'sms' | 'call' | 'note' | 'approval';

// Settlement type for travel subledger
// Drives: A/R (client balance), A/P (vendor balance), Commission tracking
export type BookingSettlementType = 'arc_bsp' | 'supplier_direct' | 'commission_track';

// Booking source - tracks how the booking was created
// Mode 1: native_api (Viator, future API bookings)
// Mode 2: imported (agent booked externally, imported confirmation)
// Mode 3: client_booked (informational - client booked themselves)
// Default: manual (entered by hand)
export type BookingSource = 'native_api' | 'imported' | 'client_booked' | 'manual';

export interface AgencyAccount {
  id: string;
  agent_id: string;
  account_type: AgencyAccountType;
  name: string;
  company_name?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  notes?: string;
  tags?: string[];
  total_trips: number;
  total_revenue_cents: number;
  lifetime_value_cents: number;
  referral_source?: string;
  // Intake form
  intake_token?: string;
  intake_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgencyTraveler {
  id: string;
  account_id: string;
  agent_id: string;
  // Identity
  legal_first_name: string;
  legal_middle_name?: string;
  legal_last_name: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: string;
  // Contact
  email?: string;
  phone?: string;
  // Travel documents
  passport_number?: string;
  passport_country?: string;
  passport_expiry?: string;
  known_traveler_number?: string;
  redress_number?: string;
  global_entry_number?: string;
  // Preferences
  seat_preference?: string;
  meal_preference?: string;
  hotel_preferences?: Record<string, unknown>;
  airline_loyalty?: Array<{ airline: string; number: string; tier?: string }>;
  hotel_loyalty?: Array<{ chain: string; number: string; tier?: string }>;
  // Medical / accessibility
  dietary_restrictions?: string[];
  allergies?: string[];
  mobility_needs?: string;
  medical_notes?: string;
  emergency_contact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  notes?: string;
  is_primary_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgencyTrip {
  id: string;
  agent_id: string;
  account_id: string;
  name: string;
  description?: string;
  destination?: string;
  destinations?: string[];
  start_date?: string;
  end_date?: string;
  status: string;
  pipeline_stage: number;
  total_cost_cents: number;
  total_paid_cents: number;
  total_commission_cents: number;
  currency: string;
  trip_type?: string;
  traveler_count: number;
  notes?: string;
  internal_notes?: string;
  tags?: string[];
  share_token?: string;
  share_enabled?: boolean;
  itinerary_data?: {
    days?: Array<{
      dayNumber: number;
      date?: string;
      title?: string;
      theme?: string;
      activities: Array<{
        id: string;
        title: string;
        description?: string;
        startTime?: string;
        time?: string;
        type?: string;
        location?: { name?: string; address?: string };
      }>;
    }>;
  };
  created_at: string;
  updated_at: string;
  // Joined data
  account?: AgencyAccount;
  travelers?: AgencyTraveler[];
  segments?: BookingSegment[];
}

export interface BookingSegment {
  id: string;
  trip_id: string;
  agent_id: string;
  segment_type: BookingSegmentType;
  status: BookingStatus;
  vendor_name?: string;
  vendor_code?: string;
  confirmation_number?: string;
  booking_reference?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  origin?: string;
  origin_code?: string;
  destination?: string;
  destination_code?: string;
  // Flight-specific
  flight_number?: string;
  cabin_class?: string;
  aircraft_type?: string;
  // Hotel-specific
  room_type?: string;
  room_count?: number;
  check_in_time?: string;
  check_out_time?: string;
  // Financials
  net_cost_cents: number;
  sell_price_cents: number;
  commission_cents: number;
  commission_rate?: number;
  currency: string;
  // Settlement type (travel subledger)
  settlement_type?: BookingSettlementType;
  supplier_paid_cents?: number;         // A/P: What we've paid to supplier
  supplier_paid_at?: string;            // When supplier was paid
  commission_expected_cents?: number;   // Expected commission
  commission_received_cents?: number;   // Commission actually received
  commission_received_at?: string;      // When commission arrived
  // ARC/BSP-specific
  arc_submission_date?: string;
  arc_settlement_date?: string;
  arc_report_number?: string;
  // Deadlines
  ticketing_deadline?: string;
  payment_deadline?: string;
  cancellation_deadline?: string;
  cancellation_policy?: string;
  penalty_amount_cents?: number;
  is_refundable: boolean;
  // Additional
  travelers_on_segment?: string[];
  segment_details?: Record<string, unknown>;
  notes?: string;
  // Booking source - distinguishes the three booking modes
  booking_source?: BookingSource;
  // Informational fields (Mode 3 - client-booked segments)
  is_informational_only?: boolean;
  baggage_allowance?: string;
  terminal_info?: { departure?: string; arrival?: string };
  timezone_info?: string;
  support_instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface AgencyQuote {
  id: string;
  trip_id: string;
  agent_id: string;
  version_number: number;
  is_current_version: boolean;
  parent_quote_id?: string;
  name?: string;
  description?: string;
  status: QuoteStatus;
  sent_at?: string;
  viewed_at?: string;
  approved_at?: string;
  approved_by?: string;
  expires_at?: string;
  subtotal_cents: number;
  agency_fee_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  line_items?: QuoteLineItem[];
  terms_and_conditions?: string;
  notes?: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItem {
  description: string;
  segment_id?: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

export interface AgencyInvoice {
  id: string;
  trip_id: string;
  quote_id?: string;
  agent_id: string;
  account_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  paid_date?: string;
  subtotal_cents: number;
  agency_fee_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  currency: string;
  line_items?: QuoteLineItem[];
  payment_instructions?: string;
  stripe_invoice_id?: string;
  notes?: string;
  internal_notes?: string;
  sent_at?: string;
  viewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AgencyPayment {
  id: string;
  invoice_id: string;
  trip_id: string;
  agent_id: string;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_date: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  transaction_reference?: string;
  status: string;
  refund_amount_cents: number;
  refunded_at?: string;
  notes?: string;
  receipt_url?: string;
  created_at: string;
}

export interface PaymentSchedule {
  id: string;
  trip_id: string;
  invoice_id?: string;
  agent_id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  is_paid: boolean;
  paid_at?: string;
  payment_id?: string;
  reminder_sent_at?: string;
  reminder_count: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AgencyTask {
  id: string;
  agent_id: string;
  trip_id?: string;
  account_id?: string;
  traveler_id?: string;
  booking_segment_id?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  due_time?: string;
  completed_at?: string;
  task_type?: string;
  is_system_generated: boolean;
  reminder_date?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  trip?: AgencyTrip;
}

export interface AgencyDocument {
  id: string;
  agent_id: string;
  trip_id?: string;
  account_id?: string;
  traveler_id?: string;
  document_type: DocumentType;
  name: string;
  description?: string;
  file_url: string;
  file_name?: string;
  file_size_bytes?: number;
  mime_type?: string;
  expires_at?: string;
  is_client_visible: boolean;
  uploaded_at: string;
  created_at: string;
}

export interface AgencyCommunication {
  id: string;
  agent_id: string;
  trip_id?: string;
  account_id?: string;
  traveler_id?: string;
  communication_type: CommunicationType;
  subject?: string;
  body?: string;
  from_address?: string;
  to_addresses?: string[];
  cc_addresses?: string[];
  is_incoming: boolean;
  sent_at?: string;
  is_approval: boolean;
  approval_response?: string;
  approved_item_reference?: string;
  external_message_id?: string;
  template_used?: string;
  attachments?: Record<string, unknown>[];
  created_at: string;
}

export interface AgencySupplier {
  id: string;
  agent_id: string;
  name: string;
  supplier_type?: string;
  code?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  website?: string;
  default_commission_rate?: number;
  payment_terms?: string;
  notes?: string;
  is_preferred: boolean;
  created_at: string;
  updated_at: string;
}

// Pipeline stages
export const PIPELINE_STAGES = [
  { stage: 1, name: 'Inquiry', color: 'bg-gray-500' },
  { stage: 2, name: 'Discovery', color: 'bg-blue-500' },
  { stage: 3, name: 'Quoted', color: 'bg-purple-500' },
  { stage: 4, name: 'Deposit Paid', color: 'bg-yellow-500' },
  { stage: 5, name: 'Booked', color: 'bg-orange-500' },
  { stage: 6, name: 'Final Paid', color: 'bg-green-500' },
  { stage: 7, name: 'Traveling', color: 'bg-teal-500' },
  { stage: 8, name: 'Completed', color: 'bg-emerald-500' },
] as const;

export const SEGMENT_TYPE_LABELS: Record<BookingSegmentType, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  transfer: 'Transfer',
  rail: 'Rail',
  tour: 'Tour',
  cruise: 'Cruise',
  insurance: 'Insurance',
  car_rental: 'Car Rental',
  other: 'Other',
};
