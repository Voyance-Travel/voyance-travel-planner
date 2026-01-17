/**
 * Price Monitor API Service
 * 
 * Handles price monitoring subscriptions for trips.
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

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
 * Subscribe to price monitoring for a trip
 */
export async function subscribeToPriceMonitor(input: PriceMonitorInput): Promise<PriceMonitorResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/price-monitor/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Subscription failed' }));
    throw new Error(error.error || error.message || 'Failed to subscribe to price monitor');
  }

  return response.json();
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
    },
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
