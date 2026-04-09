import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { reportConnectionFailure, resetConnectionFailures } from '@/components/common/ConnectionRecoveryBanner';
import { resubscribeAll } from '@/lib/realtimeSubscriptionManager';
import { guardedRefreshSession } from '@/lib/authSessionGuard';
import { getTripCities } from '@/services/tripCitiesService';
import { sanitizeAIOutput } from '@/utils/textSanitizer';

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratedActivity {
  id: string;
  title?: string;
  name?: string; // Legacy support
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  duration?: string;
  durationMinutes?: number;
  location: {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
  } | string; // Support both formats
  cost?: { amount: number; currency: string; formatted?: string };
  estimatedCost?: { amount: number; currency: string }; // Legacy
  bookingRequired: boolean;
  tips?: string;
  tags?: string[];
  transportation?: {
    method: string;
    duration: string;
    estimatedCost: { amount: number; currency: string };
    instructions: string;
  };
  photos?: Array<{ url: string; photographer?: string; alt?: string }>;
  rating?: { value: number; totalReviews: number };
  verified?: { isValid: boolean; confidence: number };
  categoryIcon?: string;
  type?: string;
  // Venue details for investigation
  website?: string;
  phoneNumber?: string;
  openingHours?: string[];
  priceLevel?: number; // 1-4 scale ($-$$$$)
  googleMapsUrl?: string;
  reviewHighlights?: string[];
}

export interface GeneratedDay {
  dayNumber: number;
  date: string;
  title?: string;
  theme?: string;
  activities: GeneratedActivity[];
  metadata?: {
    theme?: string;
    totalEstimatedCost?: number;
    mealsIncluded?: number;
    pacingLevel?: 'relaxed' | 'moderate' | 'packed';
    /** True if this day is a preview (not fully enriched) */
    isPreview?: boolean;
    /** True if this day is locked and has no generated content */
    isLocked?: boolean;
    /** True if the trip was the user's first (free 2-day preview) */
    isFirstTrip?: boolean;
  };
  narrative?: {
    theme: string;
    highlights: string[];
  };
}

export interface TripOverview {
  bestTimeToVisit?: string;
  currency?: string;
  language?: string;
  transportationTips?: string;
  culturalTips?: string;
  budgetBreakdown?: {
    accommodations: number;
    activities: number;
    food: number;
    transportation: number;
    total: number;
  };
  highlights?: string[];
  localTips?: string[];
}

export interface ItineraryGenerationState {
  isGenerating: boolean;
  currentDay: number;
  totalDays: number;
  progress: number;
  days: GeneratedDay[];
  overview?: TripOverview;
  error: string | null;
  status: 'idle' | 'preparing' | 'generating' | 'enriching' | 'complete' | 'error';
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
  userId?: string;
  isMultiCity?: boolean;
  mustDoActivities?: string;
  perDayActivities?: Array<{ dayNumber: number; activities: string }>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useItineraryGeneration() {
  const [state, setState] = useState<ItineraryGenerationState>({
    isGenerating: false,
    currentDay: 0,
    totalDays: 0,
    progress: 0,
    days: [],
    overview: undefined,
    error: null,
    status: 'idle',
  });

  // Abort flag: when set to true, the progressive loop stops dispatching new days
  const cancelledRef = useRef(false);
  // Track calls made after a failure for monitoring
  const postFailureCallsRef = useRef(0);

  // generateFullItinerary was removed — progressive day-by-day is the only path now.
  // See generateItineraryProgressive below.

  /**
   * Generate itinerary day-by-day (legacy method)
   * Use for progressive display or when full generation times out
   */
  const generateItineraryProgressive = useCallback(async (trip: TripDetails): Promise<GeneratedDay[]> => {
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);
    let totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Reset cancellation flag at the start of a new generation
    cancelledRef.current = false;
    postFailureCallsRef.current = 0;

    setState({
      isGenerating: true,
      currentDay: 0,
      totalDays,
      progress: 0,
      days: [],
      overview: undefined,
      error: null,
      status: 'generating',
    });

    // Fetch multi-city data if applicable
    let dayCityMap: Array<{ cityName: string; country?: string; isTransitionDay: boolean; transitionFrom?: string; transitionTo?: string; transportType?: string }> | null = null;
    if (trip.isMultiCity) {
      try {
        const cities = await getTripCities(trip.tripId);
        if (cities.length > 0) {
          // For multi-city, derive totalDays from sum of city nights to prevent
          // date-arithmetic mismatches (stale end_date, off-by-one) from producing
          // extra/missing days or cycling through only some cities
          // Use nights directly. If nights is missing, derive from days_total (inclusive) by subtracting 1.
          const sumNights = cities.reduce((sum, c) => {
            const n = c.nights || ((c.days_total || 2) - 1);
            return sum + Math.max(1, n);
          }, 0);
          if (sumNights > 0 && sumNights !== totalDays) {
            console.log(`[useItineraryGeneration] Multi-city totalDays corrected: date-based=${totalDays}, city-nights-sum=${sumNights}`);
            totalDays = sumNights;
          }

          // Build day→city mapping
          const map: typeof dayCityMap = [];
          for (const city of cities) {
            // Use nights directly. If nights is missing, derive from days_total by subtracting 1.
            const nights = city.nights || Math.max(1, ((city.days_total || 2) - 1));
            for (let n = 0; n < nights; n++) {
              const isTransition = n === 0 && city.city_order > 0 && (city as any).transition_day_mode !== 'skip';
              const prevCity = city.city_order > 0 ? cities.find(c => c.city_order === city.city_order - 1) : null;
              map.push({
                cityName: city.city_name,
                country: city.country || undefined,
                isTransitionDay: isTransition,
                transitionFrom: isTransition ? prevCity?.city_name : undefined,
                transitionTo: isTransition ? city.city_name : undefined,
                transportType: isTransition ? (city.transport_type || undefined) : undefined,
              });
            }
          }
          // Pad/trim
          while (map.length < totalDays) map.push({ ...map[map.length - 1], isTransitionDay: false });
          dayCityMap = map.slice(0, totalDays);
        }
      } catch (e) {
        console.warn('[useItineraryGeneration] Could not load trip cities:', e);
      }
    }

    const generatedDays: GeneratedDay[] = [];
    const previousActivities: string[] = [];

    try {
      const MAX_RETRIES = 6; // More retries per day to handle provider timeouts
      const BACKOFF_DELAYS = [5000, 10000, 20000, 30000, 45000, 60000]; // Generous backoff for large trips

      for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
        // ABORT CHECK: Stop dispatching new days if cancelled/failed
        if (cancelledRef.current) {
          console.warn(`[useItineraryGeneration] Abort: skipping day ${dayNum}+ (cancelled)`);
          break;
        }
        setState(prev => ({
          ...prev,
          currentDay: dayNum,
          progress: Math.round(((dayNum - 1) / totalDays) * 100),
          status: 'generating',
        }));

        const dayDate = new Date(trip.startDate);
        dayDate.setDate(dayDate.getDate() + dayNum - 1);
        const formattedDate = dayDate.toISOString().split('T')[0];

        const cityInfo = dayCityMap?.[dayNum - 1];

        // Retry loop — never give up on transient failures, just backoff and retry
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          // Check abort between retry attempts
          if (cancelledRef.current) {
            console.warn(`[useItineraryGeneration] Abort: stopping retries for day ${dayNum}`);
            break;
          }
          try {
            if (cityInfo?.isTransitionDay) {
              console.log(`[useItineraryGeneration] 🚆 Day ${dayNum} is TRANSITION: ${cityInfo.transitionFrom} → ${cityInfo.transitionTo} via ${cityInfo.transportType}`);
            }
            
            const invokePromise = supabase.functions.invoke('generate-itinerary', {
              body: {
                action: 'generate-day',
                tripId: trip.tripId,
                dayNumber: dayNum,
                totalDays,
                destination: cityInfo?.cityName || trip.destination,
                destinationCountry: cityInfo?.country || trip.destinationCountry,
                date: formattedDate,
                travelers: trip.travelers,
                tripType: trip.tripType,
                budgetTier: trip.budgetTier,
                userId: trip.userId,
                previousDayActivities: previousActivities,
                isMultiCity: trip.isMultiCity || false,
                isTransitionDay: cityInfo?.isTransitionDay || false,
                transitionFrom: cityInfo?.transitionFrom,
                transitionTo: cityInfo?.transitionTo,
                transitionMode: cityInfo?.transportType,
                mustDoActivities: trip.mustDoActivities || '',
                perDayActivities: trip.perDayActivities || [],
              },
            });

            // 180-second timeout per day (complex destinations need more time)
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('__TIMEOUT__')), 180_000)
            );

            const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

            if (error) {
              const errMsg = error.message || String(error);
              // Rate limit & credits: don't retry
              if (errMsg.includes('Rate limit') || errMsg.includes('credits') || errMsg.includes('Credits')) {
                throw new Error(errMsg);
              }
              throw new Error(errMsg);
            }

            if (data?.error) {
              if (data.error.includes('Rate limit') || data.error.includes('credits') || data.error.includes('Credits')) {
                throw new Error(data.error);
              }
              throw new Error(data.error);
            }

            if (!data?.day) {
              throw new Error(`No itinerary data returned for day ${dayNum}`);
            }

            const generatedDay: GeneratedDay = data.day;

            // Frontend safety-net: sanitize all text fields before local state/save
            if (generatedDay.title) generatedDay.title = sanitizeAIOutput(generatedDay.title) || `Day ${dayNum}`;
            if (generatedDay.theme) generatedDay.theme = sanitizeAIOutput(generatedDay.theme) || generatedDay.title;
            if (generatedDay.narrative?.theme) generatedDay.narrative.theme = sanitizeAIOutput(generatedDay.narrative.theme) || generatedDay.theme || '';
            generatedDay.activities.forEach((act, idx) => {
              if (act.title) act.title = sanitizeAIOutput(act.title) || `Activity ${idx + 1}`;
              if (act.name) act.name = sanitizeAIOutput(act.name) || act.title;
              if (act.description) act.description = sanitizeAIOutput(act.description) || '';
              if (typeof act.tips === 'string') act.tips = sanitizeAIOutput(act.tips) || '';
            });

            generatedDays.push(generatedDay);

            // Track activities for context in subsequent days
            generatedDay.activities.forEach(act => {
              previousActivities.push(act.title || act.name || '');
            });

            setState(prev => ({
              ...prev,
              days: [...prev.days, generatedDay],
              progress: Math.round((dayNum / totalDays) * 100),
            }));

            // Auto-save after each successful day
            try {
              await saveItinerary(trip.tripId, generatedDays);
            } catch (saveErr) {
              console.warn(`[useItineraryGeneration] Partial save after day ${dayNum} failed (non-blocking):`, saveErr);
            }

            lastError = null;
            break; // Success
          } catch (dayErr) {
            lastError = dayErr instanceof Error ? dayErr : new Error(String(dayErr));
            const msg = lastError.message;

            // Non-retryable: credits/rate limit
            if (msg.includes('Rate limit') || msg.includes('credits') || msg.includes('Credits')) {
              throw lastError;
            }

            // Retryable: timeout, CORS, network errors, provider errors
            if (attempt < MAX_RETRIES) {
              const delay = BACKOFF_DELAYS[attempt] || 15000;
              const isTimeout = msg === '__TIMEOUT__' || msg.includes('timed out');
              const reason = isTimeout ? 'timeout' : 
                (msg.includes('CORS') || msg.includes('Failed to fetch')) ? 'network error' : 'server error';
              
              console.warn(`[useItineraryGeneration] Day ${dayNum} attempt ${attempt + 1} failed (${reason}), retrying in ${delay / 1000}s`);
              
              setState(prev => ({
                ...prev,
                status: 'generating',
                error: null,
                progress: Math.round(((dayNum - 1) / totalDays) * 100),
              }));

              // Show brief toast so user knows it's still working
              if (attempt >= 1) {
                toast.info(`Day ${dayNum} is taking longer than usual. Retrying automatically...`, { duration: 3000 });
              }

              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        if (lastError) {
          // Even after all retries, save what we have and provide clear feedback
          if (generatedDays.length > 0) {
            try {
              await saveItinerary(trip.tripId, generatedDays);
            } catch {}
          }
          const savedMsg = generatedDays.length > 0 
            ? ` Days 1-${generatedDays.length} have been saved. You can resume generation.`
            : '';
          throw new Error(`Day ${dayNum} couldn't be generated after ${MAX_RETRIES + 1} attempts.${savedMsg}`);
        }

        // Brief pause between days to avoid overwhelming the service
        if (dayNum < totalDays) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      // If cancelled mid-loop, save what we have and throw so the caller can refund
      if (cancelledRef.current && generatedDays.length < totalDays) {
        if (generatedDays.length > 0) {
          try { await saveItinerary(trip.tripId, generatedDays); } catch {}
        }
        throw new Error(
          generatedDays.length > 0
            ? `Generation cancelled after ${generatedDays.length}/${totalDays} days. Progress has been saved.`
            : 'Generation cancelled.'
        );
      }

      // Final save
      await saveItinerary(trip.tripId, generatedDays);

      setState(prev => ({
        ...prev,
        isGenerating: false,
        progress: 100,
        status: 'complete',
      }));

      toast.success(`Itinerary complete! ${totalDays} days of adventure await.`);
      return generatedDays;
    } catch (err) {
      // CRITICAL: Set cancellation flag so any pending loop iteration stops
      cancelledRef.current = true;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate itinerary';
      console.error(`[useItineraryGeneration] Generation failed, abort flag set. Post-failure calls so far: ${postFailureCallsRef.current}`);
      
      // Detect connection-level errors and proactively recover
      const isConnectionError = errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('CORS') || errorMessage.includes('NetworkError') ||
        errorMessage.includes('timed out') || errorMessage.includes('__TIMEOUT__');
      
      if (isConnectionError) {
        try {
          supabase.removeAllChannels();
          await guardedRefreshSession();
          resubscribeAll();
          resetConnectionFailures();
        } catch (cleanupErr) {
          console.warn('[useItineraryGeneration] Post-failure cleanup failed:', cleanupErr);
          reportConnectionFailure();
        }
      }

      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: errorMessage,
        status: 'error',
      }));
      throw err;
    }
  }, []);

  /**
   * Main generate function - uses full generation by default
   * Falls back to progressive if full fails
   */
  const generateItinerary = useCallback(async (trip: TripDetails): Promise<GeneratedDay[]> => {
    // Progressive generation with per-day retries and auto-save.
    // No monolithic fallback — that path times out for 8+ day trips.
    return await generateItineraryProgressive(trip);
  }, [generateItineraryProgressive]);

  /**
   * Start server-side generation (generate-trip action).
   * Returns immediately after the server acknowledges. The frontend should
   * then poll trip.itinerary_status until it becomes 'ready' or 'failed'.
   */
  const startServerGeneration = useCallback(async (
    trip: TripDetails & { creditsCharged?: number; requestedDays?: number; isFirstTrip?: boolean }
  ): Promise<{ status: string; totalDays: number }> => {
    // totalDays is used only for local state — the server recalculates from trip_cities for multi-city
    // Use local date parsing to avoid UTC off-by-one errors
    const [sy, sm, sd] = trip.startDate.split('-').map(Number);
    const [ey, em, ed] = trip.endDate.split('-').map(Number);
    const totalDays = Math.round((new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    setState({
      isGenerating: true,
      currentDay: 0,
      totalDays,
      progress: 0,
      days: [],
      overview: undefined,
      error: null,
      status: 'generating',
    });

    const { data, error } = await supabase.functions.invoke('generate-itinerary', {
      body: {
        action: 'generate-trip',
        tripId: trip.tripId,
        destination: trip.destination,
        destinationCountry: trip.destinationCountry,
        startDate: trip.startDate,
        endDate: trip.endDate,
        travelers: trip.travelers || 1,
        tripType: trip.tripType || 'vacation',
        budgetTier: trip.budgetTier || 'moderate',
        userId: trip.userId,
        isMultiCity: trip.isMultiCity || false,
        creditsCharged: trip.creditsCharged || 0,
        requestedDays: trip.requestedDays || totalDays,
        isFirstTrip: trip.isFirstTrip || false,
        mustDoActivities: trip.mustDoActivities || '',
        perDayActivities: trip.perDayActivities || [],
      },
    });

    if (error) {
      const errMsg = error.message || String(error);
      // Do not flip UI into hard error state here; caller will verify DB first.
      throw new Error(errMsg);
    }

    if (data?.error) {
      // Do not flip UI into hard error state here; caller will verify DB first.
      throw new Error(data.error);
    }

    // Server acknowledged — generation is running in background
    return { status: data?.status || 'generating', totalDays: data?.totalDays || totalDays };
  }, []);

  const saveItinerary = useCallback(async (tripId: string, days: GeneratedDay[]): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'save-itinerary',
          tripId,
          itinerary: { 
            days,
            status: 'ready',
            generatedAt: new Date().toISOString()
          },
        },
      });

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('[useItineraryGeneration] Save error:', err);
      toast.error('Failed to save itinerary');
      return false;
    }
  }, []);

  /** Cancel any in-progress generation — stops the day loop immediately */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    console.log('[useItineraryGeneration] Generation cancelled by caller');
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true; // Also cancel on reset
    setState({
      isGenerating: false,
      currentDay: 0,
      totalDays: 0,
      progress: 0,
      days: [],
      overview: undefined,
      error: null,
      status: 'idle',
    });
  }, []);

  return {
    ...state,
    generateItinerary,
    generateItineraryProgressive,
    startServerGeneration,
    saveItinerary,
    reset,
    cancel,
  };
}
