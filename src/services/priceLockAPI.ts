/**
 * Voyance Price Lock API Service
 * 
 * Integrates with Railway backend price lock endpoints:
 * - POST /api/v1/price-lock - Create a new price lock
 * - GET /api/v1/price-lock/:id - Get price lock status
 * - DELETE /api/v1/price-lock/:id - Cancel a price lock
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type PriceLockItemType = 'flight' | 'hotel';
export type PriceLockStatus = 'active' | 'expired' | 'used' | 'cancelled';

export interface CreatePriceLockInput {
  itemType: PriceLockItemType;
  itemId: string;
  price: number;
  currency?: string;
}

export interface PriceLockData {
  id: string;
  itemType: PriceLockItemType;
  itemId: string;
  lockedPrice: number;
  currency: string;
  status: PriceLockStatus;
  expiresIn: number; // seconds until expiration
  expiresAt?: string;
  clientSecret?: string; // Stripe client secret for payment
}

export interface PriceLockResponse {
  priceLock: {
    id: string;
    expiresAt: string;
    amount: number;
  };
  // Legacy fields for backward compatibility
  id: string;
  itemType: PriceLockItemType;
  itemId: string;
  lockedPrice: number;
  currency: string;
  status: PriceLockStatus;
  expiresIn: number;
  clientSecret?: string;
}

export interface PriceLockStatusResponse {
  success: boolean;
  priceLock?: PriceLockData;
  error?: string;
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

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a new price lock
 */
export async function createPriceLock(
  input: CreatePriceLockInput
): Promise<PriceLockResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/price-lock`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      itemType: input.itemType,
      itemId: input.itemId,
      price: input.price,
      currency: input.currency || 'USD',
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get price lock status by ID
 */
export async function getPriceLockStatus(
  lockId: string
): Promise<PriceLockStatusResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/price-lock/${lockId}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Cancel a price lock
 */
export async function cancelPriceLock(
  lockId: string
): Promise<{ success: boolean; message?: string }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/price-lock/${lockId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Calculate time remaining for a price lock
 */
export function calculateTimeRemaining(expiresAt: string): {
  expired: boolean;
  seconds: number;
  formatted: string;
} {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
  
  if (remaining === 0) {
    return { expired: true, seconds: 0, formatted: 'Expired' };
  }
  
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  
  return {
    expired: false,
    seconds: remaining,
    formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`,
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function usePriceLockStatus(lockId: string | null) {
  return useQuery({
    queryKey: ['price-lock', lockId],
    queryFn: () => lockId ? getPriceLockStatus(lockId) : Promise.reject('No lock ID'),
    enabled: !!lockId,
    staleTime: 10_000, // 10 seconds - refresh frequently for timer accuracy
    refetchInterval: 10_000, // Auto-refresh every 10 seconds
  });
}

export function useCreatePriceLock() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPriceLock,
    onSuccess: (data) => {
      queryClient.setQueryData(['price-lock', data.id], {
        success: true,
        priceLock: data,
      });
    },
  });
}

export function useCancelPriceLock() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: cancelPriceLock,
    onSuccess: (_, lockId) => {
      queryClient.invalidateQueries({ queryKey: ['price-lock', lockId] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const priceLockAPI = {
  createPriceLock,
  getPriceLockStatus,
  cancelPriceLock,
  calculateTimeRemaining,
};

export default priceLockAPI;
