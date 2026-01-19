/**
 * Voyance Meal Plans API Service
 * 
 * Integrates with Railway backend meal plans endpoints:
 * - GET /api/v1/meal-plans/:tripId - Get all meal plans for a trip
 * - POST /api/v1/meal-plans/:tripId - Create a meal plan
 * - PUT /api/v1/meal-plans/:tripId/:mealPlanId - Update a meal plan
 * - DELETE /api/v1/meal-plans/:tripId/:mealPlanId - Delete a meal plan
 * - POST /api/v1/meal-plans/:tripId/sync - Sync meal plans
 * - POST /api/v1/mealplans/pricing/:destinationId/sync - Sync pricing
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface MealPlanPrice {
  amount: number;
  currency: string;
}

export interface MealPlan {
  id: string;
  tripId: string;
  planType: string;
  restaurantName?: string;
  cuisine?: string;
  pricePerPerson?: MealPlanPrice;
  dietaryRestrictions?: string[];
  notes?: string;
  startDate: string;
  endDate: string;
  source: 'manual' | 'ai' | 'sync';
  aiGenerated?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMealPlanInput {
  tripId: string;
  planType: string;
  restaurantName?: string;
  cuisine?: string;
  pricePerPerson?: MealPlanPrice;
  dietaryRestrictions?: string[];
  notes?: string;
  startDate: string;
  endDate: string;
  source?: 'manual' | 'ai' | 'sync';
  aiGenerated?: Record<string, unknown>;
}

export interface UpdateMealPlanInput extends Partial<Omit<CreateMealPlanInput, 'tripId'>> {
  tripId: string;
  mealPlanId: string;
}

export interface DeleteMealPlanInput {
  tripId: string;
  mealPlanId: string;
}

export interface SyncMealPlansInput {
  tripId: string;
  mealPlans: Omit<CreateMealPlanInput, 'tripId'>[];
}

export interface MealPricing {
  breakfast: { budget: number; midRange: number; luxury: number };
  lunch: { budget: number; midRange: number; luxury: number };
  dinner: { budget: number; midRange: number; luxury: number };
  currency: string;
}

export interface SyncMealPricingInput {
  destinationId: string;
  mealPricing: MealPricing;
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

async function mealPlansApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/meal-plans${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Meal Plans API
// ============================================================================

/**
 * Get all meal plans for a trip
 */
export async function getMealPlans(tripId: string): Promise<MealPlan[]> {
  try {
    const response = await mealPlansApiRequest<MealPlan[]>(`/${tripId}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[MealPlansAPI] Get error:', error);
    throw error;
  }
}

/**
 * Create a meal plan
 */
export async function createMealPlan(input: CreateMealPlanInput): Promise<MealPlan> {
  try {
    const { tripId, ...body } = input;
    const response = await mealPlansApiRequest<MealPlan>(`/${tripId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response;
  } catch (error) {
    console.error('[MealPlansAPI] Create error:', error);
    throw error;
  }
}

/**
 * Update a meal plan
 */
export async function updateMealPlan(input: UpdateMealPlanInput): Promise<MealPlan> {
  try {
    const { tripId, mealPlanId, ...body } = input;
    const response = await mealPlansApiRequest<MealPlan>(`/${tripId}/${mealPlanId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return response;
  } catch (error) {
    console.error('[MealPlansAPI] Update error:', error);
    throw error;
  }
}

/**
 * Delete a meal plan
 */
export async function deleteMealPlan(input: DeleteMealPlanInput): Promise<{ success: boolean }> {
  try {
    const response = await mealPlansApiRequest<{ success: boolean }>(
      `/${input.tripId}/${input.mealPlanId}`,
      { method: 'DELETE' }
    );
    return response;
  } catch (error) {
    console.error('[MealPlansAPI] Delete error:', error);
    throw error;
  }
}

/**
 * Sync meal plans for a trip
 */
export async function syncMealPlans(input: SyncMealPlansInput): Promise<{ success: boolean; count: number }> {
  try {
    const response = await mealPlansApiRequest<{ success: boolean; count: number }>(
      `/${input.tripId}/sync`,
      {
        method: 'POST',
        body: JSON.stringify({ mealPlans: input.mealPlans }),
      }
    );
    return response;
  } catch (error) {
    console.error('[MealPlansAPI] Sync error:', error);
    throw error;
  }
}

/**
 * Sync meal pricing for a destination
 */
export async function syncMealPricing(input: SyncMealPricingInput): Promise<{ success: boolean; message: string }> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(
      `${BACKEND_URL}/api/v1/mealplans/pricing/${input.destinationId}/sync`,
      {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ mealPricing: input.mealPricing }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[MealPlansAPI] Sync pricing error:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useMealPlans(tripId: string | null) {
  return useQuery({
    queryKey: ['meal-plans', tripId],
    queryFn: () => tripId ? getMealPlans(tripId) : Promise.reject('No trip'),
    enabled: !!tripId,
    staleTime: 60_000,
  });
}

export function useCreateMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createMealPlan,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans', variables.tripId] });
    },
  });
}

export function useUpdateMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateMealPlan,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans', variables.tripId] });
    },
  });
}

export function useDeleteMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteMealPlan,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans', variables.tripId] });
    },
  });
}

export function useSyncMealPlans() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: syncMealPlans,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans', variables.tripId] });
    },
  });
}

export function useSyncMealPricing() {
  return useMutation({
    mutationFn: syncMealPricing,
  });
}

// ============================================================================
// Export
// ============================================================================

const mealPlansAPI = {
  getMealPlans,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
  syncMealPlans,
  syncMealPricing,
};

export default mealPlansAPI;
