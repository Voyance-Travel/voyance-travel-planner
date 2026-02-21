import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getTripCities } from '@/services/tripCitiesService';

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

  /**
   * Generate complete itinerary using the new 7-stage pipeline
   * This is the preferred method - generates all days at once with enrichment
   */
  const generateFullItinerary = useCallback(async (trip: TripDetails): Promise<GeneratedDay[]> => {
    // Starting full generation

    setState({
      isGenerating: true,
      currentDay: 0,
      totalDays: 0,
      progress: 10,
      days: [],
      overview: undefined,
      error: null,
      status: 'preparing',
    });

    try {
      // Update progress: preparing
      setState(prev => ({ ...prev, progress: 20, status: 'generating' }));

      // Fetch multi-city data if applicable
      let citiesPayload: any[] | undefined;
      if (trip.isMultiCity) {
        try {
          const cities = await getTripCities(trip.tripId);
          if (cities.length > 0) {
            citiesPayload = cities.map(c => ({
              cityName: c.city_name,
              country: c.country,
              nights: c.nights || c.days_total || 1,
              order: c.city_order,
              transitionDayMode: (c as any).transition_day_mode || 'half_and_half',
              transportType: c.transport_type,
            }));
          }
        } catch (e) {
          console.warn('[useItineraryGeneration] Could not load trip cities:', e);
        }
      }

      // Call the new generate-full action
      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'generate-full',
          tripId: trip.tripId,
          userId: trip.userId,
          isMultiCity: trip.isMultiCity || false,
          cities: citiesPayload,
          // Include trip data as fallback for when trip isn't in database
          tripData: {
            destination: trip.destination,
            destinationCountry: trip.destinationCountry,
            startDate: trip.startDate,
            endDate: trip.endDate,
            travelers: trip.travelers,
            tripType: trip.tripType,
            budgetTier: trip.budgetTier,
            userId: trip.userId,
          },
        },
      });

      if (error) {
        console.error('[useItineraryGeneration] Edge function error:', error);
        const errMsg = error.message || String(error);
        // Detect CORS/network errors from infrastructure-level timeouts
        if (errMsg.includes('CORS') || errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('ERR_FAILED')) {
          throw new Error('The server took too long to respond. This can happen with longer trips. Please try again — your trip data has been saved.');
        }
        throw new Error(error.message || 'Failed to generate itinerary');
      }

      if (data?.error) {
        // Handle specific errors
        if (data.error.includes('Rate limit')) {
          toast.error('Rate limit exceeded. Please wait a moment and try again.');
          throw new Error(data.error);
        }
        if (data.error.includes('credits') || data.error.includes('Credits')) {
          toast.error('AI credits exhausted. Please add credits to continue.');
          throw new Error(data.error);
        }
        throw new Error(data.error);
      }

      if (!data?.itinerary?.days?.length) {
        throw new Error('No itinerary data returned');
      }

      const generatedDays: GeneratedDay[] = data.itinerary.days;
      const overview: TripOverview | undefined = data.itinerary.overview || data.overview;

      setState({
        isGenerating: false,
        currentDay: generatedDays.length,
        totalDays: generatedDays.length,
        progress: 100,
        days: generatedDays,
        overview,
        error: null,
        status: 'complete',
      });

      // Generation complete
      toast.success(`Itinerary generated! ${generatedDays.length} days of adventure await.`);

      // Trigger achievement for first itinerary generation
      try {
        const { checkMilestoneAchievements } = await import('@/services/achievementsAPI');
        await checkMilestoneAchievements('itinerary_generated', { 
          tripId: trip.tripId, 
          destination: trip.destination,
          days: generatedDays.length 
        });
      } catch (achievementErr) {
        console.warn('[Itinerary] Achievement unlock failed (non-blocking):', achievementErr);
      }

      return generatedDays;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate itinerary';
      console.error('[useItineraryGeneration] Error:', errorMessage);
      
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
   * Generate itinerary day-by-day (legacy method)
   * Use for progressive display or when full generation times out
   */
  const generateItineraryProgressive = useCallback(async (trip: TripDetails): Promise<GeneratedDay[]> => {
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

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
          // Build day→city mapping
          const map: typeof dayCityMap = [];
          for (const city of cities) {
            const nights = city.nights || city.days_total || 1;
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
          try {
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
                toast.info(`Day ${dayNum} is taking longer than usual — retrying automatically...`, { duration: 3000 });
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
            ? ` Days 1-${generatedDays.length} have been saved — you can resume generation.`
            : '';
          throw new Error(`Day ${dayNum} couldn't be generated after ${MAX_RETRIES + 1} attempts.${savedMsg}`);
        }

        // Brief pause between days to avoid overwhelming the service
        if (dayNum < totalDays) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate itinerary';
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

      toast.success('Itinerary saved successfully!');
      return true;
    } catch (err) {
      console.error('[useItineraryGeneration] Save error:', err);
      toast.error('Failed to save itinerary');
      return false;
    }
  }, []);

  const reset = useCallback(() => {
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
    generateFullItinerary,
    generateItineraryProgressive,
    saveItinerary,
    reset,
  };
}
