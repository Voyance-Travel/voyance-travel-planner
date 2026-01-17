/**
 * Trip Budget & Companions API Service
 * 
 * Handles trip budget breakdown and travel companion management.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type RelationshipType = 'spouse' | 'friend' | 'family' | 'colleague' | 'other';
export type AgeGroup = 'child' | 'teen' | 'adult' | 'senior';
export type CompanionStatus = 'pending' | 'confirmed' | 'declined';

export interface BudgetBreakdown {
  id?: string;
  tripId?: string;
  totalBudget?: number | null;
  flightBudget?: number | null;
  hotelBudget?: number | null;
  activitiesBudget?: number | null;
  foodBudget?: number | null;
  transportBudget?: number | null;
  miscBudget?: number | null;
  currency: string;
}

export interface BudgetInput {
  totalBudget?: number;
  flightBudget?: number;
  hotelBudget?: number;
  activitiesBudget?: number;
  foodBudget?: number;
  transportBudget?: number;
  miscBudget?: number;
  currency?: string;
}

export interface UserDetails {
  name?: string;
  email?: string;
  avatar?: string;
}

export interface TripCompanion {
  id: string;
  tripId: string;
  userId?: string;
  name: string;
  email?: string;
  phone?: string;
  relationshipType?: RelationshipType;
  ageGroup?: AgeGroup;
  dietaryRestrictions?: string[];
  accessibilityNeeds?: string[];
  notes?: string;
  preferences?: Record<string, unknown>;
  isPrimary: boolean;
  orderIndex: number;
  status?: CompanionStatus;
  userDetails?: UserDetails | null;
}

export interface CompanionInput {
  userId?: string;
  name: string;
  email?: string;
  phone?: string;
  relationshipType?: RelationshipType;
  ageGroup?: AgeGroup;
  dietaryRestrictions?: string[];
  accessibilityNeeds?: string[];
  notes?: string;
  preferences?: Record<string, unknown>;
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
 * Get budget breakdown for a trip
 */
export async function getTripBudget(tripId: string): Promise<{ budget: BudgetBreakdown }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/budget`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch trip budget');
  }

  return response.json();
}

/**
 * Update budget breakdown for a trip
 */
export async function updateTripBudget(
  tripId: string,
  budget: BudgetInput
): Promise<{ budget: BudgetBreakdown }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/budget`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(budget),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Update failed' }));
    throw new Error(error.error || 'Failed to update trip budget');
  }

  return response.json();
}

/**
 * Get companions for a trip
 */
export async function getTripCompanions(tripId: string): Promise<{ companions: TripCompanion[] }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/companions`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch trip companions');
  }

  return response.json();
}

/**
 * Add a companion to a trip
 */
export async function addTripCompanion(
  tripId: string,
  companion: CompanionInput
): Promise<{ companion: TripCompanion }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/companions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(companion),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Add failed' }));
    throw new Error(error.error || 'Failed to add companion');
  }

  return response.json();
}

/**
 * Remove a companion from a trip
 */
export async function removeTripCompanion(
  tripId: string,
  companionId: string
): Promise<{ success: boolean }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/companions/${companionId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Remove failed' }));
    throw new Error(error.error || 'Failed to remove companion');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useTripBudget(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-budget', tripId],
    queryFn: () => getTripBudget(tripId!),
    enabled: !!tripId,
    staleTime: 60000,
  });
}

export function useUpdateTripBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, budget }: { tripId: string; budget: BudgetInput }) =>
      updateTripBudget(tripId, budget),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip-budget', tripId] });
    },
  });
}

export function useTripCompanions(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-companions', tripId],
    queryFn: () => getTripCompanions(tripId!),
    enabled: !!tripId,
    staleTime: 60000,
  });
}

export function useAddTripCompanion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, companion }: { tripId: string; companion: CompanionInput }) =>
      addTripCompanion(tripId, companion),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip-companions', tripId] });
    },
  });
}

export function useRemoveTripCompanion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, companionId }: { tripId: string; companionId: string }) =>
      removeTripCompanion(tripId, companionId),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip-companions', tripId] });
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function calculateBudgetTotal(budget: BudgetBreakdown): number {
  return (
    (budget.flightBudget || 0) +
    (budget.hotelBudget || 0) +
    (budget.activitiesBudget || 0) +
    (budget.foodBudget || 0) +
    (budget.transportBudget || 0) +
    (budget.miscBudget || 0)
  );
}

export function getBudgetCategoryLabel(category: keyof BudgetBreakdown): string {
  const labels: Record<string, string> = {
    flightBudget: 'Flights',
    hotelBudget: 'Accommodation',
    activitiesBudget: 'Activities',
    foodBudget: 'Food & Dining',
    transportBudget: 'Local Transport',
    miscBudget: 'Miscellaneous',
    totalBudget: 'Total Budget',
  };
  return labels[category] || category;
}

export function getRelationshipLabel(type: RelationshipType): string {
  const labels: Record<RelationshipType, string> = {
    spouse: 'Spouse/Partner',
    friend: 'Friend',
    family: 'Family',
    colleague: 'Colleague',
    other: 'Other',
  };
  return labels[type];
}

export function getAgeGroupLabel(group: AgeGroup): string {
  const labels: Record<AgeGroup, string> = {
    child: 'Child (0-12)',
    teen: 'Teen (13-17)',
    adult: 'Adult (18-64)',
    senior: 'Senior (65+)',
  };
  return labels[group];
}
