/**
 * Voyance Budget API Service
 * 
 * Integrates with Railway backend budget endpoints:
 * - POST /api/v1/budget/aggregate - Aggregate trip costs
 * - PATCH /api/v1/budget/:tripId/override - Apply budget overrides
 * - GET /api/v1/budget/:tripId - Get trip budget data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type CostCategory = 'flight' | 'hotel' | 'activity' | 'transport' | 'meal' | 'other';
export type CostSource = 'booking' | 'estimate' | 'manual';

export interface CostItem {
  id: string;
  category: CostCategory;
  amount: number;
  currency: string;
  description?: string;
  bookingId?: string;
  isEstimate: boolean;
  source: CostSource;
  metadata?: Record<string, unknown>;
}

export interface AggregateBudgetInput {
  tripId: string;
  costItems: CostItem[];
  targetCurrency?: string;
  includeEstimates?: boolean;
  exchangeRates?: Record<string, number>;
}

export interface CategoryBreakdown {
  flight: number;
  hotel: number;
  activity: number;
  transport: number;
  meal: number;
  other: number;
}

export interface AggregateBudgetResponse {
  success: boolean;
  data?: {
    tripId: string;
    totalAmount: number;
    currency: string;
    breakdown: CategoryBreakdown;
    hasEstimates: boolean;
    hasManualOverrides: boolean;
    confidence: number;
    calculatedAt: string;
    stored: boolean;
  };
  error?: string;
  message?: string;
}

export interface BudgetOverrideInput {
  totalCostAmount?: number;
  totalCostCurrency?: string;
  costBreakdown?: Record<string, unknown>;
  hasOverrides?: boolean;
}

export interface BudgetOverrideResponse {
  success: boolean;
  data?: {
    tripId: string;
    totalCostAmount: string | null;
    totalCostCurrency: string | null;
    costBreakdown: Record<string, unknown> | null;
    hasOverrides: boolean;
    updatedAt: string;
  };
  error?: string;
  message?: string;
}

export interface TripBudgetData {
  tripId: string;
  totalCostAmount: number | null;
  totalCostCurrency: string | null;
  costBreakdown: CategoryBreakdown | null;
  hasEstimates: boolean;
  hasOverrides: boolean;
  costLastCalculated: string | null;
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

async function budgetApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/budget${endpoint}`, {
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
// Budget API
// ============================================================================

/**
 * Aggregate costs for a trip
 */
export async function aggregateBudget(input: AggregateBudgetInput): Promise<AggregateBudgetResponse> {
  return budgetApiRequest<AggregateBudgetResponse>('/aggregate', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      targetCurrency: input.targetCurrency || 'USD',
      includeEstimates: input.includeEstimates ?? true,
    }),
  });
}

/**
 * Apply budget overrides to a trip
 */
export async function overrideBudget(
  tripId: string,
  input: BudgetOverrideInput
): Promise<BudgetOverrideResponse> {
  return budgetApiRequest<BudgetOverrideResponse>(`/${tripId}/override`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...input,
      hasOverrides: input.hasOverrides ?? true,
    }),
  });
}

/**
 * Get trip budget data
 */
export async function getTripBudget(tripId: string): Promise<TripBudgetData> {
  return budgetApiRequest<TripBudgetData>(`/${tripId}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format budget amount for display
 */
export function formatBudgetAmount(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get category label for display
 */
export function getCategoryLabel(category: CostCategory): string {
  const labels: Record<CostCategory, string> = {
    flight: 'Flights',
    hotel: 'Accommodation',
    activity: 'Activities',
    transport: 'Transport',
    meal: 'Meals & Dining',
    other: 'Other',
  };
  return labels[category] || category;
}

/**
 * Get category icon name (for lucide-react)
 */
export function getCategoryIcon(category: CostCategory): string {
  const icons: Record<CostCategory, string> = {
    flight: 'Plane',
    hotel: 'Hotel',
    activity: 'MapPin',
    transport: 'Car',
    meal: 'Utensils',
    other: 'Receipt',
  };
  return icons[category] || 'Receipt';
}

/**
 * Calculate category percentage of total
 */
export function getCategoryPercentage(
  breakdown: CategoryBreakdown,
  category: CostCategory
): number {
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;
  return Math.round((breakdown[category] / total) * 100);
}

// ============================================================================
// React Query Hooks
// ============================================================================

const budgetKeys = {
  all: ['budget'] as const,
  trip: (tripId: string) => [...budgetKeys.all, 'trip', tripId] as const,
};

export function useTripBudget(tripId: string | null) {
  return useQuery({
    queryKey: budgetKeys.trip(tripId || ''),
    queryFn: () => tripId ? getTripBudget(tripId) : Promise.reject('No trip ID'),
    enabled: !!tripId,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useAggregateBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: aggregateBudget,
    onSuccess: (data) => {
      if (data.success && data.data?.tripId) {
        queryClient.invalidateQueries({ queryKey: budgetKeys.trip(data.data.tripId) });
      }
    },
  });
}

export function useOverrideBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: BudgetOverrideInput }) =>
      overrideBudget(tripId, input),
    onSuccess: (data) => {
      if (data.success && data.data?.tripId) {
        queryClient.invalidateQueries({ queryKey: budgetKeys.trip(data.data.tripId) });
      }
    },
  });
}

// Default export
export default {
  aggregateBudget,
  overrideBudget,
  getTripBudget,
  formatBudgetAmount,
  getCategoryLabel,
  getCategoryIcon,
  getCategoryPercentage,
};
