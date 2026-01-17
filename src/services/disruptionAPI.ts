/**
 * Voyance Disruption API Service
 * 
 * Integrates with Railway backend disruption prediction endpoints:
 * - POST /api/v1/disruption/predict - Get disruption predictions for a booking
 * - POST /api/v1/disruption/subscribe - Subscribe to disruption alerts
 * - DELETE /api/v1/disruption/subscribe/:bookingId - Unsubscribe from alerts
 * - GET /api/v1/disruption/history/:bookingId - Get disruption history
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type DisruptionSeverity = 'LOW' | 'MED' | 'HIGH';
export type DisruptionChannel = 'sse' | 'email' | 'sms';
export type DisruptionType = 'WEATHER' | 'CARRIER' | 'STRIKE' | 'CLOSURE' | 'OTHER';

export interface DisruptionPrediction {
  id: string;
  type: DisruptionType;
  severity: DisruptionSeverity;
  likelihood: number; // 0-100
  description: string;
  affectedSegment?: string;
  estimatedImpact?: string;
  recommendations: string[];
  predictedAt: string;
}

export interface PredictDisruptionInput {
  bookingId: string;
}

export interface PredictDisruptionResponse {
  success: boolean;
  predictions?: DisruptionPrediction[];
  overallRisk?: DisruptionSeverity;
  nextCheck?: string;
  error?: string;
}

export interface SubscribeInput {
  bookingId: string;
  threshold?: DisruptionSeverity;
  channels?: DisruptionChannel[];
}

export interface SubscribeResponse {
  success: boolean;
  subscriptionId?: string;
  message?: string;
  error?: string;
}

export interface UnsubscribeResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface DisruptionHistoryItem {
  id: string;
  type: DisruptionType;
  severity: DisruptionSeverity;
  description: string;
  occurredAt: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface DisruptionHistoryResponse {
  success: boolean;
  history?: DisruptionHistoryItem[];
  count?: number;
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

async function disruptionApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/disruption${endpoint}`, {
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
// Disruption API
// ============================================================================

/**
 * Get disruption predictions for a booking
 */
export async function predictDisruptions(
  input: PredictDisruptionInput
): Promise<PredictDisruptionResponse> {
  try {
    const response = await disruptionApiRequest<PredictDisruptionResponse>('/predict', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[DisruptionAPI] Predict error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to predict disruptions',
    };
  }
}

/**
 * Subscribe to disruption alerts for a booking
 */
export async function subscribeToDisruptions(
  input: SubscribeInput
): Promise<SubscribeResponse> {
  try {
    const response = await disruptionApiRequest<SubscribeResponse>('/subscribe', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[DisruptionAPI] Subscribe error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to subscribe',
    };
  }
}

/**
 * Unsubscribe from disruption alerts
 */
export async function unsubscribeFromDisruptions(
  bookingId: string
): Promise<UnsubscribeResponse> {
  try {
    const response = await disruptionApiRequest<UnsubscribeResponse>(`/subscribe/${bookingId}`, {
      method: 'DELETE',
    });
    return response;
  } catch (error) {
    console.error('[DisruptionAPI] Unsubscribe error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unsubscribe',
    };
  }
}

/**
 * Get disruption history for a booking
 */
export async function getDisruptionHistory(
  bookingId: string
): Promise<DisruptionHistoryResponse> {
  try {
    const response = await disruptionApiRequest<DisruptionHistoryResponse>(`/history/${bookingId}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[DisruptionAPI] History error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useDisruptionPredictions(bookingId: string | null) {
  return useQuery({
    queryKey: ['disruption-predictions', bookingId],
    queryFn: () => bookingId ? predictDisruptions({ bookingId }) : Promise.reject('No booking'),
    enabled: !!bookingId,
    staleTime: 5 * 60_000, // 5 minutes
    refetchInterval: 15 * 60_000, // Refresh every 15 minutes
  });
}

export function useDisruptionHistory(bookingId: string | null) {
  return useQuery({
    queryKey: ['disruption-history', bookingId],
    queryFn: () => bookingId ? getDisruptionHistory(bookingId) : Promise.reject('No booking'),
    enabled: !!bookingId,
    staleTime: 60_000, // 1 minute
  });
}

export function usePredictDisruptions() {
  return useMutation({
    mutationFn: predictDisruptions,
  });
}

export function useSubscribeToDisruptions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: subscribeToDisruptions,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['disruption-subscription', variables.bookingId] });
    },
  });
}

export function useUnsubscribeFromDisruptions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unsubscribeFromDisruptions,
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['disruption-subscription', bookingId] });
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getSeverityColor(severity: DisruptionSeverity): string {
  switch (severity) {
    case 'LOW': return 'text-green-600';
    case 'MED': return 'text-yellow-600';
    case 'HIGH': return 'text-red-600';
    default: return 'text-muted-foreground';
  }
}

export function getSeverityLabel(severity: DisruptionSeverity): string {
  switch (severity) {
    case 'LOW': return 'Low Risk';
    case 'MED': return 'Medium Risk';
    case 'HIGH': return 'High Risk';
    default: return 'Unknown';
  }
}

// ============================================================================
// Export
// ============================================================================

const disruptionAPI = {
  predictDisruptions,
  subscribeToDisruptions,
  unsubscribeFromDisruptions,
  getDisruptionHistory,
  getSeverityColor,
  getSeverityLabel,
};

export default disruptionAPI;
