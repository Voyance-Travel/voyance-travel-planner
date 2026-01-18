/**
 * Voyance Stripe API Service
 * 
 * Uses Cloud edge functions for payments:
 * - create-checkout: Create subscription checkout session
 * - check-subscription: Verify subscription status
 * - customer-portal: Manage subscription
 * - create-booking-checkout: One-time trip booking payment
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface StripeCustomerInfo {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  metadata: Record<string, string>;
}

export interface CheckoutSessionInput {
  priceId: string;
  mode?: 'subscription' | 'payment';
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResponse {
  url: string;
  error?: string;
}

export interface SubscriptionStatus {
  subscribed: boolean;
  product_id?: string | null;
  subscription_end?: string | null;
  error?: string;
}

export interface CustomerPortalResponse {
  url: string;
  error?: string;
}

export interface BookingCheckoutInput {
  tripId: string;
  priceId: string;
  description?: string;
}

// ============================================================================
// API Functions - Now using Cloud Edge Functions
// ============================================================================

/**
 * Create a checkout session (subscription or one-time)
 */
export async function createCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSessionResponse> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      priceId: input.priceId,
      mode: input.mode || 'subscription',
    },
  });

  if (error) {
    console.error('[StripeAPI] Create checkout error:', error);
    return { url: '', error: error.message };
  }

  return data as CheckoutSessionResponse;
}

/**
 * Create a booking checkout (one-time payment for trip)
 */
export async function createBookingCheckout(
  input: BookingCheckoutInput
): Promise<CheckoutSessionResponse> {
  const { data, error } = await supabase.functions.invoke('create-booking-checkout', {
    body: {
      tripId: input.tripId,
      priceId: input.priceId,
      description: input.description,
    },
  });

  if (error) {
    console.error('[StripeAPI] Create booking checkout error:', error);
    return { url: '', error: error.message };
  }

  return data as CheckoutSessionResponse;
}

/**
 * Check subscription status
 */
export async function checkSubscription(): Promise<SubscriptionStatus> {
  const { data, error } = await supabase.functions.invoke('check-subscription');

  if (error) {
    console.error('[StripeAPI] Check subscription error:', error);
    return { subscribed: false, error: error.message };
  }

  return data as SubscriptionStatus;
}

/**
 * Open customer portal for subscription management
 */
export async function openCustomerPortal(): Promise<CustomerPortalResponse> {
  const { data, error } = await supabase.functions.invoke('customer-portal');

  if (error) {
    console.error('[StripeAPI] Customer portal error:', error);
    return { url: '', error: error.message };
  }

  return data as CustomerPortalResponse;
}

/**
 * Redirect to Stripe checkout
 */
export async function redirectToCheckout(input: CheckoutSessionInput): Promise<void> {
  const session = await createCheckoutSession(input);
  if (session.url) {
    window.open(session.url, '_blank');
  } else {
    throw new Error(session.error || 'Failed to create checkout session');
  }
}

/**
 * Redirect to customer portal
 */
export async function redirectToPortal(): Promise<void> {
  const portal = await openCustomerPortal();
  if (portal.url) {
    window.open(portal.url, '_blank');
  } else {
    throw new Error(portal.error || 'Failed to open customer portal');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Get payment status badge color
 */
export function getPaymentStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'complete':
    case 'succeeded':
      return 'green';
    case 'pending':
    case 'processing':
      return 'yellow';
    case 'failed':
    case 'canceled':
    case 'expired':
      return 'red';
    case 'refunded':
    case 'partially_refunded':
      return 'blue';
    default:
      return 'gray';
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

const stripeKeys = {
  all: ['stripe'] as const,
  subscription: () => [...stripeKeys.all, 'subscription'] as const,
};

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: stripeKeys.subscription(),
    queryFn: checkSubscription,
    staleTime: 60_000, // 1 minute
    refetchInterval: 60_000, // Refresh every minute
    retry: 1,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: createCheckoutSession,
  });
}

export function useCreateBookingCheckout() {
  return useMutation({
    mutationFn: createBookingCheckout,
  });
}

export function useRedirectToCheckout() {
  return useMutation({
    mutationFn: redirectToCheckout,
  });
}

export function useOpenCustomerPortal() {
  return useMutation({
    mutationFn: openCustomerPortal,
  });
}

export function useRedirectToPortal() {
  return useMutation({
    mutationFn: redirectToPortal,
  });
}

// Refresh subscription status after checkout
export function useRefreshSubscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: checkSubscription,
    onSuccess: (data) => {
      queryClient.setQueryData(stripeKeys.subscription(), data);
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const stripeAPI = {
  createCheckoutSession,
  createBookingCheckout,
  checkSubscription,
  openCustomerPortal,
  redirectToCheckout,
  redirectToPortal,
  formatCurrency,
  getPaymentStatusColor,
};

export default stripeAPI;
