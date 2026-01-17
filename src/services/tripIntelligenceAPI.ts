/**
 * Voyance Trip Intelligence API Service
 * 
 * Integrates with Railway backend trip intelligence endpoints:
 * - GET /api/trips/:tripId/intelligence - Get complete trip intelligence
 * - POST /api/trips/:tripId/intelligence/refresh - Force refresh intelligence
 * - GET /api/trips/:tripId/budget - Budget-specific intelligence
 * - POST /api/trips/:tripId/budget/action - Budget actions
 * - GET /api/trips/:tripId/disruptions - Disruption monitoring
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type InsightType = 
  | 'budget_intelligence'
  | 'preference_weights'
  | 'disruption_monitoring'
  | 'airport_options'
  | 'all';

export type TripEventType =
  | 'trip_created'
  | 'budget_updated'
  | 'item_added'
  | 'item_removed'
  | 'preferences_changed'
  | 'dates_changed'
  | 'destination_changed'
  | 'booking_confirmed'
  | 'disruption_detected'
  | 'user_interaction';

export interface BudgetInsight {
  totalBudget: number;
  spent: number;
  remaining: number;
  projectedSpend: number;
  budgetZone: 'under' | 'on-track' | 'over';
  recommendations?: string[];
  savingsOpportunities?: Array<{
    category: string;
    potentialSavings: number;
    suggestion: string;
  }>;
}

export interface PreferenceWeight {
  category: string;
  weight: number;
  influencingFactors: string[];
}

export interface Disruption {
  id: string;
  type: 'flight_delay' | 'cancellation' | 'weather' | 'price_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedItem: string;
  description: string;
  detectedAt: string;
  alternatives?: Array<{
    id: string;
    description: string;
    priceChange?: number;
  }>;
}

export interface AirportOption {
  code: string;
  name: string;
  city: string;
  distance: number;
  priceImpact: number;
  recommendation?: string;
}

export interface TripIntelligence {
  tripId: string;
  insights: {
    budget?: BudgetInsight;
    preferences?: PreferenceWeight[];
    disruptions?: Disruption[];
    airportOptions?: {
      origin: AirportOption[];
      destination: AirportOption[];
    };
  };
  metadata: {
    generatedAt: string;
    cacheExpiry: string;
    dataFreshness: 'realtime' | 'cached' | 'stale';
  };
}

export interface TripIntelligenceResponse {
  success: boolean;
  data?: TripIntelligence;
  timestamp: string;
  error?: string;
}

export interface BudgetActionInput {
  tripId: string;
  action: 'optimize' | 'scenario' | 'zone_change' | 'split_update';
  data?: Record<string, unknown>;
}

export interface DisruptionActionInput {
  tripId: string;
  disruptionId?: string;
  action: 'acknowledge' | 'take_action' | 'get_alternatives';
  userChoice?: string;
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
 * Get complete trip intelligence
 */
export async function getTripIntelligence(
  tripId: string,
  insights: InsightType[] = ['all'],
  forceRefresh = false
): Promise<TripIntelligenceResponse> {
  const headers = await getAuthHeader();
  
  const queryParams = new URLSearchParams();
  if (insights.length > 0 && !insights.includes('all')) {
    queryParams.set('insights', insights.join(','));
  }
  if (forceRefresh) {
    queryParams.set('refresh', 'true');
  }
  
  const url = `${BACKEND_URL}/api/trips/${tripId}/intelligence${queryParams.toString() ? `?${queryParams}` : ''}`;
  
  const response = await fetch(url, {
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
 * Force refresh trip intelligence
 */
export async function refreshTripIntelligence(
  tripId: string,
  insights: InsightType[] = ['all'],
  triggerEvent: TripEventType = 'user_interaction'
): Promise<TripIntelligenceResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/trips/${tripId}/intelligence/refresh`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ insights, triggerEvent }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get budget-specific intelligence
 */
export async function getTripBudget(tripId: string): Promise<{
  success: boolean;
  data?: {
    budget: BudgetInsight;
    insights: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
  error?: string;
}> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/trips/${tripId}/budget`, {
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
 * Perform budget action
 */
export async function performBudgetAction(
  input: BudgetActionInput
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/trips/${input.tripId}/budget/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: input.action,
      data: input.data,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get disruption monitoring data
 */
export async function getTripDisruptions(tripId: string): Promise<{
  success: boolean;
  data?: {
    disruptions: Disruption[];
    activeAlerts: number;
  };
  error?: string;
}> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/trips/${tripId}/disruptions`, {
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
 * Perform disruption action
 */
export async function handleDisruption(
  input: DisruptionActionInput
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/trips/${input.tripId}/disruptions/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      disruptionId: input.disruptionId,
      action: input.action,
      userChoice: input.userChoice,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useTripIntelligence(
  tripId: string | null,
  insights: InsightType[] = ['all'],
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useQuery({
    queryKey: ['trip-intelligence', tripId, insights],
    queryFn: () => tripId ? getTripIntelligence(tripId, insights) : Promise.reject('No trip ID'),
    enabled: options?.enabled !== false && !!tripId,
    staleTime: 60_000, // 1 minute
    refetchInterval: options?.refetchInterval,
  });
}

export function useRefreshTripIntelligence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, insights, triggerEvent }: {
      tripId: string;
      insights?: InsightType[];
      triggerEvent?: TripEventType;
    }) => refreshTripIntelligence(tripId, insights, triggerEvent),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-intelligence', variables.tripId] });
    },
  });
}

export function useTripBudget(tripId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['trip-budget', tripId],
    queryFn: () => tripId ? getTripBudget(tripId) : Promise.reject('No trip ID'),
    enabled: options?.enabled !== false && !!tripId,
    staleTime: 30_000, // 30 seconds
  });
}

export function useBudgetAction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: performBudgetAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-budget', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-intelligence', variables.tripId] });
    },
  });
}

export function useTripDisruptions(
  tripId: string | null,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useQuery({
    queryKey: ['trip-disruptions', tripId],
    queryFn: () => tripId ? getTripDisruptions(tripId) : Promise.reject('No trip ID'),
    enabled: options?.enabled !== false && !!tripId,
    staleTime: 30_000, // 30 seconds - disruptions need frequent checks
    refetchInterval: options?.refetchInterval || 60_000, // Auto-refresh every minute
  });
}

export function useHandleDisruption() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: handleDisruption,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-disruptions', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-intelligence', variables.tripId] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const tripIntelligenceAPI = {
  getTripIntelligence,
  refreshTripIntelligence,
  getTripBudget,
  performBudgetAction,
  getTripDisruptions,
  handleDisruption,
};

export default tripIntelligenceAPI;
