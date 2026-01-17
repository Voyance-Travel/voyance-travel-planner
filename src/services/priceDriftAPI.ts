/**
 * Voyance Price Drift API Service
 * 
 * Integrates with Railway backend price drift endpoints:
 * - POST /api/v1/price-drift/track - Start tracking price changes
 * - GET /api/v1/price-drift/:id/status - Get price status and history
 * - POST /api/v1/price-drift/:id/stop - Stop tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type PriceItemType = 'flight' | 'hotel' | 'bundle';

export interface TrackPriceInput {
  itemId: string;
  itemType: PriceItemType;
  originalPrice: number;
  currency?: string;
  alertThreshold?: number; // Percentage (0-100)
}

export interface TrackPriceResponse {
  success: boolean;
  data?: {
    trackingId: string;
    itemId: string;
    itemType: PriceItemType;
    originalPrice: number;
    currency: string;
    alertThreshold: number;
    alertEnabled: boolean;
    trackedSince: string;
  };
  error?: string;
}

export interface PriceHistoryEntry {
  price: number;
  timestamp: string;
  change?: number;
  changePercent?: number;
}

export interface DriftAnalysis {
  hasDrift: boolean;
  driftAmount: number;
  driftPercent: number;
  direction: 'up' | 'down' | 'stable';
  recommendation: string;
  confidenceScore: number;
}

export interface PriceStatusResponse {
  success: boolean;
  data?: {
    trackingId: string;
    itemId: string;
    itemType: PriceItemType;
    originalPrice: number;
    currentPrice: number;
    currency: string;
    alertThreshold: number;
    alertEnabled: boolean;
    trackedSince: string;
    lastChecked: string | null;
    priceHistory: PriceHistoryEntry[];
    driftAnalysis: DriftAnalysis | null;
  };
  error?: string;
}

export interface StopTrackingResponse {
  success: boolean;
  message?: string;
  error?: string;
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

async function priceDriftApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/price-drift${endpoint}`, {
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
// Price Drift API
// ============================================================================

/**
 * Start tracking price changes for an item
 */
export async function trackPrice(input: TrackPriceInput): Promise<TrackPriceResponse> {
  return priceDriftApiRequest<TrackPriceResponse>('/track', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      currency: input.currency || 'USD',
      alertThreshold: input.alertThreshold || 5.0,
    }),
  });
}

/**
 * Get current price status and history
 */
export async function getPriceStatus(trackingId: string): Promise<PriceStatusResponse> {
  return priceDriftApiRequest<PriceStatusResponse>(`/${trackingId}/status`);
}

/**
 * Stop tracking price changes
 */
export async function stopTracking(trackingId: string): Promise<StopTrackingResponse> {
  return priceDriftApiRequest<StopTrackingResponse>(`/${trackingId}/stop`, {
    method: 'POST',
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get drift direction label
 */
export function getDriftDirectionLabel(direction: DriftAnalysis['direction']): string {
  switch (direction) {
    case 'up': return 'Price Increased';
    case 'down': return 'Price Decreased';
    case 'stable': return 'Price Stable';
  }
}

/**
 * Get drift direction color
 */
export function getDriftDirectionColor(direction: DriftAnalysis['direction']): string {
  switch (direction) {
    case 'up': return 'red';
    case 'down': return 'green';
    case 'stable': return 'gray';
  }
}

/**
 * Format price change for display
 */
export function formatPriceChange(amount: number, currency: string = 'USD'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Math.abs(amount));
  
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

// ============================================================================
// React Query Hooks
// ============================================================================

const priceDriftKeys = {
  all: ['price-drift'] as const,
  status: (id: string) => [...priceDriftKeys.all, 'status', id] as const,
};

export function usePriceStatus(trackingId: string | null) {
  return useQuery({
    queryKey: priceDriftKeys.status(trackingId || ''),
    queryFn: () => trackingId ? getPriceStatus(trackingId) : Promise.reject('No tracking ID'),
    enabled: !!trackingId,
    staleTime: 60_000, // 1 minute
    refetchInterval: 5 * 60_000, // Refetch every 5 minutes for live tracking
  });
}

export function useTrackPrice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: trackPrice,
    onSuccess: (data) => {
      if (data.success && data.data?.trackingId) {
        queryClient.invalidateQueries({ queryKey: priceDriftKeys.all });
      }
    },
  });
}

export function useStopTracking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: stopTracking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceDriftKeys.all });
    },
  });
}

// Default export
export default {
  trackPrice,
  getPriceStatus,
  stopTracking,
  getDriftDirectionLabel,
  getDriftDirectionColor,
  formatPriceChange,
};
