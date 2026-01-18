/**
 * Voyance Price Lock API Service
 * 
 * Price lock functionality - now client-side with trip metadata.
 * Stores price lock data in trip metadata field.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  tripId?: string;
}

export interface PriceLockData {
  id: string;
  itemType: PriceLockItemType;
  itemId: string;
  lockedPrice: number;
  currency: string;
  status: PriceLockStatus;
  expiresIn: number;
  expiresAt?: string;
  clientSecret?: string;
}

export interface PriceLockResponse {
  priceLock: {
    id: string;
    expiresAt: string;
    amount: number;
  };
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

// Price lock duration (30 minutes)
const PRICE_LOCK_DURATION_MS = 30 * 60 * 1000;

// ============================================================================
// Price Lock Storage (using localStorage as fallback)
// ============================================================================

const PRICE_LOCKS_KEY = 'voyance_price_locks';

function getPriceLocks(): Record<string, PriceLockData> {
  try {
    const stored = localStorage.getItem(PRICE_LOCKS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePriceLock(lock: PriceLockData): void {
  const locks = getPriceLocks();
  locks[lock.id] = lock;
  localStorage.setItem(PRICE_LOCKS_KEY, JSON.stringify(locks));
}

function removePriceLock(lockId: string): void {
  const locks = getPriceLocks();
  delete locks[lockId];
  localStorage.setItem(PRICE_LOCKS_KEY, JSON.stringify(locks));
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
  const lockId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + PRICE_LOCK_DURATION_MS).toISOString();
  const expiresIn = Math.floor(PRICE_LOCK_DURATION_MS / 1000);

  const lock: PriceLockData = {
    id: lockId,
    itemType: input.itemType,
    itemId: input.itemId,
    lockedPrice: input.price,
    currency: input.currency || 'USD',
    status: 'active',
    expiresIn,
    expiresAt,
  };

  savePriceLock(lock);

  // If tripId provided, also update trip metadata
  if (input.tripId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: trip } = await supabase
        .from('trips')
        .select('metadata')
        .eq('id', input.tripId)
        .eq('user_id', user.id)
        .single();

      if (trip) {
        const metadata = (trip.metadata as Record<string, unknown>) || {};
        const priceLocks = (metadata.priceLocks as Record<string, unknown>) || {};
        priceLocks[lockId] = lock;

        await supabase
          .from('trips')
          .update({
            metadata: JSON.parse(JSON.stringify({ ...metadata, priceLocks })),
            price_lock_expires_at: expiresAt,
          })
          .eq('id', input.tripId)
          .eq('user_id', user.id);
      }
    }
  }

  return {
    priceLock: {
      id: lockId,
      expiresAt,
      amount: input.price,
    },
    id: lockId,
    itemType: input.itemType,
    itemId: input.itemId,
    lockedPrice: input.price,
    currency: input.currency || 'USD',
    status: 'active',
    expiresIn,
  };
}

/**
 * Get price lock status by ID
 */
export async function getPriceLockStatus(
  lockId: string
): Promise<PriceLockStatusResponse> {
  const locks = getPriceLocks();
  const lock = locks[lockId];

  if (!lock) {
    return { success: false, error: 'Price lock not found' };
  }

  // Check if expired
  if (lock.expiresAt && new Date(lock.expiresAt) < new Date()) {
    lock.status = 'expired';
    lock.expiresIn = 0;
    savePriceLock(lock);
  } else if (lock.expiresAt) {
    lock.expiresIn = Math.max(0, Math.floor((new Date(lock.expiresAt).getTime() - Date.now()) / 1000));
  }

  return { success: true, priceLock: lock };
}

/**
 * Cancel a price lock
 */
export async function cancelPriceLock(
  lockId: string
): Promise<{ success: boolean; message?: string }> {
  const locks = getPriceLocks();
  const lock = locks[lockId];

  if (!lock) {
    return { success: false, message: 'Price lock not found' };
  }

  lock.status = 'cancelled';
  savePriceLock(lock);

  return { success: true, message: 'Price lock cancelled' };
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

export function usePriceLockStatus(lockId: string | null) {
  return useQuery({
    queryKey: ['price-lock', lockId],
    queryFn: () => lockId ? getPriceLockStatus(lockId) : Promise.reject('No lock ID'),
    enabled: !!lockId,
    staleTime: 10_000,
    refetchInterval: 10_000,
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
