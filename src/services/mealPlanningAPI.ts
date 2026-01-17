/**
 * Meal Planning API Service
 * AI-powered meal planning
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const API_BASE_URL = 'https://voyance-backend.railway.app';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  if (!token) throw new Error('Authentication required');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result._error || result.error || `Request failed: ${response.status}`);
  return result;
}

// Types
export type MealPace = 'RUSHED' | 'QUICK' | 'BALANCED' | 'LEISURELY';
export type AdventureLevel = 'CONSERVATIVE' | 'MODERATE' | 'ADVENTUROUS';
export type ReservationUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CuisinePreferences { loved: string[]; liked: string[]; disliked: string[]; never: string[]; }
export interface MealStyle { pace: MealPace; adventure: AdventureLevel; localFood: boolean; }
export interface MealPreferences { cuisinePreferences?: CuisinePreferences; dietaryRestrictions?: string[]; mealStyle?: Partial<MealStyle>; }

export interface MealRecommendation {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  description: string;
  cuisineType: string;
  priceRange: string;
  location?: { name: string; address: string; lat?: number; lng?: number };
  timeSlot: { start: string; end: string };
  reservationRequired: boolean;
  reservationUrl?: string;
  localSpecialty: boolean;
  matchScore: number;
  photos?: string[];
  alternatives?: MealRecommendation[];
}

export interface MealDay { dayNumber: number; date: string; meals: MealRecommendation[]; dailyBudget: number; localTips?: string[]; }
export interface BookingRequirement { mealId: string; restaurantName: string; date: string; timeSlot: string; urgency: ReservationUrgency; bookingUrl?: string; notes?: string; }
export interface MealPlan { tripId: string; days: MealDay[]; bookingRequired: BookingRequirement[]; totalBudget: number; currency: string; generatedAt: string; preferences: MealPreferences; }
export interface RegenerateMealPlanInput { forceRegenerate?: boolean; preferences?: MealPreferences; }

// API Functions
export async function getMealPlan(tripId: string): Promise<MealPlan> {
  return apiRequest<MealPlan>(`/api/v1/trips/${tripId}/meal-plan`);
}

export async function regenerateMealPlan(tripId: string, input: RegenerateMealPlanInput = { forceRegenerate: true }): Promise<MealPlan> {
  return apiRequest<MealPlan>(`/api/v1/trips/${tripId}/meal-plan/regenerate`, { method: 'POST', body: JSON.stringify(input) });
}

export async function updateMealPreferences(tripId: string, preferences: MealPreferences): Promise<{ message: string; updated: boolean; mealPlan: MealPlan }> {
  return apiRequest(`/api/v1/trips/${tripId}/meal-plan/preferences`, { method: 'PUT', body: JSON.stringify(preferences) });
}

export async function getBookingRequirements(tripId: string): Promise<BookingRequirement[]> {
  const response = await apiRequest<{ requirements: BookingRequirement[] }>(`/api/v1/trips/${tripId}/meal-plan/booking-requirements`);
  return response.requirements;
}

// React Query Hooks
export const mealPlanKeys = {
  all: ['mealPlan'] as const,
  plan: (tripId: string) => [...mealPlanKeys.all, 'plan', tripId] as const,
  bookings: (tripId: string) => [...mealPlanKeys.all, 'bookings', tripId] as const,
};

export function useMealPlan(tripId: string | null) {
  return useQuery({ queryKey: mealPlanKeys.plan(tripId || ''), queryFn: () => getMealPlan(tripId!), enabled: !!tripId, staleTime: 15 * 60 * 1000 });
}

export function useBookingRequirements(tripId: string | null) {
  return useQuery({ queryKey: mealPlanKeys.bookings(tripId || ''), queryFn: () => getBookingRequirements(tripId!), enabled: !!tripId, staleTime: 5 * 60 * 1000 });
}

export function useRegenerateMealPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input?: RegenerateMealPlanInput }) => regenerateMealPlan(tripId, input),
    onSuccess: (_, { tripId }) => { queryClient.invalidateQueries({ queryKey: mealPlanKeys.plan(tripId) }); toast.success('Meal plan regenerated!'); },
    onError: (error: Error) => { toast.error(error.message || 'Failed to regenerate meal plan'); },
  });
}

export function useUpdateMealPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, preferences }: { tripId: string; preferences: MealPreferences }) => updateMealPreferences(tripId, preferences),
    onSuccess: (_, { tripId }) => { queryClient.invalidateQueries({ queryKey: mealPlanKeys.plan(tripId) }); toast.success('Meal preferences updated!'); },
    onError: (error: Error) => { toast.error(error.message || 'Failed to update preferences'); },
  });
}

// Helper Functions
export function getMealTypeIcon(type: MealRecommendation['type']): string {
  return { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍿' }[type] || '🍽️';
}

export function getUrgencyColor(urgency: ReservationUrgency): string {
  return { LOW: 'text-green-600', MEDIUM: 'text-yellow-600', HIGH: 'text-orange-600', CRITICAL: 'text-red-600' }[urgency] || 'text-muted-foreground';
}

export function isUrgentBooking(requirement: BookingRequirement): boolean {
  return requirement.urgency === 'HIGH' || requirement.urgency === 'CRITICAL';
}
