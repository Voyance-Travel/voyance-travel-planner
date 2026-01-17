/**
 * Voyance Stripe API Service
 * 
 * Integrates with Railway backend Stripe test endpoints:
 * - /api/stripe/test-customer - Test/verify customer creation
 * - /api/stripe/test-products - List available products/prices
 */

import { supabase } from '@/integrations/supabase/client';

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
  
  // Fall back to stored token
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
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Stripe Test API
// ============================================================================

/**
 * Test and verify Stripe customer creation
 * Creates customer if doesn't exist, verifies if exists
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
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useStripeCustomer() {
  return useQuery({
    queryKey: ['stripe-customer'],
    queryFn: testStripeCustomer,
    staleTime: 5 * 60_000, // 5 minutes
    retry: 1,
  });
}

export function useStripeProducts() {
  return useQuery({
    queryKey: ['stripe-products'],
    queryFn: getStripeProducts,
    staleTime: 10 * 60_000, // 10 minutes
    retry: 1,
  });
}

export function useTestStripeCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: testStripeCustomer,
    onSuccess: (data) => {
      if (data.success) {
        queryClient.setQueryData(['stripe-customer'], data);
      }
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const stripeAPI = {
  testStripeCustomer,
  getStripeProducts,
};

export default stripeAPI;
