/**
 * Lovable AI Itinerary Generation Hook
 * 
 * Replaces Railway backend with Lovable AI Gateway for itinerary generation.
 * Generates day-by-day with real progress tracking and streaming feedback.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DayItinerary, BackendDay } from '@/types/itinerary';
import { convertBackendDay } from '@/types/itinerary';
import { sanitizeAIOutput } from '@/utils/textSanitizer';

// ============================================================================
// TYPES
// ============================================================================

export type GenerationStep = 
  | 'idle' 
  | 'gathering-dna'
  | 'personalizing'
  | 'preparing'
  | 'fetching-trip' 
  | 'generating' 
  | 'enriching' 
  | 'saving' 
  | 'complete' 
  | 'error';

export interface GenerationPreferences {
  pace?: 'relaxed' | 'moderate' | 'packed';
  interests?: string[];
  budget?: 'budget' | 'moderate' | 'luxury';
  transportationModes?: string[];
  primaryTransport?: string;
  hasRentalCar?: boolean;
  // Context for planning
  hotelLocation?: string;
  arrivalTime?: string;
  departureTime?: string;
}

export interface LovableItineraryState {
  loading: boolean;
  progress: number;
  currentStep: GenerationStep;
  currentDay: number;
  totalDays: number;
  message: string;
  days: DayItinerary[];
  error: Error | null;
  hasExistingItinerary: boolean;
  generationStartTime: number | null;
  generationDuration: number | null;
}

interface TripDetails {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
}

interface GeneratedDay {
  dayNumber: number;
  date: string;
  theme: string;
  activities: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    startTime: string;
    endTime: string;
    duration: string;
    location: string | { name?: string; address?: string; coordinates?: { lat: number; lng: number } };
    estimatedCost: { amount: number; currency: string };
    bookingRequired: boolean;
    tips?: string;
    coordinates?: { lat: number; lng: number };
  }>;
  narrative?: {
    theme: string;
    highlights: string[];
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(startDate: string, dayOffset: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split('T')[0];
}

function convertGeneratedToBackendDay(day: GeneratedDay): BackendDay {
  return {
    dayNumber: day.dayNumber,
    date: day.date,
    theme: sanitizeAIOutput(day.theme),
    activities: day.activities.map(a => {
      const rawLocation =
        typeof a.location === 'string'
          ? a.location
          : a.location?.address || a.location?.name || '';
      return {
        id: a.id,
        name: sanitizeAIOutput(a.name),
        description: sanitizeAIOutput(a.description),
        category: sanitizeAIOutput(a.category),
        startTime: a.startTime,
        endTime: a.endTime,
        duration: a.duration,
        location: sanitizeAIOutput(rawLocation),
        estimatedCost: a.estimatedCost,
        bookingRequired: a.bookingRequired,
        tips: a.tips ? sanitizeAIOutput(a.tips) : a.tips,
        coordinates: a.coordinates,
      };
    }),
  };
}

function isTransientAiFailure(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes('temporarily unavailable') ||
    m.includes('internal server error') ||
    // Supabase FunctionsHttpError often embeds status/body into message
    m.includes('returned 500') ||
    m.includes('status code 500') ||
    m.includes('ai service error')
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useLovableItinerary(tripId: string | null) {
  const [state, setState] = useState<LovableItineraryState>({
    loading: false,
    progress: 0,
    currentStep: 'idle',
    currentDay: 0,
    totalDays: 0,
    message: '',
    days: [],
    error: null,
    hasExistingItinerary: false,
    generationStartTime: null,
    generationDuration: null,
  });

  const isMounted = useRef(true);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    isMounted.current = true; // Reset on mount (critical for React 18 StrictMode)
    return () => {
      isMounted.current = false;
      abortController.current?.abort();
    };
  }, []);

  // Check for existing itinerary in database
  const checkExisting = useCallback(async (): Promise<boolean> => {
    if (!tripId) return false;

    try {
      const { data: trip, error } = await supabase
        .from('trips')
        .select('itinerary_data, itinerary_status')
        .eq('id', tripId)
        .single();

      if (error) {
        console.error('[useLovableItinerary] Error checking existing:', error);
        return false;
      }

      const itineraryData = trip?.itinerary_data as { days?: BackendDay[] } | null;
      
      if (itineraryData?.days?.length) {
        const convertedDays = itineraryData.days.map(convertBackendDay);
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            hasExistingItinerary: true,
            days: convertedDays,
            currentStep: 'complete',
            progress: 100,
            totalDays: convertedDays.length,
          }));
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('[useLovableItinerary] Error:', error);
      return false;
    }
  }, [tripId]);

  // Generate itinerary day by day using Lovable AI
  const generateItinerary = useCallback(async (preferences?: GenerationPreferences & { maxDays?: number }) => {
    if (!tripId) return;

    const startTime = Date.now();
    abortController.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      progress: 0,
      error: null,
      currentStep: 'gathering-dna',
      message: 'Gathering your Travel DNA...',
      generationStartTime: startTime,
      days: [],
    }));

    try {
      // Pre-generation phases for better UX - shorter delays with engaging animation
      // Phase 1: Gathering DNA (visual delay)
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!isMounted.current) return;
      
      setState(prev => ({
        ...prev,
        currentStep: 'personalizing',
        message: 'Personalizing recommendations...',
        progress: 2,
      }));
      
      // Phase 2: Personalizing (visual delay)
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!isMounted.current) return;
      
      setState(prev => ({
        ...prev,
        currentStep: 'preparing',
        message: 'Building your perfect itinerary...',
        progress: 4,
      }));
      
      // Phase 3: Preparing (visual delay)
      await new Promise(resolve => setTimeout(resolve, 600));
      if (!isMounted.current) return;
      
      setState(prev => ({
        ...prev,
        currentStep: 'fetching-trip',
        message: 'Preparing your trip details...',
        progress: 5,
      }));

      // Step 1: Fetch trip details (5%)
      // Fetching trip details
      const { data: tripResponse, error: tripError } = await supabase.functions.invoke('generate-itinerary', {
        body: { action: 'get-trip', tripId }
      });

      if (tripError || !tripResponse?.success) {
        throw new Error(tripResponse?.error || tripError?.message || 'Failed to fetch trip');
      }

      const tripDetails: TripDetails = tripResponse.trip;
      const totalDays = calculateDaysBetween(tripDetails.startDate, tripDetails.endDate);

      if (!isMounted.current) return;
      setState(prev => ({
        ...prev,
        progress: 5,
        totalDays,
        currentStep: 'generating',
        message: `Planning ${totalDays} days in ${tripDetails.destination}...`,
      }));

      // Step 2: Generate each day (5% - 80%)
      // Lazy generation: only generate up to maxDays if specified (prevents generating unpaid days)
      const maxDays = preferences?.maxDays ?? totalDays;
      const daysToGenerate = Math.min(maxDays, totalDays);
      const generatedDays: GeneratedDay[] = [];
      const previousActivities: string[] = [];

      // Check for partially saved itinerary to resume from
      let startFromDay = 1;
      try {
        const { data: tripData } = await supabase
          .from('trips')
          .select('itinerary_data')
          .eq('id', tripId)
          .single();

        const existingDays = (tripData?.itinerary_data as any)?.days;
        if (existingDays?.length > 0 && existingDays.length < totalDays) {
          // We have a partial itinerary — resume from where we left off
          startFromDay = existingDays.length + 1;
          for (const d of existingDays) {
            generatedDays.push(d);
            (d.activities || []).forEach((a: any) => previousActivities.push(a.name || a.title || ''));
          }
          // Show existing days in UI immediately
          const convertedExisting = existingDays.map((d: any) => convertBackendDay(d));
          if (isMounted.current) {
            setState(prev => ({
              ...prev,
              days: convertedExisting,
              progress: 5 + ((startFromDay - 1) / totalDays) * 75,
              message: `Resuming from Day ${startFromDay} of ${totalDays}...`,
            }));
          }
          console.log(`[useLovableItinerary] Resuming generation from day ${startFromDay} (${existingDays.length} days already saved)`);
        }
      } catch (e) {
        console.warn('[useLovableItinerary] Could not check for partial itinerary:', e);
      }

      for (let dayNum = startFromDay; dayNum <= daysToGenerate; dayNum++) {
        if (!isMounted.current || abortController.current?.signal.aborted) break;

        const dayProgress = 5 + ((dayNum - 1) / daysToGenerate) * 75;
        setState(prev => ({
          ...prev,
          currentDay: dayNum,
          progress: dayProgress,
          message: `Crafting Day ${dayNum} of ${totalDays}...`,
        }));

        // Generating day

        let dayResponse: any = null;
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          const { data, error } = await supabase.functions.invoke('generate-itinerary', {
            body: {
              action: 'generate-day',
              tripId,
              dayNumber: dayNum,
              totalDays,
              destination: tripDetails.destination,
              destinationCountry: tripDetails.destinationCountry,
              date: formatDate(tripDetails.startDate, dayNum - 1),
              travelers: tripDetails.travelers,
              tripType: tripDetails.tripType,
              budgetTier: tripDetails.budgetTier,
              preferences,
              previousDayActivities: previousActivities.slice(-10),
              transportationModes: preferences?.transportationModes,
              primaryTransport: preferences?.primaryTransport,
              hasRentalCar: preferences?.hasRentalCar,
            }
          });

          if (error) {
            lastError = error;
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[useLovableItinerary] Day ${dayNum} error (attempt ${attempt}):`, error);

            if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
              throw new Error('Rate limit exceeded. Please try again in a moment.');
            }
            if (msg.includes('402')) {
              throw new Error('AI credits exhausted. Please add credits to continue.');
            }

            if (attempt < 3 && isTransientAiFailure(msg)) {
              await new Promise(resolve => setTimeout(resolve, 500 * attempt));
              continue;
            }

            throw error;
          }

          if (!data?.success || !data?.day) {
            lastError = new Error(data?.error || `Failed to generate day ${dayNum}`);
            const msg = lastError instanceof Error ? lastError.message : String(lastError);
            if (attempt < 3 && isTransientAiFailure(msg)) {
              await new Promise(resolve => setTimeout(resolve, 500 * attempt));
              continue;
            }
            throw lastError;
          }

          dayResponse = data;
          break;
        }

        if (!dayResponse?.success || !dayResponse?.day) {
          throw (lastError instanceof Error ? lastError : new Error(`Failed to generate day ${dayNum}`));
        }

        const generatedDay = dayResponse.day as GeneratedDay;
        generatedDays.push(generatedDay);

        // Small delay between days to reduce the chance of provider hiccups
        if (dayNum < totalDays) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Track activities to avoid repetition
        generatedDay.activities.forEach(a => previousActivities.push(a.name));

        // Update UI with new day immediately
        const backendDay = convertGeneratedToBackendDay(generatedDay);
        const frontendDay = convertBackendDay(backendDay);

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            days: [...prev.days, frontendDay],
            progress: 5 + (dayNum / totalDays) * 75,
          }));
        }

        // Auto-save after each day so progress isn't lost on timeout
        try {
          const partialItinerary = {
            days: generatedDays.map(convertGeneratedToBackendDay),
            generatedAt: new Date().toISOString(),
            destination: tripDetails.destination,
            partial: dayNum < daysToGenerate,
          };
          await supabase.functions.invoke('generate-itinerary', {
            body: { action: 'save-itinerary', tripId, itinerary: partialItinerary },
          });
        } catch (saveErr) {
          console.warn(`[useLovableItinerary] Partial save after day ${dayNum} failed (non-blocking):`, saveErr);
        }
      }

      if (!isMounted.current) return;

      // Step 3: Enrich with weather/distances (80% - 90%)
      setState(prev => ({
        ...prev,
        currentStep: 'enriching',
        progress: 80,
        message: 'Adding weather and walking distances...',
      }));

      try {
        const { data: enrichResponse } = await supabase.functions.invoke('enrich-itinerary', {
          body: {
            tripId,
            destination: tripDetails.destination,
            days: generatedDays.map(d => ({
              dayNumber: d.dayNumber,
              date: d.date,
              activities: d.activities.map(a => ({
                id: a.id,
                name: a.name,
                location: a.location,
                coordinates: a.coordinates,
              })),
            })),
          }
        });

        if (enrichResponse?.success && enrichResponse?.days) {
          // Merge enrichment data
          const enrichedDays = generatedDays.map((day, idx) => {
            const enrichment = enrichResponse.days[idx];
            return {
              ...day,
              weather: enrichment?.weather,
              activities: day.activities.map((a, aIdx) => ({
                ...a,
                walkingDistance: enrichment?.activities?.[aIdx]?.walkingDistance,
                walkingTime: enrichment?.activities?.[aIdx]?.walkingTime,
              })),
            };
          });

          // Update state with enriched days
          const convertedDays = enrichedDays.map(d => convertBackendDay(convertGeneratedToBackendDay(d)));
          if (isMounted.current) {
            setState(prev => ({ ...prev, days: convertedDays }));
          }
        }
      } catch (enrichError) {
        console.warn('[useLovableItinerary] Enrichment failed, continuing:', enrichError);
        // Non-fatal, continue with unenriched data
      }

      // Step 4: Save to database (90% - 100%)
      if (!isMounted.current) return;
      setState(prev => ({
        ...prev,
        currentStep: 'saving',
        progress: 90,
        message: 'Saving your itinerary...',
      }));

      const itineraryToSave = {
        days: generatedDays.map(convertGeneratedToBackendDay),
        generatedAt: new Date().toISOString(),
        destination: tripDetails.destination,
      };

      const { error: saveError } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'save-itinerary',
          tripId,
          itinerary: itineraryToSave,
        }
      });

      if (saveError) {
        console.error('[useLovableItinerary] Save failed:', saveError);
        // Non-fatal, itinerary is still in state
      }

      // Complete!
      const duration = Date.now() - startTime;
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          progress: 100,
          currentStep: 'complete',
          message: 'Your itinerary is ready!',
          generationDuration: duration,
          hasExistingItinerary: true,
        }));
      }

      // Generation complete

    } catch (error) {
      console.error('[useLovableItinerary] Generation failed:', error);
      if (isMounted.current) {
        const savedDaysCount = state.days.length;
        const resumeMsg = savedDaysCount > 0
          ? ` Days 1-${savedDaysCount} have been saved. You can resume generation to continue where you left off.`
          : '';
        setState(prev => ({
          ...prev,
          loading: false,
          currentStep: 'error',
          error: error instanceof Error ? error : new Error('Generation failed'),
          message: (error instanceof Error ? error.message : 'Something went wrong. Please try again.') + resumeMsg,
        }));
      }
    }
  }, [tripId]);

  // Resume generation from where it left off (uses saved partial itinerary)
  const resume = useCallback(async (preferences?: GenerationPreferences & { maxDays?: number }) => {
    setState(prev => ({
      ...prev,
      error: null,
      currentStep: 'idle',
    }));
    await generateItinerary(preferences);
  }, [generateItinerary]);

  // Regenerate from scratch
  const regenerate = useCallback(async (preferences?: GenerationPreferences) => {
    setState(prev => ({
      ...prev,
      hasExistingItinerary: false,
      days: [],
      progress: 0,
      currentStep: 'idle',
      error: null,
    }));
    await generateItinerary(preferences);
  }, [generateItinerary]);

  // Cancel ongoing generation
  const cancel = useCallback(() => {
    abortController.current?.abort();
    setState(prev => ({
      ...prev,
      loading: false,
      currentStep: prev.days.length > 0 ? 'complete' : 'idle',
      message: prev.days.length > 0 ? 'Generation stopped (partial itinerary)' : 'Generation cancelled',
    }));
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, currentStep: 'idle' }));
  }, []);

  return {
    ...state,
    checkExisting,
    generateItinerary,
    resume,
    regenerate,
    cancel,
    clearError,
  };
}
