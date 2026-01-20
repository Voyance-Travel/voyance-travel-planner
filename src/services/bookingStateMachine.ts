/**
 * Booking State Machine Service
 * 
 * Manages the 4-state booking lifecycle for itinerary items:
 * 1. not_selected (suggestion only)
 * 2. selected_pending (in cart, quote obtained)
 * 3. booked_confirmed (confirmation + voucher)
 * 4. changed/cancelled/refunded (audit trail)
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export type BookingItemState = 
  | 'not_selected' 
  | 'selected_pending' 
  | 'booked_confirmed' 
  | 'changed' 
  | 'cancelled' 
  | 'refunded';

export type TriggerSource = 'user' | 'stripe_webhook' | 'vendor_api' | 'manual' | 'system';

export interface TravelerInfo {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  specialRequests?: string;
}

export interface CancellationPolicy {
  deadline: string; // ISO date
  refundPercentage: number;
  description: string;
  fees?: number;
}

export interface ModificationPolicy {
  allowed: boolean;
  deadline?: string;
  fees?: number;
  description?: string;
}

export interface QuoteData {
  quoteId: string;
  priceCents: number;
  currency: string;
  expiresAt: string;
  locked: boolean;
  breakdown?: {
    basePrice: number;
    taxes: number;
    fees: number;
    total: number;
  };
}

export interface VoucherData {
  voucherCode?: string;
  voucherUrl?: string;
  qrCode?: string;
  redemptionInstructions?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface BookableActivity {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  type: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  cost?: number;
  currency: string;
  bookingState: BookingItemState;
  bookingRequired: boolean;
  
  // Quote info
  quoteId?: string;
  quotePriceCents?: number;
  quoteExpiresAt?: string;
  quoteLocked?: boolean;
  
  // Booking confirmation
  confirmationNumber?: string;
  voucherUrl?: string;
  voucherData?: VoucherData;
  
  // Policies
  cancellationPolicy?: CancellationPolicy;
  modificationPolicy?: ModificationPolicy;
  
  // Timestamps
  bookedAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  refundAmountCents?: number;
  
  // Traveler & vendor
  travelerData?: TravelerInfo[];
  vendorName?: string;
  vendorBookingId?: string;
  externalBookingUrl?: string;
  
  // State history
  stateHistory?: Array<{
    from: BookingItemState | null;
    to: BookingItemState;
    at: string;
    by: string;
  }>;
}

export interface StateTransitionResult {
  success: boolean;
  previousState?: BookingItemState;
  newState?: BookingItemState;
  error?: string;
}

export interface BookingStateLogEntry {
  id: string;
  tripActivityId: string;
  tripId: string;
  userId: string;
  previousState?: BookingItemState;
  newState: BookingItemState;
  triggerSource: TriggerSource;
  triggerReference?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// STATE MACHINE LOGIC
// ============================================================================

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<BookingItemState | 'null', BookingItemState[]> = {
  'null': ['selected_pending'],
  'not_selected': ['selected_pending'],
  'selected_pending': ['not_selected', 'booked_confirmed'],
  'booked_confirmed': ['changed', 'cancelled', 'refunded'],
  'changed': ['booked_confirmed', 'cancelled', 'refunded'],
  'cancelled': ['refunded'],
  'refunded': [], // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  fromState: BookingItemState | null, 
  toState: BookingItemState
): boolean {
  const key = fromState || 'null';
  return VALID_TRANSITIONS[key]?.includes(toState) ?? false;
}

/**
 * Get allowed next states from current state
 */
export function getAllowedNextStates(currentState: BookingItemState | null): BookingItemState[] {
  const key = currentState || 'null';
  return VALID_TRANSITIONS[key] || [];
}

/**
 * Get human-readable state label
 */
export function getStateLabel(state: BookingItemState | null): string {
  const labels: Record<string, string> = {
    'not_selected': 'Suggested',
    'selected_pending': 'In Cart',
    'booked_confirmed': 'Confirmed',
    'changed': 'Modified',
    'cancelled': 'Cancelled',
    'refunded': 'Refunded',
  };
  return labels[state || 'not_selected'] || 'Unknown';
}

/**
 * Get state badge color
 */
export function getStateColor(state: BookingItemState | null): string {
  const colors: Record<string, string> = {
    'not_selected': 'bg-muted text-muted-foreground',
    'selected_pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    'booked_confirmed': 'bg-green-500/10 text-green-600 border-green-500/20',
    'changed': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    'cancelled': 'bg-red-500/10 text-red-600 border-red-500/20',
    'refunded': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  };
  return colors[state || 'not_selected'] || colors['not_selected'];
}

/**
 * Check if quote is still valid (not expired)
 */
export function isQuoteValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}

/**
 * Get time remaining on quote in human-readable format
 */
export function getQuoteTimeRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'No quote';
  
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Expired';
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
  return `${diffMins}m`;
}

/**
 * Get primary action button config based on state
 */
export function getPrimaryAction(activity: BookableActivity): {
  label: string;
  action: 'select' | 'add_travelers' | 'pay' | 'view_voucher' | 'modify' | 'none';
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
} {
  if (!activity.bookingRequired) {
    return { label: 'Free Activity', action: 'none', disabled: true, variant: 'secondary' };
  }

  switch (activity.bookingState) {
    case 'not_selected':
      return { label: 'Add to Trip', action: 'select', variant: 'default' };
    
    case 'selected_pending':
      if (!activity.travelerData?.length) {
        return { label: 'Add Traveler Info', action: 'add_travelers', variant: 'default' };
      }
      if (activity.quoteLocked && isQuoteValid(activity.quoteExpiresAt)) {
        return { label: 'Proceed to Payment', action: 'pay', variant: 'default' };
      }
      return { label: 'Get Quote & Pay', action: 'pay', variant: 'default' };
    
    case 'booked_confirmed':
      return { label: 'View Voucher', action: 'view_voucher', variant: 'outline' };
    
    case 'changed':
      return { label: 'View Details', action: 'view_voucher', variant: 'outline' };
    
    case 'cancelled':
    case 'refunded':
      return { label: 'Cancelled', action: 'none', disabled: true, variant: 'secondary' };
    
    default:
      return { label: 'Book Now', action: 'select', variant: 'default' };
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Transition activity booking state (uses DB function with audit logging)
 */
export async function transitionBookingState(
  activityId: string,
  newState: BookingItemState,
  triggerSource: TriggerSource = 'user',
  triggerReference?: string,
  metadata?: Record<string, unknown>
): Promise<StateTransitionResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc('transition_booking_state', {
    p_activity_id: activityId,
    p_new_state: newState,
    p_trigger_source: triggerSource,
    p_trigger_reference: triggerReference || null,
    p_metadata: (metadata || null) as any,
  });

  if (error) {
    console.error('State transition error:', error);
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; previous_state?: string; new_state?: string; error?: string };
  
  return {
    success: result.success,
    previousState: result.previous_state as BookingItemState,
    newState: result.new_state as BookingItemState,
    error: result.error,
  };
}

/**
 * Select activity (add to cart)
 */
export async function selectActivity(activityId: string): Promise<StateTransitionResult> {
  return transitionBookingState(activityId, 'selected_pending', 'user');
}

/**
 * Deselect activity (remove from cart)
 */
export async function deselectActivity(activityId: string): Promise<StateTransitionResult> {
  return transitionBookingState(activityId, 'not_selected', 'user');
}

/**
 * Update traveler info for an activity
 */
export async function updateTravelerInfo(
  activityId: string,
  travelers: TravelerInfo[]
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from('trip_activities')
    .update({ 
      traveler_data: travelers as any,
      updated_at: new Date().toISOString()
    })
    .eq('id', activityId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Lock quote for activity
 */
export async function lockQuote(
  activityId: string,
  quote: QuoteData
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('trip_activities')
    .update({
      quote_id: quote.quoteId,
      quote_price_cents: quote.priceCents,
      quote_expires_at: quote.expiresAt,
      quote_locked: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activityId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Confirm booking (after successful payment)
 */
export async function confirmBooking(
  activityId: string,
  confirmationNumber: string,
  vendorBookingId?: string,
  vendorName?: string,
  voucher?: VoucherData,
  cancellationPolicy?: CancellationPolicy
): Promise<StateTransitionResult> {
  // First update the booking details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await supabase
    .from('trip_activities')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      confirmation_number: confirmationNumber,
      vendor_booking_id: vendorBookingId,
      vendor_name: vendorName,
      voucher_data: voucher as any,
      voucher_url: voucher?.voucherUrl,
      cancellation_policy: cancellationPolicy as any,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', activityId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Then transition state
  return transitionBookingState(
    activityId, 
    'booked_confirmed', 
    'user',
    confirmationNumber
  );
}

/**
 * Cancel booking
 */
export async function cancelBooking(
  activityId: string,
  reason?: string
): Promise<StateTransitionResult> {
  return transitionBookingState(
    activityId,
    'cancelled',
    'user',
    undefined,
    { reason }
  );
}

/**
 * Record refund
 */
export async function recordRefund(
  activityId: string,
  refundAmountCents: number,
  refundReference?: string
): Promise<StateTransitionResult> {
  // Update refund amount first
  const { error: updateError } = await supabase
    .from('trip_activities')
    .update({
      refund_amount_cents: refundAmountCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activityId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return transitionBookingState(
    activityId,
    'refunded',
    'stripe_webhook',
    refundReference,
    { refundAmountCents }
  );
}

/**
 * Get bookable activities for a trip
 */
export async function getBookableActivities(tripId: string): Promise<BookableActivity[]> {
  const { data, error } = await supabase
    .from('trip_activities')
    .select('*')
    .eq('trip_id', tripId)
    .order('block_order', { ascending: true });

  if (error) {
    console.error('Error fetching activities:', error);
    return [];
  }

  // Map database rows to BookableActivity type
  return (data || []).map((row): BookableActivity => ({
    id: row.id,
    tripId: row.trip_id || '',
    title: row.title,
    description: row.description || undefined,
    type: row.type,
    location: row.location || undefined,
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    cost: row.cost ? Number(row.cost) : undefined,
    currency: row.currency || 'USD',
    bookingState: (row.booking_state as BookingItemState) || 'not_selected',
    bookingRequired: row.booking_required || false,
    quoteId: row.quote_id || undefined,
    quotePriceCents: row.quote_price_cents || undefined,
    quoteExpiresAt: row.quote_expires_at || undefined,
    quoteLocked: row.quote_locked || false,
    confirmationNumber: row.confirmation_number || undefined,
    voucherUrl: row.voucher_url || undefined,
    voucherData: row.voucher_data as unknown as VoucherData | undefined,
    cancellationPolicy: row.cancellation_policy as unknown as CancellationPolicy | undefined,
    modificationPolicy: row.modification_policy as unknown as ModificationPolicy | undefined,
    bookedAt: row.booked_at || undefined,
    cancelledAt: row.cancelled_at || undefined,
    refundedAt: row.refunded_at || undefined,
    refundAmountCents: row.refund_amount_cents || undefined,
    travelerData: row.traveler_data as unknown as TravelerInfo[] | undefined,
    vendorName: row.vendor_name || undefined,
    vendorBookingId: row.vendor_booking_id || undefined,
    externalBookingUrl: row.external_booking_url || undefined,
    stateHistory: row.state_history as BookableActivity['stateHistory'] || [],
  }));
}

/**
 * Get booking state log for an activity
 */
export async function getBookingStateLog(activityId: string): Promise<BookingStateLogEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_state_log')
    .select('*')
    .eq('trip_activity_id', activityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching state log:', error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>): BookingStateLogEntry => ({
    id: row.id as string,
    tripActivityId: row.trip_activity_id as string,
    tripId: row.trip_id as string,
    userId: row.user_id as string,
    previousState: row.previous_state as BookingItemState | undefined,
    newState: row.new_state as BookingItemState,
    triggerSource: row.trigger_source as TriggerSource,
    triggerReference: row.trigger_reference as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
  }));
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useBookableActivities(tripId: string | null) {
  return useQuery({
    queryKey: ['bookable-activities', tripId],
    queryFn: () => tripId ? getBookableActivities(tripId) : Promise.resolve([]),
    enabled: !!tripId,
  });
}

export function useBookingStateLog(activityId: string | null) {
  return useQuery({
    queryKey: ['booking-state-log', activityId],
    queryFn: () => activityId ? getBookingStateLog(activityId) : Promise.resolve([]),
    enabled: !!activityId,
  });
}

export function useSelectActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: selectActivity,
    onSuccess: (_, activityId) => {
      queryClient.invalidateQueries({ queryKey: ['bookable-activities'] });
      queryClient.invalidateQueries({ queryKey: ['booking-state-log', activityId] });
    },
  });
}

export function useDeselectActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deselectActivity,
    onSuccess: (_, activityId) => {
      queryClient.invalidateQueries({ queryKey: ['bookable-activities'] });
      queryClient.invalidateQueries({ queryKey: ['booking-state-log', activityId] });
    },
  });
}

export function useUpdateTravelerInfo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ activityId, travelers }: { activityId: string; travelers: TravelerInfo[] }) =>
      updateTravelerInfo(activityId, travelers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookable-activities'] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ activityId, reason }: { activityId: string; reason?: string }) =>
      cancelBooking(activityId, reason),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: ['bookable-activities'] });
      queryClient.invalidateQueries({ queryKey: ['booking-state-log', activityId] });
    },
  });
}

export function useConfirmBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: {
      activityId: string;
      confirmationNumber: string;
      vendorBookingId?: string;
      vendorName?: string;
      voucher?: VoucherData;
      cancellationPolicy?: CancellationPolicy;
    }) => confirmBooking(
      params.activityId,
      params.confirmationNumber,
      params.vendorBookingId,
      params.vendorName,
      params.voucher,
      params.cancellationPolicy
    ),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: ['bookable-activities'] });
      queryClient.invalidateQueries({ queryKey: ['booking-state-log', activityId] });
    },
  });
}

export default {
  // State helpers
  isValidTransition,
  getAllowedNextStates,
  getStateLabel,
  getStateColor,
  isQuoteValid,
  getQuoteTimeRemaining,
  getPrimaryAction,
  
  // API functions
  transitionBookingState,
  selectActivity,
  deselectActivity,
  updateTravelerInfo,
  lockQuote,
  confirmBooking,
  cancelBooking,
  recordRefund,
  getBookableActivities,
  getBookingStateLog,
};
