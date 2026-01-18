/**
 * Enhanced Itinerary API Service
 * 
 * Uses Cloud edge functions for itinerary generation:
 * - generate-itinerary: AI-powered day generation
 * - Stores itineraries in trips.itinerary_data
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export interface ItineraryPreferences {
  pace?: 'slow' | 'moderate' | 'fast';
  interests?: string[];
  budget?: 'budget' | 'moderate' | 'premium';
  arrivalTime?: string;
  departureTime?: string;
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
  duration: number;
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
  coordinates?: ActivityCoordinates;
  photos?: string[];
  walkingDistance?: number;
  walkingTime?: number;
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

// ============================================================================
// API FUNCTIONS - Now using Cloud Edge Functions
// ============================================================================

/**
 * Get trip details from database
 */
async function getTripDetails(tripId: string) {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    throw new Error('Trip not found');
  }

  return trip;
}

/**
 * Calculate number of days between dates
 */
function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Get itinerary status/content for a trip
 */
export async function getItinerary(tripId: string): Promise<ItineraryStatusResponse> {
  const trip = await getTripDetails(tripId);
  
  const itineraryData = trip.itinerary_data as unknown as Itinerary | null;
  const status = (trip.itinerary_status || 'not_started') as ItineraryStatus;
  
  if (itineraryData && itineraryData.days?.length > 0) {
    return {
      status: 'ready',
      itinerary: itineraryData,
      hasItinerary: true,
    };
  }
  
  return {
    status,
    hasItinerary: false,
  };
}

/**
 * Generate a new itinerary for a trip using Cloud edge function
 */
export async function generateItinerary(
  tripId: string,
  input?: GenerateItineraryInput
): Promise<ItineraryStatusResponse> {
  const trip = await getTripDetails(tripId);
  const totalDays = calculateDays(trip.start_date, trip.end_date);
  
  // Update trip status to generating
  await supabase
    .from('trips')
    .update({ itinerary_status: 'generating' })
    .eq('id', tripId);
  
  const days: ItineraryDay[] = [];
  const previousActivities: string[] = [];
  
  // Generate each day progressively
  for (let dayNumber = 1; dayNumber <= totalDays; dayNumber++) {
    const dayDate = new Date(trip.start_date);
    dayDate.setDate(dayDate.getDate() + dayNumber - 1);
    
    console.log(`[ItineraryAPI] Generating day ${dayNumber}/${totalDays}`);
    
    const { data, error } = await supabase.functions.invoke('generate-itinerary', {
      body: {
        action: 'generate-day',
        tripId,
        dayNumber,
        totalDays,
        destination: trip.destination,
        destinationCountry: trip.destination_country,
        date: dayDate.toISOString().split('T')[0],
        travelers: trip.travelers || 1,
        tripType: trip.trip_type,
        budgetTier: trip.budget_tier,
        preferences: input?.preferences,
        previousDayActivities: previousActivities,
      },
    });
    
    if (error) {
      console.error(`[ItineraryAPI] Day ${dayNumber} generation failed:`, error);
      await supabase
        .from('trips')
        .update({ itinerary_status: 'failed' })
        .eq('id', tripId);
      throw new Error(`Failed to generate day ${dayNumber}: ${error.message}`);
    }
    
    if (data?.day) {
      days.push(data.day);
      // Track activities for next day to avoid repetition
      data.day.activities?.forEach((a: ItineraryActivity) => {
        previousActivities.push(a.name);
      });
    }
  }
  
  // Build complete itinerary
  const itinerary: Itinerary = {
    title: `${trip.destination} Adventure`,
    destination: trip.destination,
    days,
    generatedAt: new Date().toISOString(),
    preferences: input?.preferences as Record<string, unknown> | undefined,
  };
  
  // Save to database - cast to any to satisfy Supabase Json type
  const { error: saveError } = await supabase
    .from('trips')
    .update({
      itinerary_data: JSON.parse(JSON.stringify(itinerary)),
      itinerary_status: 'ready',
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);
  
  if (saveError) {
    console.error('[ItineraryAPI] Failed to save itinerary:', saveError);
    throw new Error('Failed to save itinerary');
  }
  
  console.log(`[ItineraryAPI] Itinerary complete: ${days.length} days generated`);
  
  return {
    status: 'ready',
    itinerary,
    hasItinerary: true,
  };
}

/**
 * Force regenerate itinerary (always regenerates, no cache)
 */
export async function generateNewItinerary(
  tripId: string,
  input?: GenerateItineraryInput
): Promise<ItineraryStatusResponse> {
  return generateItinerary(tripId, { ...input, regenerate: true });
}

/**
 * Generate itinerary immediately (alias)
 */
export async function generateItineraryNow(tripId: string): Promise<ItineraryStatusResponse> {
  return generateItinerary(tripId);
}

/**
 * Save/update itinerary
 */
export async function saveItinerary(
  tripId: string,
  itinerary: Partial<Itinerary>
): Promise<{ success: boolean; itinerary: Itinerary }> {
  const trip = await getTripDetails(tripId);
  const existingItinerary = (trip.itinerary_data as unknown as Itinerary) || { days: [] };
  
  const mergedItinerary: Itinerary = {
    ...existingItinerary,
    ...itinerary,
    lastModified: new Date().toISOString(),
  };
  
  const { error } = await supabase
    .from('trips')
    .update({
      itinerary_data: JSON.parse(JSON.stringify(mergedItinerary)),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);
  
  if (error) {
    throw new Error('Failed to save itinerary');
  }
  
  return { success: true, itinerary: mergedItinerary };
}

/**
 * Regenerate a single day
 */
export async function regenerateDay(
  tripId: string,
  dayNumber: number,
  input?: RegenerateDayInput
): Promise<{ success: boolean; day: ItineraryDay }> {
  const trip = await getTripDetails(tripId);
  const totalDays = calculateDays(trip.start_date, trip.end_date);
  
  const dayDate = new Date(trip.start_date);
  dayDate.setDate(dayDate.getDate() + dayNumber - 1);
  
  // Get existing itinerary for context
  const existingItinerary = (trip.itinerary_data as unknown as Itinerary) || { days: [] };
  const previousActivities = existingItinerary.days
    .filter(d => d.dayNumber < dayNumber)
    .flatMap(d => d.activities?.map(a => a.name) || []);
  
  const { data, error } = await supabase.functions.invoke('generate-itinerary', {
    body: {
      action: 'generate-day',
      tripId,
      dayNumber,
      totalDays,
      destination: trip.destination,
      destinationCountry: trip.destination_country,
      date: dayDate.toISOString().split('T')[0],
      travelers: trip.travelers || 1,
      tripType: trip.trip_type,
      budgetTier: trip.budget_tier,
      preferences: input?.preferences,
      previousDayActivities: previousActivities,
    },
  });
  
  if (error || !data?.day) {
    throw new Error('Failed to regenerate day');
  }
  
  // Update the day in the itinerary
  const updatedDays = [...existingItinerary.days];
  const dayIndex = updatedDays.findIndex(d => d.dayNumber === dayNumber);
  
  if (dayIndex >= 0) {
    updatedDays[dayIndex] = { ...data.day, regeneratedAt: new Date().toISOString() };
  } else {
    updatedDays.push({ ...data.day, regeneratedAt: new Date().toISOString() });
  }
  
  updatedDays.sort((a, b) => a.dayNumber - b.dayNumber);
  
  const updatedItinerary = { ...existingItinerary, days: updatedDays };
  await supabase
    .from('trips')
    .update({
      itinerary_data: JSON.parse(JSON.stringify(updatedItinerary)),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);
  
  return { success: true, day: data.day };
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useItinerary(tripId: string | null, options?: { refetchInterval?: number }) {
  const errorCountRef = { current: 0 };
  const baseInterval = options?.refetchInterval || 5000;
  
  return useQuery({
    queryKey: ['itinerary', tripId],
    queryFn: () => getItinerary(tripId!),
    enabled: !!tripId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      
      if (query.state.error) {
        errorCountRef.current++;
        const backoffInterval = Math.min(baseInterval * Math.pow(2, errorCountRef.current), 60000);
        return backoffInterval;
      }
      
      errorCountRef.current = 0;
      
      if (status === 'generating' || status === 'running' || status === 'queued') {
        return baseInterval;
      }
      return false;
    },
    staleTime: 30 * 1000,
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
};

export default itineraryAPI;
