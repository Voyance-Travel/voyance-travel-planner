/**
 * Price Drift Extended API Service
 * 
 * Extended price tracking with drift detection and real-time alerts.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type PriceItemType = 'flight' | 'hotel' | 'bundle';

export interface TrackPriceInput {
  itemId: string;
  itemType: PriceItemType;
  originalPrice: number;
  currency?: string;
  alertThreshold?: number; // percentage
}

export interface PriceTrackingRecord {
  trackingId: string;
  itemId: string;
  itemType: PriceItemType;
  originalPrice: number;
  currentPrice: number;
  currency: string;
  alertThreshold: number;
  alertEnabled: boolean;
  trackedSince: string;
  lastChecked?: string;
  priceHistory: PriceHistoryEntry[];
  driftAnalysis?: DriftAnalysis | null;
}

export interface PriceHistoryEntry {
  price: number;
  timestamp: string;
  source?: string;
}

export interface DriftAnalysis {
  hasDrift: boolean;
  driftPercentage: number;
  driftDirection: 'up' | 'down' | 'stable';
  significance: 'low' | 'medium' | 'high';
  recommendation?: string;
  predictedTrend?: 'increasing' | 'decreasing' | 'stable';
}

export interface TrackPriceResponse {
  success: boolean;
  data: {
    trackingId: string;
    itemId: string;
    itemType: PriceItemType;
    originalPrice: number;
    currency: string;
    alertThreshold: number;
    alertEnabled: boolean;
    trackedSince: string;
  };
}

export interface PriceStatusResponse {
  success: boolean;
  data: PriceTrackingRecord;
}

export interface StopTrackingResponse {
  success: boolean;
  data: {
    trackingId: string;
    alertEnabled: boolean;
    stoppedAt: string;
  };
}

export interface PriceAlertEvent {
  type: 'price-alert' | 'connected' | 'heartbeat';
  data?: {
    trackingId: string;
    itemId: string;
    itemType: PriceItemType;
    oldPrice: number;
    newPrice: number;
    changePercent: number;
    direction: 'up' | 'down';
    currency: string;
  };
  timestamp: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  const token = localStorage.getItem('voyance_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Start tracking price changes for an item
 */
export async function trackPrice(input: TrackPriceInput): Promise<TrackPriceResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/price-drift/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Track failed' }));
    throw new Error(error.error || 'Failed to start price tracking');
  }

  return response.json();
}

/**
 * Get current price status and drift analysis
 */
export async function getPriceStatus(trackingId: string): Promise<PriceStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/price-drift/${trackingId}/status`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to get price status');
  }

  return response.json();
}

/**
 * Stop tracking price changes
 */
export async function stopPriceTracking(trackingId: string): Promise<StopTrackingResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/price-drift/${trackingId}/stop`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Stop failed' }));
    throw new Error(error.error || 'Failed to stop price tracking');
  }

  return response.json();
}

/**
 * Subscribe to real-time price alerts via SSE
 */
export function subscribeToPriceAlerts(
  onAlert: (event: PriceAlertEvent) => void,
  onError?: (error: Error) => void
): () => void {
  let eventSource: EventSource | null = null;

  const connect = async () => {
    try {
      const headers = await getAuthHeader();
      const token = headers.Authorization?.replace('Bearer ', '');
      
      const url = new URL(`${API_BASE_URL}/api/v1/price-drift/alerts`);
      if (token) {
        url.searchParams.set('token', token);
      }

      eventSource = new EventSource(url.toString());

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as PriceAlertEvent;
          onAlert(data);
        } catch (e) {
          console.error('Failed to parse price alert:', e);
        }
      };

      eventSource.onerror = () => {
        onError?.(new Error('Price alert connection error'));
        // Attempt to reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to connect'));
    }
  };

  connect();

  // Return cleanup function
  return () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useTrackPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: trackPrice,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['price-tracking', data.data.trackingId] });
    },
  });
}

export function usePriceStatus(trackingId: string | null) {
  return useQuery({
    queryKey: ['price-tracking', trackingId],
    queryFn: () => getPriceStatus(trackingId!),
    enabled: !!trackingId,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}

export function useStopPriceTracking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopPriceTracking,
    onSuccess: (_, trackingId) => {
      queryClient.invalidateQueries({ queryKey: ['price-tracking', trackingId] });
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatPriceChange(oldPrice: number, newPrice: number): string {
  const change = newPrice - oldPrice;
  const percentChange = ((change / oldPrice) * 100).toFixed(1);
  const sign = change >= 0 ? '+' : '';
  return `${sign}${percentChange}%`;
}

export function getPriceChangeColor(oldPrice: number, newPrice: number): string {
  if (newPrice < oldPrice) return 'text-green-600';
  if (newPrice > oldPrice) return 'text-red-600';
  return 'text-gray-600';
}

export function getDriftSignificanceLabel(significance: DriftAnalysis['significance']): string {
  const labels: Record<DriftAnalysis['significance'], string> = {
    low: 'Minor Change',
    medium: 'Moderate Change',
    high: 'Significant Change',
  };
  return labels[significance];
}

export function getDriftSignificanceColor(significance: DriftAnalysis['significance']): string {
  const colors: Record<DriftAnalysis['significance'], string> = {
    low: 'text-gray-500',
    medium: 'text-yellow-600',
    high: 'text-red-600',
  };
  return colors[significance];
}

export function formatTrackedSince(trackedSince: string): string {
  const date = new Date(trackedSince);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}
