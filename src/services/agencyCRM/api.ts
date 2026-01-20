// Travel Agency CRM API Service
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type {
  AgencyAccount,
  AgencyTraveler,
  AgencyTrip,
  BookingSegment,
  AgencyQuote,
  AgencyInvoice,
  AgencyPayment,
  PaymentSchedule,
  AgencyTask,
  AgencyDocument,
  AgencyCommunication,
  AgencySupplier,
} from './types';

// Helper to cast objects for Supabase inserts
const toJson = (obj: unknown): Json => obj as Json;

// ============ ACCOUNTS ============

export async function getAccounts(): Promise<AgencyAccount[]> {
  const { data, error } = await supabase
    .from('agency_accounts')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return (data || []) as unknown as AgencyAccount[];
}

export async function getAccount(id: string): Promise<AgencyAccount | null> {
  const { data, error } = await supabase
    .from('agency_accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data as unknown as AgencyAccount;
}

export async function createAccount(account: Partial<AgencyAccount>): Promise<AgencyAccount> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    name: account.name || 'New Account',
    account_type: account.account_type || 'individual',
    company_name: account.company_name,
    billing_email: account.billing_email,
    billing_phone: account.billing_phone,
    billing_address: toJson(account.billing_address),
    notes: account.notes,
    tags: account.tags,
    referral_source: account.referral_source,
  };

  const { data, error } = await supabase
    .from('agency_accounts')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyAccount;
}

export async function updateAccount(id: string, updates: Partial<AgencyAccount>): Promise<AgencyAccount> {
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.billing_address) {
    updateData.billing_address = toJson(updates.billing_address);
  }

  const { data, error } = await supabase
    .from('agency_accounts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyAccount;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('agency_accounts')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============ TRAVELERS ============

export async function getTravelers(accountId?: string): Promise<AgencyTraveler[]> {
  let query = supabase.from('agency_travelers').select('*').order('legal_last_name');
  
  if (accountId) {
    query = query.eq('account_id', accountId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AgencyTraveler[];
}

export async function getTraveler(id: string): Promise<AgencyTraveler | null> {
  const { data, error } = await supabase
    .from('agency_travelers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data as unknown as AgencyTraveler;
}

export async function createTraveler(traveler: Partial<AgencyTraveler>): Promise<AgencyTraveler> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    account_id: traveler.account_id!,
    legal_first_name: traveler.legal_first_name || '',
    legal_middle_name: traveler.legal_middle_name,
    legal_last_name: traveler.legal_last_name || '',
    preferred_name: traveler.preferred_name,
    date_of_birth: traveler.date_of_birth,
    gender: traveler.gender,
    email: traveler.email,
    phone: traveler.phone,
    passport_number: traveler.passport_number,
    passport_country: traveler.passport_country,
    passport_expiry: traveler.passport_expiry,
    known_traveler_number: traveler.known_traveler_number,
    redress_number: traveler.redress_number,
    global_entry_number: traveler.global_entry_number,
    seat_preference: traveler.seat_preference,
    meal_preference: traveler.meal_preference,
    hotel_preferences: toJson(traveler.hotel_preferences),
    airline_loyalty: toJson(traveler.airline_loyalty),
    hotel_loyalty: toJson(traveler.hotel_loyalty),
    dietary_restrictions: traveler.dietary_restrictions,
    allergies: traveler.allergies,
    mobility_needs: traveler.mobility_needs,
    medical_notes: traveler.medical_notes,
    emergency_contact: toJson(traveler.emergency_contact),
    notes: traveler.notes,
    is_primary_contact: traveler.is_primary_contact || false,
  };

  const { data, error } = await supabase
    .from('agency_travelers')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyTraveler;
}

export async function updateTraveler(id: string, updates: Partial<AgencyTraveler>): Promise<AgencyTraveler> {
  const updateData: Record<string, unknown> = {};
  
  // Copy simple fields
  const simpleFields = [
    'legal_first_name', 'legal_middle_name', 'legal_last_name', 'preferred_name',
    'date_of_birth', 'gender', 'email', 'phone', 'passport_number', 'passport_country',
    'passport_expiry', 'known_traveler_number', 'redress_number', 'global_entry_number',
    'seat_preference', 'meal_preference', 'dietary_restrictions', 'allergies',
    'mobility_needs', 'medical_notes', 'notes', 'is_primary_contact'
  ] as const;
  
  for (const field of simpleFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }
  
  // Handle JSON fields
  if (updates.hotel_preferences) updateData.hotel_preferences = toJson(updates.hotel_preferences);
  if (updates.airline_loyalty) updateData.airline_loyalty = toJson(updates.airline_loyalty);
  if (updates.hotel_loyalty) updateData.hotel_loyalty = toJson(updates.hotel_loyalty);
  if (updates.emergency_contact) updateData.emergency_contact = toJson(updates.emergency_contact);

  const { data, error } = await supabase
    .from('agency_travelers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyTraveler;
}

export async function deleteTraveler(id: string): Promise<void> {
  const { error } = await supabase
    .from('agency_travelers')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============ TRIPS ============

export async function getTrips(filters?: { status?: string; accountId?: string }): Promise<AgencyTrip[]> {
  let query = supabase
    .from('agency_trips')
    .select(`
      *,
      account:agency_accounts(*)
    `)
    .order('created_at', { ascending: false });
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.accountId) {
    query = query.eq('account_id', filters.accountId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AgencyTrip[];
}

export async function getTrip(id: string): Promise<AgencyTrip | null> {
  const { data, error } = await supabase
    .from('agency_trips')
    .select(`
      *,
      account:agency_accounts(*)
    `)
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data as unknown as AgencyTrip;
}

export async function createTrip(trip: Partial<AgencyTrip>): Promise<AgencyTrip> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    account_id: trip.account_id!,
    name: trip.name || 'New Trip',
    description: trip.description,
    destination: trip.destination,
    destinations: toJson(trip.destinations),
    start_date: trip.start_date,
    end_date: trip.end_date,
    status: trip.status || 'inquiry',
    pipeline_stage: trip.pipeline_stage || 1,
    trip_type: trip.trip_type,
    traveler_count: trip.traveler_count || 1,
    notes: trip.notes,
    internal_notes: trip.internal_notes,
    tags: trip.tags,
    currency: trip.currency || 'USD',
  };

  const { data, error } = await supabase
    .from('agency_trips')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyTrip;
}

export async function updateTrip(id: string, updates: Partial<AgencyTrip>): Promise<AgencyTrip> {
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.destinations) {
    updateData.destinations = toJson(updates.destinations);
  }

  const { data, error } = await supabase
    .from('agency_trips')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyTrip;
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase
    .from('agency_trips')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============ BOOKING SEGMENTS ============

export async function getSegments(tripId: string): Promise<BookingSegment[]> {
  const { data, error } = await supabase
    .from('agency_booking_segments')
    .select('*')
    .eq('trip_id', tripId)
    .order('start_date', { ascending: true });
  
  if (error) throw error;
  return (data || []) as unknown as BookingSegment[];
}

export async function createSegment(segment: Partial<BookingSegment>): Promise<BookingSegment> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    trip_id: segment.trip_id!,
    segment_type: segment.segment_type || 'other',
    status: segment.status || 'pending',
    vendor_name: segment.vendor_name,
    vendor_code: segment.vendor_code,
    confirmation_number: segment.confirmation_number,
    booking_reference: segment.booking_reference,
    start_date: segment.start_date,
    start_time: segment.start_time,
    end_date: segment.end_date,
    end_time: segment.end_time,
    origin: segment.origin,
    origin_code: segment.origin_code,
    destination: segment.destination,
    destination_code: segment.destination_code,
    flight_number: segment.flight_number,
    cabin_class: segment.cabin_class,
    aircraft_type: segment.aircraft_type,
    room_type: segment.room_type,
    room_count: segment.room_count,
    check_in_time: segment.check_in_time,
    check_out_time: segment.check_out_time,
    net_cost_cents: segment.net_cost_cents || 0,
    sell_price_cents: segment.sell_price_cents || 0,
    commission_cents: segment.commission_cents || 0,
    commission_rate: segment.commission_rate,
    currency: segment.currency || 'USD',
    ticketing_deadline: segment.ticketing_deadline,
    payment_deadline: segment.payment_deadline,
    cancellation_deadline: segment.cancellation_deadline,
    cancellation_policy: segment.cancellation_policy,
    penalty_amount_cents: segment.penalty_amount_cents,
    is_refundable: segment.is_refundable ?? true,
    travelers_on_segment: segment.travelers_on_segment,
    segment_details: toJson(segment.segment_details),
    notes: segment.notes,
  };

  const { data, error } = await supabase
    .from('agency_booking_segments')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as BookingSegment;
}

export async function updateSegment(id: string, updates: Partial<BookingSegment>): Promise<BookingSegment> {
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.segment_details) {
    updateData.segment_details = toJson(updates.segment_details);
  }

  const { data, error } = await supabase
    .from('agency_booking_segments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as BookingSegment;
}

export async function deleteSegment(id: string): Promise<void> {
  const { error } = await supabase
    .from('agency_booking_segments')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============ QUOTES ============

export async function getQuotes(tripId: string): Promise<AgencyQuote[]> {
  const { data, error } = await supabase
    .from('agency_quotes')
    .select('*')
    .eq('trip_id', tripId)
    .order('version_number', { ascending: false });
  
  if (error) throw error;
  return (data || []) as unknown as AgencyQuote[];
}

export async function createQuote(quote: Partial<AgencyQuote>): Promise<AgencyQuote> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Get next version number
  const { data: existing } = await supabase
    .from('agency_quotes')
    .select('version_number')
    .eq('trip_id', quote.trip_id)
    .order('version_number', { ascending: false })
    .limit(1);
  
  const nextVersion = (existing?.[0]?.version_number || 0) + 1;

  // Mark all previous versions as not current
  if (quote.trip_id) {
    await supabase
      .from('agency_quotes')
      .update({ is_current_version: false })
      .eq('trip_id', quote.trip_id);
  }

  const insertData = {
    agent_id: user.user.id,
    trip_id: quote.trip_id!,
    version_number: nextVersion,
    is_current_version: true,
    name: quote.name,
    description: quote.description,
    status: quote.status || 'draft',
    expires_at: quote.expires_at,
    subtotal_cents: quote.subtotal_cents || 0,
    agency_fee_cents: quote.agency_fee_cents || 0,
    discount_cents: quote.discount_cents || 0,
    tax_cents: quote.tax_cents || 0,
    total_cents: quote.total_cents || 0,
    currency: quote.currency || 'USD',
    line_items: toJson(quote.line_items),
    terms_and_conditions: quote.terms_and_conditions,
    notes: quote.notes,
    internal_notes: quote.internal_notes,
  };

  const { data, error } = await supabase
    .from('agency_quotes')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyQuote;
}

export async function updateQuote(id: string, updates: Partial<AgencyQuote>): Promise<AgencyQuote> {
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.line_items) {
    updateData.line_items = toJson(updates.line_items);
  }

  const { data, error } = await supabase
    .from('agency_quotes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyQuote;
}

// ============ INVOICES ============

export async function getInvoices(filters?: { tripId?: string; status?: string }): Promise<AgencyInvoice[]> {
  let query = supabase
    .from('agency_invoices')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (filters?.tripId) {
    query = query.eq('trip_id', filters.tripId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status as 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'refunded');
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AgencyInvoice[];
}

export async function createInvoice(invoice: Partial<AgencyInvoice>): Promise<AgencyInvoice> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Generate invoice number
  const { data: numberData } = await supabase.rpc('generate_invoice_number');
  const invoiceNumber = numberData || `INV-${Date.now()}`;

  const insertData = {
    agent_id: user.user.id,
    trip_id: invoice.trip_id!,
    account_id: invoice.account_id!,
    quote_id: invoice.quote_id,
    invoice_number: invoiceNumber,
    status: invoice.status || 'draft',
    issue_date: invoice.issue_date || new Date().toISOString().split('T')[0],
    due_date: invoice.due_date!,
    subtotal_cents: invoice.subtotal_cents || 0,
    agency_fee_cents: invoice.agency_fee_cents || 0,
    discount_cents: invoice.discount_cents || 0,
    tax_cents: invoice.tax_cents || 0,
    total_cents: invoice.total_cents || 0,
    amount_paid_cents: 0,
    balance_due_cents: invoice.total_cents || 0,
    currency: invoice.currency || 'USD',
    line_items: toJson(invoice.line_items),
    payment_instructions: invoice.payment_instructions,
    notes: invoice.notes,
    internal_notes: invoice.internal_notes,
  };

  const { data, error } = await supabase
    .from('agency_invoices')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyInvoice;
}

export async function updateInvoice(id: string, updates: Partial<AgencyInvoice>): Promise<AgencyInvoice> {
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.line_items) {
    updateData.line_items = toJson(updates.line_items);
  }

  const { data, error } = await supabase
    .from('agency_invoices')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyInvoice;
}

// ============ PAYMENTS ============

export async function getPayments(invoiceId: string): Promise<AgencyPayment[]> {
  const { data, error } = await supabase
    .from('agency_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false });
  
  if (error) throw error;
  return (data || []) as unknown as AgencyPayment[];
}

export async function recordPayment(payment: Partial<AgencyPayment>): Promise<AgencyPayment> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    invoice_id: payment.invoice_id!,
    trip_id: payment.trip_id!,
    amount_cents: payment.amount_cents!,
    currency: payment.currency || 'USD',
    payment_method: payment.payment_method!,
    payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
    stripe_payment_intent_id: payment.stripe_payment_intent_id,
    stripe_charge_id: payment.stripe_charge_id,
    transaction_reference: payment.transaction_reference,
    status: payment.status || 'completed',
    notes: payment.notes,
    receipt_url: payment.receipt_url,
  };

  const { data, error } = await supabase
    .from('agency_payments')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;

  // Update invoice amounts
  if (payment.invoice_id && payment.amount_cents) {
    const { data: invoice } = await supabase
      .from('agency_invoices')
      .select('amount_paid_cents, total_cents')
      .eq('id', payment.invoice_id)
      .single();
    
    if (invoice) {
      const newPaidAmount = (invoice.amount_paid_cents || 0) + payment.amount_cents;
      const newBalance = (invoice.total_cents || 0) - newPaidAmount;
      const newStatus = newBalance <= 0 ? 'paid' : newPaidAmount > 0 ? 'partially_paid' : 'sent';
      
      await supabase
        .from('agency_invoices')
        .update({
          amount_paid_cents: newPaidAmount,
          balance_due_cents: Math.max(0, newBalance),
          status: newStatus as 'paid' | 'partially_paid' | 'sent',
          paid_date: newBalance <= 0 ? new Date().toISOString().split('T')[0] : null,
        })
        .eq('id', payment.invoice_id);
    }
  }

  return data as unknown as AgencyPayment;
}

// ============ PAYMENT SCHEDULES ============

export async function getPaymentSchedules(tripId: string): Promise<PaymentSchedule[]> {
  const { data, error } = await supabase
    .from('agency_payment_schedules')
    .select('*')
    .eq('trip_id', tripId)
    .order('due_date');
  
  if (error) throw error;
  return (data || []) as unknown as PaymentSchedule[];
}

export async function createPaymentSchedule(schedule: Partial<PaymentSchedule>): Promise<PaymentSchedule> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    trip_id: schedule.trip_id!,
    invoice_id: schedule.invoice_id,
    description: schedule.description!,
    amount_cents: schedule.amount_cents!,
    due_date: schedule.due_date!,
    is_paid: schedule.is_paid || false,
    notes: schedule.notes,
  };

  const { data, error } = await supabase
    .from('agency_payment_schedules')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as PaymentSchedule;
}

// ============ TASKS ============

export async function getTasks(filters?: { tripId?: string; status?: string; dueSoon?: boolean }): Promise<AgencyTask[]> {
  let query = supabase
    .from('agency_tasks')
    .select(`
      *,
      trip:agency_trips(id, name, destination)
    `)
    .order('due_date', { ascending: true });
  
  if (filters?.tripId) {
    query = query.eq('trip_id', filters.tripId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status as 'pending' | 'in_progress' | 'completed' | 'cancelled');
  }
  if (filters?.dueSoon) {
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 7);
    query = query.lte('due_date', inSevenDays.toISOString().split('T')[0]);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AgencyTask[];
}

export async function createTask(task: Partial<AgencyTask>): Promise<AgencyTask> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    trip_id: task.trip_id,
    account_id: task.account_id,
    traveler_id: task.traveler_id,
    booking_segment_id: task.booking_segment_id,
    title: task.title!,
    description: task.description,
    priority: task.priority || 'medium',
    status: task.status || 'pending',
    due_date: task.due_date,
    due_time: task.due_time,
    task_type: task.task_type || 'manual',
    is_system_generated: task.is_system_generated || false,
    reminder_date: task.reminder_date,
  };

  const { data, error } = await supabase
    .from('agency_tasks')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyTask;
}

export async function updateTask(id: string, updates: Partial<AgencyTask>): Promise<AgencyTask> {
  const { data, error } = await supabase
    .from('agency_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyTask;
}

export async function completeTask(id: string): Promise<AgencyTask> {
  return updateTask(id, { status: 'completed', completed_at: new Date().toISOString() });
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('agency_tasks')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============ DOCUMENTS ============

export async function getDocuments(filters?: { tripId?: string; travelerId?: string }): Promise<AgencyDocument[]> {
  let query = supabase
    .from('agency_documents')
    .select('*')
    .order('uploaded_at', { ascending: false });
  
  if (filters?.tripId) {
    query = query.eq('trip_id', filters.tripId);
  }
  if (filters?.travelerId) {
    query = query.eq('traveler_id', filters.travelerId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AgencyDocument[];
}

export async function uploadDocument(doc: Partial<AgencyDocument>): Promise<AgencyDocument> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    trip_id: doc.trip_id,
    account_id: doc.account_id,
    traveler_id: doc.traveler_id,
    document_type: doc.document_type!,
    name: doc.name!,
    description: doc.description,
    file_url: doc.file_url!,
    file_name: doc.file_name,
    file_size_bytes: doc.file_size_bytes,
    mime_type: doc.mime_type,
    expires_at: doc.expires_at,
    is_client_visible: doc.is_client_visible || false,
  };

  const { data, error } = await supabase
    .from('agency_documents')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyDocument;
}

// ============ COMMUNICATIONS ============

export async function getCommunications(filters?: { tripId?: string; accountId?: string }): Promise<AgencyCommunication[]> {
  let query = supabase
    .from('agency_communications')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (filters?.tripId) {
    query = query.eq('trip_id', filters.tripId);
  }
  if (filters?.accountId) {
    query = query.eq('account_id', filters.accountId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AgencyCommunication[];
}

export async function logCommunication(comm: Partial<AgencyCommunication>): Promise<AgencyCommunication> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    trip_id: comm.trip_id,
    account_id: comm.account_id,
    traveler_id: comm.traveler_id,
    communication_type: comm.communication_type!,
    subject: comm.subject,
    body: comm.body,
    from_address: comm.from_address,
    to_addresses: comm.to_addresses,
    cc_addresses: comm.cc_addresses,
    is_incoming: comm.is_incoming || false,
    sent_at: comm.sent_at,
    is_approval: comm.is_approval || false,
    approval_response: comm.approval_response,
    approved_item_reference: comm.approved_item_reference,
    external_message_id: comm.external_message_id,
    template_used: comm.template_used,
    attachments: toJson(comm.attachments),
  };

  const { data, error } = await supabase
    .from('agency_communications')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencyCommunication;
}

// ============ SUPPLIERS ============

export async function getSuppliers(): Promise<AgencySupplier[]> {
  const { data, error } = await supabase
    .from('agency_suppliers')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return (data || []) as unknown as AgencySupplier[];
}

export async function createSupplier(supplier: Partial<AgencySupplier>): Promise<AgencySupplier> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    name: supplier.name!,
    supplier_type: supplier.supplier_type,
    code: supplier.code,
    primary_contact_name: supplier.primary_contact_name,
    primary_contact_email: supplier.primary_contact_email,
    primary_contact_phone: supplier.primary_contact_phone,
    website: supplier.website,
    default_commission_rate: supplier.default_commission_rate,
    payment_terms: supplier.payment_terms,
    notes: supplier.notes,
    is_preferred: supplier.is_preferred || false,
  };

  const { data, error } = await supabase
    .from('agency_suppliers')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as AgencySupplier;
}

// ============ DASHBOARD STATS ============

export interface AgencyDashboardStats {
  totalAccounts: number;
  totalTrips: number;
  activeTrips: number;
  upcomingDeadlines: number;
  revenueThisMonth: number;
  pipelineValue: number;
}

export async function getDashboardStats(): Promise<AgencyDashboardStats> {
  const [accounts, trips, tasks] = await Promise.all([
    supabase.from('agency_accounts').select('id', { count: 'exact', head: true }),
    supabase.from('agency_trips').select('id, status, total_cost_cents, total_paid_cents'),
    supabase.from('agency_tasks').select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
  ]);

  const tripsData = trips.data || [];
  const activeStatuses = ['inquiry', 'discovery', 'quoted', 'deposit_paid', 'booked', 'final_paid', 'traveling'];
  const activeTrips = tripsData.filter(t => activeStatuses.includes(t.status));
  const pipelineValue = activeTrips.reduce((sum, t) => sum + (t.total_cost_cents || 0) - (t.total_paid_cents || 0), 0);

  return {
    totalAccounts: accounts.count || 0,
    totalTrips: tripsData.length,
    activeTrips: activeTrips.length,
    upcomingDeadlines: tasks.count || 0,
    revenueThisMonth: 0, // TODO: Calculate from payments
    pipelineValue,
  };
}
