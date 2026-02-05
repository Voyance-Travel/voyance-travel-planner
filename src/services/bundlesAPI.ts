/**
 * Bundles API Service
 * Flight + Hotel package optimization and booking endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// ============================================================================
// TYPES
// ============================================================================

export interface BundleSuggestParams {
  flightIds: string[];
  hotelIds: string[];
  currency?: string;
  maxResults?: number;
}

export interface Bundle {
  bundleId: string;
  flightId: string;
  hotelId: string;
  bundlePrice: number;
  originalPrice: number;
  savingsPct: number;
  score: number;
  currency: string;
  reasoning: string;
  expiresAt: string;
}

export interface BundleSuggestResponse {
  success: boolean;
  data: {
    bundles: Bundle[];
    count: number;
    expiresAt: string;
  };
}

export interface BundleAcceptParams {
  paymentMethodId: string;
  confirmPayment?: boolean;
}

export interface BundleAcceptResponse {
  success: boolean;
  data: {
    bundleId: string;
    status: 'ACCEPTED';
    acceptedAt: string;
    bundlePrice: number;
    savingsPct: number;
    payment?: {
      paymentIntentId: string;
      status: string;
      clientSecret: string | null;
    };
  };
}

export type BundleStatus = 'OFFERED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface BundleStatusResponse {
  success: boolean;
  data: {
    bundleId: string;
    flightId: string;
    hotelId: string;
    bundlePrice: number;
    originalPrice: number;
    savingsPct: number;
    score: number;
    currency: string;
    reasoning: string;
    status: BundleStatus;
    createdAt: string;
    expiresAt: string;
    acceptedAt?: string;
  };
}

export interface BundleRecommendation {
  bundleId: string;
  flightId: string;
  hotelId: string;
  bundlePrice: number;
  originalPrice: number;
  savingsPct: number;
  score: number;
  currency: string;
  reasoning: string;
  status: BundleStatus;
  expiresAt: string;
}

export interface BundleRecommendationsResponse {
  success: boolean;
  data: {
    bundles: BundleRecommendation[];
    count: number;
  };
}

// ============================================================================
// API HELPERS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Generate bundle recommendations from flight + hotel combinations
 */
export async function suggestBundles(params: BundleSuggestParams): Promise<BundleSuggestResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bundles/suggest`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to suggest bundles: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Accept a bundle and create payment intent
 */
export async function acceptBundle(
  bundleId: string,
  params: BundleAcceptParams
): Promise<BundleAcceptResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bundles/${bundleId}/accept`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to accept bundle: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get bundle status
 */
export async function getBundleStatus(bundleId: string): Promise<BundleStatusResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bundles/${bundleId}/status`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to get bundle status: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get user's recent bundle recommendations
 */
export async function getBundleRecommendations(): Promise<BundleRecommendationsResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bundles/recommendations`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to get bundle recommendations: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Cancel a bundle offer
 */
export async function cancelBundle(bundleId: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bundles/${bundleId}/cancel`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to cancel bundle: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook to suggest bundles
 */
export function useSuggestBundles() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: suggestBundles,
    onSuccess: (data) => {
      toast.success(`Found ${data.data.count} bundle${data.data.count !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['bundle-recommendations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate bundles');
    },
  });
}

/**
 * Hook to accept a bundle
 */
export function useAcceptBundle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ bundleId, params }: { bundleId: string; params: BundleAcceptParams }) =>
      acceptBundle(bundleId, params),
    onSuccess: (data) => {
      toast.success(`Bundle accepted! Saved ${data.data.savingsPct}%`);
      queryClient.invalidateQueries({ queryKey: ['bundle-status', data.data.bundleId] });
      queryClient.invalidateQueries({ queryKey: ['bundle-recommendations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to accept bundle');
    },
  });
}

/**
 * Hook to get bundle status
 */
export function useBundleStatus(bundleId: string | undefined) {
  return useQuery({
    queryKey: ['bundle-status', bundleId],
    queryFn: () => getBundleStatus(bundleId!),
    enabled: !!bundleId,
  });
}

/**
 * Hook to get user's bundle recommendations
 */
export function useBundleRecommendations() {
  return useQuery({
    queryKey: ['bundle-recommendations'],
    queryFn: getBundleRecommendations,
  });
}

/**
 * Hook to cancel a bundle
 */
export function useCancelBundle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: cancelBundle,
    onSuccess: () => {
      toast.success('Bundle cancelled');
      queryClient.invalidateQueries({ queryKey: ['bundle-recommendations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel bundle');
    },
  });
}

export default {
  suggestBundles,
  acceptBundle,
  getBundleStatus,
  getBundleRecommendations,
  cancelBundle,
};
