import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    console.log('[useItineraryGeneration] Starting full generation for:', trip.destination);

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

      // Call the new generate-full action
      // Pass trip data directly for localStorage/demo mode trips that aren't in DB
      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'generate-full',
          tripId: trip.tripId,
          userId: trip.userId,
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

      console.log('[useItineraryGeneration] Generation complete:', generatedDays.length, 'days');
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

    console.log('[useItineraryGeneration] Starting progressive generation:', totalDays, 'days');

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

    const generatedDays: GeneratedDay[] = [];
    const previousActivities: string[] = [];

    try {
      for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
        setState(prev => ({
          ...prev,
          currentDay: dayNum,
          progress: Math.round(((dayNum - 1) / totalDays) * 100),
        }));

        const dayDate = new Date(trip.startDate);
        dayDate.setDate(dayDate.getDate() + dayNum - 1);
        const formattedDate = dayDate.toISOString().split('T')[0];

        const { data, error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-day',
            tripId: trip.tripId,
            dayNumber: dayNum,
            totalDays,
            destination: trip.destination,
            destinationCountry: trip.destinationCountry,
            date: formattedDate,
            travelers: trip.travelers,
            tripType: trip.tripType,
            budgetTier: trip.budgetTier,
            userId: trip.userId,
            previousDayActivities: previousActivities,
          },
        });

        if (error) {
          console.error(`[useItineraryGeneration] Day ${dayNum} error:`, error);
          throw new Error(error.message || `Failed to generate day ${dayNum}`);
        }

        if (data?.error) {
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

        // Small delay between days to avoid rate limiting
        if (dayNum < totalDays) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Save the complete itinerary
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
    try {
      return await generateFullItinerary(trip);
    } catch (error) {
      console.warn('[useItineraryGeneration] Full generation failed, trying progressive:', error);
      // Only fall back for non-rate-limit/credit errors
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Rate limit') || message.includes('credits') || message.includes('Credits')) {
        throw error;
      }
      return await generateItineraryProgressive(trip);
    }
  }, [generateFullItinerary, generateItineraryProgressive]);

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
