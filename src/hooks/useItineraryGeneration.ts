import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { differenceInDays, addDays, format } from 'date-fns';

export interface GeneratedActivity {
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
  coordinates?: { lat: number; lng: number };
  type?: string;
}

export interface GeneratedDay {
  dayNumber: number;
  date: string;
  theme: string;
  activities: GeneratedActivity[];
  narrative?: {
    theme: string;
    highlights: string[];
  };
}

export interface ItineraryGenerationState {
  isGenerating: boolean;
  currentDay: number;
  totalDays: number;
  progress: number;
  days: GeneratedDay[];
  error: string | null;
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

export function useItineraryGeneration() {
  const [state, setState] = useState<ItineraryGenerationState>({
    isGenerating: false,
    currentDay: 0,
    totalDays: 0,
    progress: 0,
    days: [],
    error: null,
  });

  const generateItinerary = useCallback(async (trip: TripDetails): Promise<GeneratedDay[]> => {
    const totalDays = differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1;
    
    setState({
      isGenerating: true,
      currentDay: 0,
      totalDays,
      progress: 0,
      days: [],
      error: null,
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

        const dayDate = format(addDays(new Date(trip.startDate), dayNum - 1), 'yyyy-MM-dd');

        const { data, error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-day',
            tripId: trip.tripId,
            dayNumber: dayNum,
            totalDays,
            destination: trip.destination,
            destinationCountry: trip.destinationCountry,
            date: dayDate,
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
          // Handle rate limit and payment errors
          if (data.error.includes('Rate limit')) {
            toast.error('Rate limit exceeded. Please wait a moment and try again.');
            throw new Error(data.error);
          }
          if (data.error.includes('credits') || data.error.includes('Payment')) {
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
          previousActivities.push(act.name);
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

      setState(prev => ({
        ...prev,
        isGenerating: false,
        progress: 100,
      }));

      return generatedDays;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate itinerary';
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: errorMessage,
      }));
      throw err;
    }
  }, []);

  const saveItinerary = useCallback(async (tripId: string, days: GeneratedDay[]): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'save-itinerary',
          tripId,
          itinerary: { days },
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
      error: null,
    });
  }, []);

  return {
    ...state,
    generateItinerary,
    saveItinerary,
    reset,
  };
}
