/**
 * Price Monitor API Service
 * 
 * Handles price monitoring subscriptions for trips.
 * Uses Lovable Cloud edge function for sending price alerts.
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export interface PriceMonitorInput {
  tripId: string;
  email: string;
}

export interface PriceMonitorResponse {
  ok: boolean;
  subscribedAt: string;
}

export interface PriceChange {
  type: 'flight' | 'hotel' | 'both';
  previousPrice: number;
  currentPrice: number;
  savings: number;
  percentChange: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Subscribe to price monitoring for a trip
 * Stores subscription in trip metadata
 */
export async function subscribeToPriceMonitor(input: PriceMonitorInput): Promise<PriceMonitorResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Must be logged in to subscribe to price monitoring');
  }

  // Get current trip data
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('metadata, flight_selection, hotel_selection')
    .eq('id', input.tripId)
    .single();

  if (tripError || !trip) {
    throw new Error('Trip not found');
  }

  // Calculate current total price
  let currentPrice = 0;
  if (trip.flight_selection) {
    currentPrice += (trip.flight_selection as any).price || 0;
  }
  if (trip.hotel_selection) {
    currentPrice += (trip.hotel_selection as any).totalPrice || 0;
  }

  const existingMetadata = (trip.metadata as Record<string, unknown>) || {};
  const subscribedAt = new Date().toISOString();

  // Update trip metadata with price monitoring info
  const { error: updateError } = await supabase
    .from('trips')
    .update({
      metadata: {
        ...existingMetadata,
        price_monitor_enabled: true,
        price_monitor_email: input.email,
        price_monitor_subscribed_at: subscribedAt,
        last_checked_price: currentPrice,
        last_price_check: subscribedAt,
      },
    })
    .eq('id', input.tripId);

  if (updateError) {
    throw new Error('Failed to enable price monitoring');
  }

  return {
    ok: true,
    subscribedAt,
  };
}

/**
 * Unsubscribe from price monitoring
 */
export async function unsubscribeFromPriceMonitor(tripId: string): Promise<void> {
  const { data: trip } = await supabase
    .from('trips')
    .select('metadata')
    .eq('id', tripId)
    .single();

  const existingMetadata = (trip?.metadata as Record<string, unknown>) || {};

  await supabase
    .from('trips')
    .update({
      metadata: {
        ...existingMetadata,
        price_monitor_enabled: false,
      },
    })
    .eq('id', tripId);
}

/**
 * Check if price monitoring is enabled for a trip
 */
export async function isPriceMonitorEnabled(tripId: string): Promise<boolean> {
  const { data: trip } = await supabase
    .from('trips')
    .select('metadata')
    .eq('id', tripId)
    .single();

  return (trip?.metadata as any)?.price_monitor_enabled === true;
}

/**
 * Manually trigger a price alert (for testing or immediate notification)
 */
export async function triggerPriceAlert(
  tripId: string, 
  priceChange: PriceChange
): Promise<{ ok: boolean; sent?: boolean }> {
  const { data, error } = await supabase.functions.invoke('send-price-alerts', {
    body: { tripId, priceChange },
  });

  if (error) {
    throw new Error(`Failed to send price alert: ${error.message}`);
  }

  return data;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useSubscribeToPriceMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscribeToPriceMonitor,
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['price-monitor', tripId] });
    },
  });
}

export function useUnsubscribeFromPriceMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unsubscribeFromPriceMonitor,
    onSuccess: (_, tripId) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['price-monitor', tripId] });
    },
  });
}

export function usePriceMonitorStatus(tripId: string | null) {
  return useQuery({
    queryKey: ['price-monitor', tripId],
    queryFn: () => isPriceMonitorEnabled(tripId!),
    enabled: !!tripId,
  });
}

export function useTriggerPriceAlert() {
  return useMutation({
    mutationFn: ({ tripId, priceChange }: { tripId: string; priceChange: PriceChange }) =>
      triggerPriceAlert(tripId, priceChange),
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatSubscriptionDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calculatePriceChange(
  previousPrice: number,
  currentPrice: number,
  type: 'flight' | 'hotel' | 'both' = 'both'
): PriceChange {
  const savings = previousPrice - currentPrice;
  const percentChange = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
  
  return {
    type,
    previousPrice,
    currentPrice,
    savings,
    percentChange,
  };
}
