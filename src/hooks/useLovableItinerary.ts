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

export interface UseLovableItineraryOptions {
  /**
   * When true, generateItinerary() launches the server-side day-chain
   * (`action: 'generate-trip'`) and polls trips.metadata for progress instead
   * of running the per-day client loop. Required for mobile because iOS
   * Safari suspends backgrounded tabs and silently kills the loop, leaving
   * trips stuck at itinerary_status='not_started' / ~18% forever.
   */
  serverChainMode?: boolean;
}

export function useLovableItinerary(tripId: string | null, options: UseLovableItineraryOptions = {}) {
  const { serverChainMode = false } = options;
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

  // Server-chain mode: kick off `action: 'generate-trip'` and poll metadata.
  // Used on mobile where the per-day client loop dies when the tab is
  // suspended. Updates the same state shape consumers already render.
  const generateViaServerChain = useCallback(async (): Promise<void> => {
    if (!tripId) return;
    const startTime = Date.now();
    abortController.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      progress: 0,
      error: null,
      currentStep: 'preparing',
      message: 'Preparing your trip details...',
      generationStartTime: startTime,
      days: [],
    }));

    try {
      // Fetch trip details to build the generate-trip body
      const { data: tripRow, error: tripErr } = await supabase
        .from('trips')
        .select('destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city, user_id, itinerary_status, itinerary_data, metadata')
        .eq('id', tripId)
        .single();
      if (tripErr || !tripRow) {
        throw new Error(tripErr?.message || 'Failed to load trip');
      }

      const totalDays = calculateDaysBetween(tripRow.start_date as string, tripRow.end_date as string);
      const meta = (tripRow.metadata as Record<string, unknown>) || {};
      const alreadyGenerating = tripRow.itinerary_status === 'generating';
      const heartbeat = meta.generation_heartbeat ? new Date(meta.generation_heartbeat as string).getTime() : 0;
      const heartbeatFresh = heartbeat && Date.now() - heartbeat < 5 * 60 * 1000;

      // Don't double-launch — if status is already 'generating' with a fresh
      // heartbeat, the chain is already running, just poll.
      if (!(alreadyGenerating && heartbeatFresh)) {
        setState(prev => ({ ...prev, currentStep: 'generating', message: `Planning ${totalDays} days in ${tripRow.destination}...`, totalDays, progress: 5 }));
        const { error: invokeErr } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-trip',
            tripId,
            userId: tripRow.user_id,
            destination: tripRow.destination,
            destinationCountry: tripRow.destination_country || '',
            startDate: tripRow.start_date,
            endDate: tripRow.end_date,
            travelers: tripRow.travelers || 1,
            tripType: tripRow.trip_type || 'vacation',
            budgetTier: tripRow.budget_tier || 'moderate',
            isMultiCity: !!tripRow.is_multi_city,
            creditsCharged: 0,
          },
        });
        if (invokeErr) throw new Error(invokeErr.message || 'Failed to launch generation');
      }

      // Poll trips + itinerary_days until ready/failed. Loop survives tab
      // suspensions because the chain runs server-side.
      const POLL_INTERVAL_MS = 2500;
      const MAX_POLL_MS = 30 * 60 * 1000; // 30 min absolute cap
      const pollStart = Date.now();

      while (isMounted.current && !abortController.current?.signal.aborted) {
        if (Date.now() - pollStart > MAX_POLL_MS) {
          throw new Error('Generation timed out (>30 min). Please try again.');
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        if (!isMounted.current) return;

        const { data: pollRow } = await supabase
          .from('trips')
          .select('itinerary_status, itinerary_data, metadata')
          .eq('id', tripId)
          .single();
        if (!pollRow) continue;

        const pMeta = (pollRow.metadata as Record<string, unknown>) || {};
        const pData = (pollRow.itinerary_data as { days?: BackendDay[] } | null) || null;
        const pDays = pData?.days || [];
        const completed = (pMeta.generation_completed_days as number) || pDays.length;
        const pTotal = (pMeta.generation_total_days as number) || totalDays;
        const progress = pTotal > 0 ? Math.max(5, Math.min(95, Math.round((completed / pTotal) * 90) + 5)) : 5;
        const convertedDays = pDays.map(convertBackendDay);

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            days: convertedDays,
            currentDay: completed,
            totalDays: pTotal,
            progress: ((pollRow.itinerary_status as string) === 'ready' || (pollRow.itinerary_status as string) === 'generated') ? 100 : progress,
            message: `Crafting Day ${Math.min(completed + 1, pTotal)} of ${pTotal}...`,
          }));
        }

        if (((pollRow.itinerary_status as string) === 'ready' || (pollRow.itinerary_status as string) === 'generated')) {
          const duration = Date.now() - startTime;
          if (isMounted.current) {
            setState(prev => ({
              ...prev,
              loading: false,
              currentStep: 'complete',
              progress: 100,
              message: 'Your itinerary is ready!',
              generationDuration: duration,
            }));
          }
          return;
        }

        if (pollRow.itinerary_status === 'failed') {
          const errMsg = (pMeta.generation_error as string) || (pMeta.chain_error as string) || 'Generation failed';
          throw new Error(errMsg);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useLovableItinerary] Server-chain generation failed:', error);
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          currentStep: 'error',
          error,
          message: error.message,
        }));
      }
    }
  }, [tripId]);

  // Generate itinerary day by day using Lovable AI
  const generateItinerary = useCallback(async (preferences?: GenerationPreferences & { maxDays?: number }) => {
    if (!tripId) return;

    // Mobile / server-chain mode: defer to the server-side day-chain.
    if (serverChainMode) {
      await generateViaServerChain();
      return;
    }

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

      // Step 3: Save to database (90% - 100%)
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
      if (isMounted.current && tripId) {
        // CRITICAL: Before showing error, check if itinerary was actually saved to DB
        // The edge function may have succeeded even though the connection was lost
        try {
          const { data: verifyTrip } = await supabase
            .from('trips')
            .select('itinerary_data, itinerary_status')
            .eq('id', tripId)
            .single();
          
          const verifyData = verifyTrip?.itinerary_data as { days?: unknown[] } | null;
          const verifyStatus = verifyTrip?.itinerary_status as string;
          
          if (verifyData?.days?.length && verifyData.days.length > 0) {
            // Itinerary exists in DB — this was a false error!
            console.log('[useLovableItinerary] Error ignored — itinerary exists in DB with', verifyData.days.length, 'days');
            const convertedDays = (verifyData.days as any[]).map(convertBackendDay);
            setState(prev => ({
              ...prev,
              loading: false,
              currentStep: 'complete',
              progress: 100,
              days: convertedDays,
              hasExistingItinerary: true,
              error: null,
              message: 'Your itinerary is ready!',
              generationDuration: Date.now() - (prev.generationStartTime || Date.now()),
            }));
            return;
          }
          
          if (verifyStatus === 'generating' || verifyStatus === 'queued') {
            // Still generating server-side — don't show error, let poller handle it
            console.log('[useLovableItinerary] Error ignored — generation still in progress server-side');
            setState(prev => ({
              ...prev,
              loading: true,
              currentStep: 'generating',
              error: null,
              message: 'Generation is continuing in the background...',
            }));
            return;
          }
        } catch (verifyErr) {
          console.warn('[useLovableItinerary] Could not verify DB state:', verifyErr);
        }

        // Itinerary truly doesn't exist — show the error
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
