/**
 * Enhanced Itinerary API Service
 * 
 * Comprehensive itinerary generation and management with:
 * - Weather data for each day
 * - Photos for activities
 * - Walking distances and transport between activities
 * - Progressive generation with status polling
 * 
 * Matches backend: itinerary.ts
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export interface ItineraryPreferences {
  pace?: 'slow' | 'moderate' | 'fast';
  interests?: string[];
  budget?: 'budget' | 'moderate' | 'premium';
  arrivalTime?: string; // HH:MM
  departureTime?: string; // HH:MM
}

export interface GenerateItineraryInput {
  destinationId?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  preferences?: ItineraryPreferences;
  regenerate?: boolean;
}

export interface ActivityVenue {
  name: string;
  type?: string;
  cuisine?: string[];
  priceRange?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ActivityTransport {
  mode: string;
  duration: number; // minutes
  cost: number;
  details?: string;
}

export interface ActivityCoordinates {
  lat: number;
  lng: number;
}

export interface ItineraryActivity {
  id: string;
  name: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  duration: string;
  location: string;
  estimatedCost: { amount: number; currency: string };
  bookingRequired: boolean;
  tips?: string;
  // Enhanced fields
  coordinates?: ActivityCoordinates;
  photos?: string[];
  walkingDistance?: number; // meters from previous activity
  walkingTime?: number; // minutes to walk
  transport?: ActivityTransport;
  venue?: ActivityVenue;
  weather?: {
    suitable: boolean;
    alternativeIfRain?: string;
  };
  savedByUser?: boolean;
  savedByCount?: number;
}

export interface DayMeals {
  breakfast?: { name: string; location: string; estimatedCost: { amount: number; currency: string } };
  lunch?: { name: string; location: string; estimatedCost: { amount: number; currency: string } };
  dinner?: { name: string; location: string; estimatedCost: { amount: number; currency: string } };
}

export interface DayWeather {
  temperature: { high: number; low: number };
  conditions: string;
  rainChance: number;
  humidity?: number;
  windSpeed?: number;
  sunrise?: string;
  sunset?: string;
}

export interface DayTransportation {
  airport?: {
    mode: 'taxi' | 'shuttle' | 'train' | 'uber';
    duration: number;
    cost: number;
    booking?: string;
    departureTime?: string;
  };
}

export interface DayNarrative {
  theme: string;
  highlights: string[];
}

export interface ItineraryDay {
  dayNumber: number;
  date?: string;
  theme?: string;
  activities: ItineraryActivity[];
  meals?: DayMeals;
  regeneratedAt?: string;
  // Enhanced fields
  weather?: DayWeather;
  transportation?: DayTransportation;
  totalWalkingDistance?: number;
  totalTransportCost?: number;
  paceScore?: 'relaxed' | 'moderate' | 'packed';
  narrative?: DayNarrative;
}

export interface Itinerary {
  title?: string;
  destination?: string;
  days: ItineraryDay[];
  generatedAt?: string;
  preferences?: Record<string, unknown>;
  lastModified?: string;
  highlights?: string[];
  localTips?: string[];
  insiderTips?: string[];
}

export type ItineraryStatus = 'not_started' | 'queued' | 'generating' | 'running' | 'completed' | 'ready' | 'failed';

export interface ItineraryStatusResponse {
  status: ItineraryStatus;
  message?: string;
  progress?: number;
  currentDay?: number;
  totalDays?: number;
  elapsedMinutes?: number;
  estimatedTimeRemaining?: string;
  attempts?: number;
  error?: string;
  itinerary?: Itinerary;
  hasItinerary?: boolean;
}

export interface RegenerateDayInput {
  preferences?: ItineraryPreferences;
  reason?: string;
}

export interface JobStatusResponse {
  id: string;
  state: string;
  progress: number;
  data?: Record<string, unknown>;
  attemptsMade: number;
  finishedOn?: number;
  failedReason?: string;
}

// ============================================================================
// API HELPERS
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

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Generate a new itinerary for a trip
 */
export async function generateItinerary(
  tripId: string,
  input?: GenerateItineraryInput
): Promise<ItineraryStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/itinerary/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input || {}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate itinerary' }));
    throw new Error(error.error || error.message || 'Failed to generate itinerary');
  }

  return response.json();
}

/**
 * Force regenerate itinerary (always regenerates, no cache)
 */
export async function generateNewItinerary(
  tripId: string,
  input?: GenerateItineraryInput
): Promise<ItineraryStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/itinerary/generate-new`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ ...input, regenerate: true }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate itinerary' }));
    throw new Error(error.error || error.message || 'Failed to generate itinerary');
  }

  return response.json();
}

/**
 * Generate itinerary immediately (simpler endpoint)
 */
export async function generateItineraryNow(tripId: string): Promise<ItineraryStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/itinerary/generate-now`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate itinerary' }));
    throw new Error(error.error || error.message || 'Failed to generate itinerary');
  }

  return response.json();
}

/**
 * Get itinerary status/content for a trip
 */
export async function getItinerary(tripId: string): Promise<ItineraryStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/itinerary`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get itinerary' }));
    throw new Error(error.error || error.message || 'Failed to get itinerary');
  }

  return response.json();
}

/**
 * Save/update itinerary
 */
export async function saveItinerary(
  tripId: string,
  itinerary: Partial<Itinerary>
): Promise<{ success: boolean; itinerary: Itinerary }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/itinerary`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(itinerary),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to save itinerary' }));
    throw new Error(error.error || error.message || 'Failed to save itinerary');
  }

  return response.json();
}

/**
 * Regenerate a single day
 */
export async function regenerateDay(
  tripId: string,
  dayNumber: number,
  input?: RegenerateDayInput
): Promise<{ success: boolean; day: ItineraryDay }> {
  const headers = await getAuthHeader();

  const response = await fetch(
    `${API_BASE_URL}/api/v1/trips/${tripId}/itinerary/days/${dayNumber}/regenerate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(input || {}),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to regenerate day' }));
    throw new Error(error.error || error.message || 'Failed to regenerate day');
  }

  return response.json();
}

/**
 * Get job status for background generation
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/jobs/${jobId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Job not found' }));
    throw new Error(error.error || error.message || 'Failed to get job status');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useItinerary(tripId: string | null, options?: { refetchInterval?: number }) {
  // Track consecutive errors for exponential backoff
  const errorCountRef = { current: 0 };
  const baseInterval = options?.refetchInterval || 5000; // Start at 5 seconds (was 3)
  
  return useQuery({
    queryKey: ['itinerary', tripId],
    queryFn: () => getItinerary(tripId!),
    enabled: !!tripId,
    refetchInterval: (query) => {
      // Poll while generating with exponential backoff on errors
      const status = query.state.data?.status;
      
      // Handle errors with exponential backoff
      if (query.state.error) {
        errorCountRef.current++;
        const backoffInterval = Math.min(baseInterval * Math.pow(2, errorCountRef.current), 60000);
        console.log(`[Itinerary] Error backoff: ${backoffInterval}ms (attempt ${errorCountRef.current})`);
        return backoffInterval;
      }
      
      // Reset error count on success
      errorCountRef.current = 0;
      
      if (status === 'generating' || status === 'running' || status === 'queued') {
        return baseInterval; // 5 seconds
      }
      return false;
    },
    staleTime: 30 * 1000, // 30 seconds
    // Stop retrying after 5 minutes of polling
    retry: (failureCount) => failureCount < 60,
  });
}

export function useGenerateItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input?: GenerateItineraryInput }) =>
      generateItinerary(tripId, input),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
    },
  });
}

export function useGenerateNewItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input?: GenerateItineraryInput }) =>
      generateNewItinerary(tripId, input),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
    },
  });
}

export function useSaveItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, itinerary }: { tripId: string; itinerary: Partial<Itinerary> }) =>
      saveItinerary(tripId, itinerary),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
    },
  });
}

export function useRegenerateDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tripId,
      dayNumber,
      input,
    }: {
      tripId: string;
      dayNumber: number;
      input?: RegenerateDayInput;
    }) => regenerateDay(tripId, dayNumber, input),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
    },
  });
}

export function useJobStatus(jobId: string | null) {
  const errorCountRef = { current: 0 };
  
  return useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      
      // Exponential backoff on errors
      if (query.state.error) {
        errorCountRef.current++;
        return Math.min(5000 * Math.pow(2, errorCountRef.current), 60000);
      }
      
      errorCountRef.current = 0;
      
      if (state === 'waiting' || state === 'active') {
        return 5000; // Poll every 5 seconds while running (was 2)
      }
      return false;
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isItineraryReady(status: ItineraryStatus): boolean {
  return status === 'completed' || status === 'ready';
}

export function isItineraryGenerating(status: ItineraryStatus): boolean {
  return status === 'generating' || status === 'running' || status === 'queued';
}

export function getStatusMessage(status: ItineraryStatus, progress?: number): string {
  switch (status) {
    case 'not_started':
      return 'Ready to generate';
    case 'queued':
      return 'Queued for generation...';
    case 'generating':
    case 'running':
      return progress ? `Generating... ${Math.round(progress)}%` : 'Generating your itinerary...';
    case 'completed':
    case 'ready':
      return 'Itinerary ready';
    case 'failed':
      return 'Generation failed';
    default:
      return 'Unknown status';
  }
}

export function formatWalkingDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatWalkingTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min walk`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}min walk` : `${hours}h walk`;
}

export function getWeatherIcon(conditions: string): string {
  const conditionsLower = conditions.toLowerCase();
  if (conditionsLower.includes('sunny') || conditionsLower.includes('clear')) return '☀️';
  if (conditionsLower.includes('cloud')) return '☁️';
  if (conditionsLower.includes('rain')) return '🌧️';
  if (conditionsLower.includes('storm')) return '⛈️';
  if (conditionsLower.includes('snow')) return '❄️';
  if (conditionsLower.includes('fog') || conditionsLower.includes('mist')) return '🌫️';
  if (conditionsLower.includes('wind')) return '💨';
  return '🌤️';
}

export function formatTemperature(temp: number, unit: 'C' | 'F' = 'C'): string {
  return `${Math.round(temp)}°${unit}`;
}

export function getPaceScoreLabel(pace: 'relaxed' | 'moderate' | 'packed'): string {
  const labels = {
    relaxed: 'Relaxed',
    moderate: 'Moderate',
    packed: 'Action-packed',
  };
  return labels[pace] || pace;
}

export function getPaceScoreColor(pace: 'relaxed' | 'moderate' | 'packed'): string {
  const colors = {
    relaxed: 'text-green-600',
    moderate: 'text-yellow-600',
    packed: 'text-orange-600',
  };
  return colors[pace] || 'text-muted-foreground';
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const itineraryAPI = {
  generateItinerary,
  generateNewItinerary,
  generateItineraryNow,
  getItinerary,
  saveItinerary,
  regenerateDay,
  getJobStatus,
};

export default itineraryAPI;
