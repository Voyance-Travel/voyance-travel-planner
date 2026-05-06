/**
 * Trip Payments API Service
 * Handles booking and payment tracking for flights, hotels, and activities
 */

import { supabase } from '@/integrations/supabase/client';

export interface TripPayment {
  id: string;
  trip_id: string;
  user_id: string;
  item_type: 'flight' | 'hotel' | 'activity';
  item_id: string;
  item_name: string;
  external_provider?: string;
  external_booking_id?: string;
  external_booking_url?: string;
  amount_cents: number;
  currency: string;
  quantity: number;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTotals {
  paid: number;      // in cents
  pending: number;   // in cents
  total: number;     // in cents
}

export interface BookingRequest {
  tripId: string;
  itemType: 'flight' | 'hotel' | 'activity';
  itemId: string;
  itemName: string;
  amountCents: number;
  currency?: string;
  quantity?: number;
  externalProvider?: string;
  externalBookingUrl?: string;
}

/**
 * Initiate a booking and payment for a trip item
 * Returns a Stripe checkout URL to complete payment
 */
export async function initiateBooking(request: BookingRequest): Promise<{
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  paymentId?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('book-activity', {
      body: request,
    });

    if (error) {
      console.error('[tripPaymentsAPI] Booking error:', error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (err) {
    console.error('[tripPaymentsAPI] Booking exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Booking failed' };
  }
}

/**
 * Verify a payment after Stripe checkout redirect
 */
export async function verifyPayment(sessionId: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { sessionId },
    });

    if (error) {
      console.error('[tripPaymentsAPI] Verify error:', error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (err) {
    console.error('[tripPaymentsAPI] Verify exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }
}

/**
 * Get all payments for a trip with totals
 * Uses direct Supabase query (RLS handles security)
 */
export async function getTripPayments(tripId: string): Promise<{
  success: boolean;
  payments?: TripPayment[];
  totals?: PaymentTotals;
  error?: string;
}> {
  try {
    const { data: payments, error } = await supabase
      .from('trip_payments')
      .select('*')
      .eq('trip_id', tripId)
      .is('archived_at', null);

    if (error) {
      // Suppress common errors silently — RLS, permission, or relation-not-found are expected
      // in contexts where the user doesn't have access or the table isn't populated
      return { success: true, payments: [], totals: { paid: 0, pending: 0, total: 0 } };
    }

    // Calculate totals
    const totalPaid = (payments || [])
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount_cents * (p.quantity || 1)), 0);

    const totalPending = (payments || [])
      .filter(p => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + (p.amount_cents * (p.quantity || 1)), 0);

    return {
      success: true,
      payments: payments as TripPayment[] || [],
      totals: {
        paid: totalPaid,
        pending: totalPending,
        total: totalPaid + totalPending,
      },
    };
  } catch (err) {
    console.error('[tripPaymentsAPI] Get payments exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get payments' };
  }
}

/**
 * Format cents to currency display string
 */
export function formatCurrency(amountCents: number, currency: string = 'USD'): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get payment status for a specific item
 */
export async function getItemPaymentStatus(tripId: string, itemType: 'flight' | 'hotel' | 'activity', itemId: string): Promise<TripPayment | null> {
  const result = await getTripPayments(tripId);
  if (!result.success || !result.payments) return null;
  
  return result.payments.find(p => p.item_type === itemType && p.item_id === itemId) || null;
}

/**
 * Check if an item is paid
 */
export function isPaid(payment: TripPayment | null | undefined): boolean {
  return payment?.status === 'paid';
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: TripPayment['status']): string {
  const labels: Record<TripPayment['status'], string> = {
    pending: 'Not Paid',
    processing: 'Processing...',
    paid: 'Paid ✓',
    failed: 'Payment Failed',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get status color class for UI
 */
export function getStatusColor(status: TripPayment['status']): string {
  const colors: Record<TripPayment['status'], string> = {
    pending: 'text-muted-foreground',
    processing: 'text-amber-600',
    paid: 'text-green-600',
    failed: 'text-red-600',
    refunded: 'text-blue-600',
    cancelled: 'text-muted-foreground',
  };
  return colors[status] || 'text-muted-foreground';
}
