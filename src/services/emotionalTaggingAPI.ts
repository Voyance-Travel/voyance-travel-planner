/**
 * Emotional Tagging API Service
 * Emotional event protection with budget validation and reschedule evaluation
 * 
 * API Base: /api/v1/trips/:tripId/emotional-*
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

// ============================================================================
// TYPES
// ============================================================================

export type EmotionalType = 
  | 'anniversary' 
  | 'birthday' 
  | 'memorial' 
  | 'celebration' 
  | 'romantic' 
  | 'family_reunion' 
  | 'graduation' 
  | 'engagement' 
  | 'honeymoon';

export type EmotionalUrgency = 'low' | 'medium' | 'high' | 'critical';
export type DisruptionType = 'weather' | 'closure' | 'health' | 'financial' | 'logistics';
export type TimeWindow = 'all_day' | 'morning' | 'afternoon' | 'evening' | 'dinner' | 'breakfast' | 'lunch' | 'custom';

export interface EmotionalTagInput {
  emotionalType: EmotionalType;
  date: string; // YYYY-MM-DD
  description?: string;
  budgetAllocation?: number;
  priority?: 'low' | 'medium' | 'high';
  activities?: string[];
  venueRequirements?: {
    type?: string;
    capacity?: number;
    ambiance?: string[];
  };
}

export interface EmotionalTag {
  id: string;
  tripId: string;
  userId: string;
  emotionalType: EmotionalType;
  date: string;
  description?: string;
  budgetAllocation?: number;
  priority: 'low' | 'medium' | 'high';
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetImpact {
  amount: number;
  exceedsBudget: boolean;
  shortage?: number;
  recommendations?: string[];
}

export interface ProtectedDay {
  date: string;
  emotionalType: EmotionalType;
  priority: 'low' | 'medium' | 'high';
  budgetImpact?: BudgetImpact;
  alternativesAvailable: boolean;
}

export interface EmotionalProtection {
  totalEmotionalDays: number;
  totalBudgetImpact: number;
  protectedDays: ProtectedDay[];
  budgetWarnings: string[];
  recommendations: Array<{
    type: string;
    message: string;
    actionRequired: boolean;
  }>;
}

export interface RescheduleEvaluation {
  canReschedule: boolean;
  impactLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  emotionalDaysAffected: string[];
  alternativeDates?: string[];
  warnings: string[];
  recommendations: string[];
}

export interface EmotionalRecommendation {
  id: string;
  type: string;
  name: string;
  description: string;
  matchScore: number;
  emotionalFit: string;
  priceRange: string;
  bookingRequired: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Create a new emotional tag for a trip
 */
export async function createEmotionalTag(tripId: string, input: EmotionalTagInput): Promise<{ success: boolean; tag?: EmotionalTag; warning?: string }> {
  return apiRequest(`/api/v1/trips/${tripId}/emotional-tags`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Get all emotional tags for a trip
 */
export async function getEmotionalTags(tripId: string): Promise<{ success: boolean; tags: EmotionalTag[] }> {
  return apiRequest(`/api/v1/trips/${tripId}/emotional-tags`);
}

/**
 * Update an emotional tag
 */
export async function updateEmotionalTag(
  tripId: string, 
  tagId: string, 
  updates: Partial<EmotionalTagInput>
): Promise<{ success: boolean; tag: EmotionalTag }> {
  return apiRequest(`/api/v1/trips/${tripId}/emotional-tags/${tagId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete an emotional tag
 */
export async function deleteEmotionalTag(tripId: string, tagId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/v1/trips/${tripId}/emotional-tags/${tagId}`, {
    method: 'DELETE',
  });
}

/**
 * Get emotional protection analysis for a trip
 */
export async function getEmotionalProtection(tripId: string): Promise<{
  success: boolean;
  protection: EmotionalProtection;
  recommendations: Array<{ type: string; priority: 'low' | 'medium' | 'high'; message: string; actionUrl: string }>;
  budgetSummary: { totalImpact: number; canAffordAll: boolean; worstCaseShortfall?: number };
}> {
  return apiRequest(`/api/v1/trips/${tripId}/emotional-protection`);
}

/**
 * Evaluate rescheduling impact on emotional days
 */
export async function evaluateReschedule(
  tripId: string, 
  date: string, 
  options: { urgency?: EmotionalUrgency; disruptionType?: DisruptionType } = {}
): Promise<RescheduleEvaluation> {
  const params = new URLSearchParams();
  if (options.urgency) params.set('urgency', options.urgency);
  if (options.disruptionType) params.set('disruptionType', options.disruptionType);
  const queryString = params.toString();
  return apiRequest(`/api/v1/trips/${tripId}/emotional-reschedule/${date}${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get emotional-aware activity recommendations
 */
export async function getEmotionalRecommendations(
  tripId: string, 
  date: string, 
  timeWindow?: TimeWindow
): Promise<{ success: boolean; recommendations: EmotionalRecommendation[] }> {
  const params = timeWindow ? `?timeWindow=${timeWindow}` : '';
  return apiRequest(`/api/v1/trips/${tripId}/emotional-recommendations/${date}${params}`);
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export const emotionalTagsKeys = {
  all: ['emotionalTags'] as const,
  trip: (tripId: string) => [...emotionalTagsKeys.all, tripId] as const,
  tags: (tripId: string) => [...emotionalTagsKeys.trip(tripId), 'tags'] as const,
  protection: (tripId: string) => [...emotionalTagsKeys.trip(tripId), 'protection'] as const,
  reschedule: (tripId: string, date: string) => [...emotionalTagsKeys.trip(tripId), 'reschedule', date] as const,
  recommendations: (tripId: string, date: string) => [...emotionalTagsKeys.trip(tripId), 'recommendations', date] as const,
};

/**
 * Hook to fetch emotional tags for a trip
 */
export function useEmotionalTags(tripId: string | null) {
  return useQuery({
    queryKey: emotionalTagsKeys.tags(tripId || ''),
    queryFn: () => getEmotionalTags(tripId!),
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch emotional protection analysis
 */
export function useEmotionalProtection(tripId: string | null) {
  return useQuery({
    queryKey: emotionalTagsKeys.protection(tripId || ''),
    queryFn: () => getEmotionalProtection(tripId!),
    enabled: !!tripId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to evaluate reschedule impact
 */
export function useRescheduleEvaluation(tripId: string | null, date: string | null, options?: { urgency?: EmotionalUrgency; disruptionType?: DisruptionType }) {
  return useQuery({
    queryKey: emotionalTagsKeys.reschedule(tripId || '', date || ''),
    queryFn: () => evaluateReschedule(tripId!, date!, options),
    enabled: !!tripId && !!date,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to get emotional recommendations
 */
export function useEmotionalRecommendations(tripId: string | null, date: string | null, timeWindow?: TimeWindow) {
  return useQuery({
    queryKey: emotionalTagsKeys.recommendations(tripId || '', date || ''),
    queryFn: () => getEmotionalRecommendations(tripId!, date!, timeWindow),
    enabled: !!tripId && !!date,
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Hook to create an emotional tag
 */
export function useCreateEmotionalTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: EmotionalTagInput }) => createEmotionalTag(tripId, input),
    onSuccess: (result, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: emotionalTagsKeys.trip(tripId) });
      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success('Emotional moment added!');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add emotional moment');
    },
  });
}

/**
 * Hook to update an emotional tag
 */
export function useUpdateEmotionalTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, tagId, updates }: { tripId: string; tagId: string; updates: Partial<EmotionalTagInput> }) =>
      updateEmotionalTag(tripId, tagId, updates),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: emotionalTagsKeys.trip(tripId) });
      toast.success('Emotional moment updated!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update');
    },
  });
}

/**
 * Hook to delete an emotional tag
 */
export function useDeleteEmotionalTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, tagId }: { tripId: string; tagId: string }) => deleteEmotionalTag(tripId, tagId),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: emotionalTagsKeys.trip(tripId) });
      toast.success('Emotional moment removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete');
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get emoji for emotional type
 */
export function getEmotionalTypeEmoji(type: EmotionalType): string {
  const emojis: Record<EmotionalType, string> = {
    anniversary: '💍',
    birthday: '🎂',
    memorial: '🕯️',
    celebration: '🎉',
    romantic: '❤️',
    family_reunion: '👨‍👩‍👧‍👦',
    graduation: '🎓',
    engagement: '💎',
    honeymoon: '🌙',
  };
  return emojis[type] || '✨';
}

/**
 * Get label for emotional type
 */
export function getEmotionalTypeLabel(type: EmotionalType): string {
  const labels: Record<EmotionalType, string> = {
    anniversary: 'Anniversary',
    birthday: 'Birthday',
    memorial: 'Memorial',
    celebration: 'Celebration',
    romantic: 'Romantic Moment',
    family_reunion: 'Family Reunion',
    graduation: 'Graduation',
    engagement: 'Engagement',
    honeymoon: 'Honeymoon',
  };
  return labels[type] || type;
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: 'low' | 'medium' | 'high'): string {
  const colors = { low: 'text-green-600', medium: 'text-yellow-600', high: 'text-red-600' };
  return colors[priority] || 'text-muted-foreground';
}

/**
 * Get impact level color
 */
export function getImpactLevelColor(level: RescheduleEvaluation['impactLevel']): string {
  const colors = { none: 'text-green-600', low: 'text-green-600', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600' };
  return colors[level] || 'text-muted-foreground';
}

/**
 * Check if date has emotional protection
 */
export function isDateProtected(date: string, protection: EmotionalProtection): boolean {
  return protection.protectedDays.some(day => day.date === date);
}

/**
 * Get protected day details
 */
export function getProtectedDayDetails(date: string, protection: EmotionalProtection): ProtectedDay | undefined {
  return protection.protectedDays.find(day => day.date === date);
}
