/**
 * Voyance Stripe API Service
 * 
 * Integrates with Railway backend Stripe endpoints:
 * - POST /stripe/create-checkout-session - Create payment session
 * - GET /stripe/session/:sessionId - Get session status
 * - POST /stripe/admin/refund - Admin refund (admin only)
 * - POST /stripe/admin/payment-link - Create payment link (admin only)
 * - POST /stripe/refund/:bookingId - Refund booking (admin only)
 * - GET /stripe/health - Health check
 * - GET /stripe/test-customer - Test/verify customer creation
 * - GET /stripe/test-products - List available products/prices
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

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

export interface StripeTestCustomerResponse {
  success: boolean;
  customerId?: string;
  customer?: StripeCustomerInfo;
  error?: string;
  message?: string;
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  prices: StripePrice[];
}

export interface StripePrice {
  id: string;
  currency: string;
  unit_amount: number | null;
  recurring: {
    interval: string;
    interval_count: number;
  } | null;
  type: string;
}

export interface StripeTestProductsResponse {
  success: boolean;
  products?: StripeProduct[];
  count?: number;
  error?: string;
  message?: string;
}

export interface CheckoutSessionMetadata {
  tripId?: string;
  destinationId?: string;
  description?: string;
}

export interface CreateCheckoutSessionInput {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: CheckoutSessionMetadata;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  expiresAt: string;
}

export interface SessionStatusResponse {
  status: string;
  paymentStatus: string;
  customerEmail?: string;
  amountTotal?: number;
  currency?: string;
}

export interface CreatePaymentLinkInput {
  priceId: string;
  quantity?: number;
  metadata?: Record<string, string>;
}

export interface PaymentLinkResponse {
  url: string;
  id: string;
  expiresAt?: string;
}

export interface RefundInput {
  paymentIntentId: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export interface RefundResponse {
  refundId: string;
  amount: number;
  status: string;
}

export interface BookingRefundInput {
  bookingId: string;
  reason?: string;
  amount?: number;
}

export interface BookingRefundResponse {
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
}

export interface StripeHealthResponse {
  status: 'ok' | 'disabled';
  stripe: 'configured' | 'disabled';
  webhookEndpoint: string;
  timestamp: string;
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

async function stripeApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/stripe${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData._error || errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Stripe Test API
// ============================================================================

/**
 * Test and verify Stripe customer creation
 */
export async function testStripeCustomer(): Promise<StripeTestCustomerResponse> {
  try {
    const response = await stripeApiRequest<StripeTestCustomerResponse>('/test-customer', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[StripeAPI] Test customer error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test Stripe customer',
    };
  }
}

/**
 * List available Stripe products and prices
 */
export async function getStripeProducts(): Promise<StripeTestProductsResponse> {
  try {
    const response = await stripeApiRequest<StripeTestProductsResponse>('/test-products', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[StripeAPI] Get products error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Stripe products',
    };
  }
}

// ============================================================================
// Stripe Payment API
// ============================================================================

/**
 * Create a checkout session for payment
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CheckoutSessionResponse> {
  return stripeApiRequest<CheckoutSessionResponse>('/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Get checkout session status
 */
export async function getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  return stripeApiRequest<SessionStatusResponse>(`/session/${sessionId}`);
}

/**
 * Create a payment link (admin only)
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput
): Promise<PaymentLinkResponse> {
  return stripeApiRequest<PaymentLinkResponse>('/admin/payment-link', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Create a refund (admin only)
 */
export async function createRefund(input: RefundInput): Promise<RefundResponse> {
  return stripeApiRequest<RefundResponse>('/admin/refund', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Refund a booking (admin only)
 */
export async function refundBooking(input: BookingRefundInput): Promise<BookingRefundResponse> {
  const { bookingId, ...body } = input;
  return stripeApiRequest<BookingRefundResponse>(`/refund/${bookingId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Check Stripe health status
 */
export async function getStripeHealth(): Promise<StripeHealthResponse> {
  return stripeApiRequest<StripeHealthResponse>('/health');
}

/**
 * Redirect to Stripe checkout
 */
export async function redirectToCheckout(input: CreateCheckoutSessionInput): Promise<void> {
  const session = await createCheckoutSession(input);
  window.location.href = session.url;
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
  customer: () => [...stripeKeys.all, 'customer'] as const,
  products: () => [...stripeKeys.all, 'products'] as const,
  session: (sessionId: string) => [...stripeKeys.all, 'session', sessionId] as const,
  health: () => [...stripeKeys.all, 'health'] as const,
};

export function useStripeCustomer() {
  return useQuery({
    queryKey: stripeKeys.customer(),
    queryFn: testStripeCustomer,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useStripeProducts() {
  return useQuery({
    queryKey: stripeKeys.products(),
    queryFn: getStripeProducts,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

export function useTestStripeCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: testStripeCustomer,
    onSuccess: (data) => {
      if (data.success) {
        queryClient.setQueryData(stripeKeys.customer(), data);
      }
    },
  });
}

export function useSessionStatus(sessionId: string | null) {
  return useQuery({
    queryKey: stripeKeys.session(sessionId || ''),
    queryFn: () => sessionId ? getSessionStatus(sessionId) : Promise.reject('No session ID'),
    enabled: !!sessionId,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.paymentStatus === 'unpaid') {
        return 5000;
      }
      return false;
    },
  });
}

export function useStripeHealth() {
  return useQuery({
    queryKey: stripeKeys.health(),
    queryFn: getStripeHealth,
    staleTime: 5 * 60_000,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: createCheckoutSession,
  });
}

export function useRedirectToCheckout() {
  return useMutation({
    mutationFn: redirectToCheckout,
  });
}

export function useCreatePaymentLink() {
  return useMutation({
    mutationFn: createPaymentLink,
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createRefund,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripeKeys.all });
    },
  });
}

export function useRefundBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: refundBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripeKeys.all });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const stripeAPI = {
  testStripeCustomer,
  getStripeProducts,
  createCheckoutSession,
  getSessionStatus,
  createPaymentLink,
  createRefund,
  refundBooking,
  getStripeHealth,
  redirectToCheckout,
  formatCurrency,
  getPaymentStatusColor,
};

export default stripeAPI;
