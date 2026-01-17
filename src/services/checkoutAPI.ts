/**
 * Voyance Checkout API Service
 * 
 * Integrates with Railway backend checkout endpoints:
 * - POST /api/v1/bookings/checkout-session - Create Stripe checkout for trips
 * - GET /api/v1/bookings/checkout-session/:sessionId - Get session status
 */

import { useQuery, useMutation } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface CreateCheckoutInput {
  tripId: string;
  customerId?: string; // Stripe customer ID if exists
}

export interface CheckoutSessionResponse {
  success: boolean;
  url: string;
  sessionId: string;
  expiresAt: string;
  amount: number;
  currency: string;
}

export interface CheckoutStatusResponse {
  success: boolean;
  status: 'complete' | 'expired' | 'open';
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  tripId: string;
  amount: number;
  currency: string;
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  return { 'Content-Type': 'application/json' };
}

async function checkoutApiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  idempotencyKey?: string
): Promise<T> {
  const headers = await getAuthHeader();
  
  const allHeaders: Record<string, string> = {
    ...headers,
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (idempotencyKey) {
    allHeaders['Idempotency-Key'] = idempotencyKey;
  }
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bookings${endpoint}`, {
    ...options,
    headers: allHeaders,
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Checkout API
// ============================================================================

/**
 * Generate an idempotency key for checkout requests
 */
export function generateIdempotencyKey(tripId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `checkout_${tripId}_${timestamp}_${random}`;
}

/**
 * Create a Stripe checkout session for a trip
 */
export async function createCheckoutSession(
  input: CreateCheckoutInput,
  idempotencyKey?: string
): Promise<CheckoutSessionResponse> {
  const key = idempotencyKey || generateIdempotencyKey(input.tripId);
  
  return checkoutApiRequest<CheckoutSessionResponse>(
    '/checkout-session',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    key
  );
}

/**
 * Get checkout session status
 */
export async function getCheckoutStatus(sessionId: string): Promise<CheckoutStatusResponse> {
  return checkoutApiRequest<CheckoutStatusResponse>(`/checkout-session/${sessionId}`);
}

/**
 * Create checkout and redirect to Stripe
 */
export async function checkoutAndRedirect(input: CreateCheckoutInput): Promise<void> {
  const session = await createCheckoutSession(input);
  window.location.href = session.url;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate nights between dates
 */
export function calculateNights(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format checkout amount for display
 */
export function formatCheckoutAmount(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Check if checkout session is still valid
 */
export function isSessionValid(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date();
}

/**
 * Get time remaining until session expires
 */
export function getSessionTimeRemaining(expiresAt: string): number {
  const expiry = new Date(expiresAt);
  const now = new Date();
  return Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
}

// ============================================================================
// React Query Hooks
// ============================================================================

const checkoutKeys = {
  all: ['checkout'] as const,
  session: (sessionId: string) => [...checkoutKeys.all, 'session', sessionId] as const,
};

export function useCheckoutStatus(sessionId: string | null) {
  return useQuery({
    queryKey: checkoutKeys.session(sessionId || ''),
    queryFn: () => sessionId ? getCheckoutStatus(sessionId) : Promise.reject('No session ID'),
    enabled: !!sessionId,
    staleTime: 10_000, // 10 seconds
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.paymentStatus === 'unpaid' && data.status === 'open') {
        return 5000; // Poll every 5 seconds while waiting for payment
      }
      return false;
    },
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (input: CreateCheckoutInput) => createCheckoutSession(input),
  });
}

export function useCheckoutAndRedirect() {
  return useMutation({
    mutationFn: checkoutAndRedirect,
  });
}

// Default export
export default {
  createCheckoutSession,
  getCheckoutStatus,
  checkoutAndRedirect,
  generateIdempotencyKey,
  calculateNights,
  formatCheckoutAmount,
  isSessionValid,
  getSessionTimeRemaining,
};
