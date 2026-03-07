/**
 * Progressive Itinerary Hook
 * 
 * Uses Supabase Edge Function for itinerary generation with streaming support.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DayItinerary } from '@/types/itinerary';
import { convertBackendDay } from '@/types/itinerary';
import { getTripCities } from '@/services/tripCitiesService';

// ============================================================================
// TYPES
// ============================================================================

export interface ItineraryProgress {
  status: 'idle' | 'generating' | 'complete' | 'error';
  progress: number; // 0-100
  currentDay: number;
  totalDays: number;
  message: string;
  days: DayItinerary[];
  error?: string;
}

export interface GenerateItineraryParams {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  tripType?: string;
  budgetTier?: string;
  preferences?: Record<string, unknown>;
  isMultiCity?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useProgressiveItinerary() {
  const [progress, setProgress] = useState<ItineraryProgress>({
    status: 'idle',
    progress: 0,
    currentDay: 0,
    totalDays: 0,
    message: '',
    days: [],
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const generate = useCallback(async (params: GenerateItineraryParams) => {
    if (isGeneratingRef.current) {
      // Already generating, ignoring duplicate call
      return;
    }

    isGeneratingRef.current = true;
    abortControllerRef.current = new AbortController();

    // Calculate total days
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    setProgress({
      status: 'generating',
      progress: 0,
      currentDay: 0,
      totalDays,
      message: 'Starting itinerary generation...',
      days: [],
    });

    try {
      // Fetch multi-city data if applicable
      let cities: Array<{ city_name: string; country?: string; nights?: number; days_total?: number; city_order: number; transition_day_mode?: string; transport_type?: string }> = [];
      if (params.isMultiCity) {
        try {
          cities = await getTripCities(params.tripId);
        } catch (e) {
          console.warn('[Progressive] Could not load trip cities:', e);
        }
      }

      // Call the generate-itinerary edge function
      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          tripId: params.tripId,
          destination: params.destination,
          startDate: params.startDate,
          endDate: params.endDate,
          travelers: params.travelers || 1,
          tripType: params.tripType || 'vacation',
          budgetTier: params.budgetTier || 'moderate',
          preferences: params.preferences || {},
          isMultiCity: params.isMultiCity || false,
          cities: cities.length > 0 ? cities.map(c => ({
            cityName: c.city_name,
            country: c.country,
            nights: c.nights || c.days_total || 1,
            order: c.city_order,
            transitionDayMode: c.transition_day_mode || 'half_and_half',
            transportType: c.transport_type,
          })) : undefined,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Process the response
      const itineraryData = data?.itinerary || data?.days || [];
      const days: DayItinerary[] = [];

      // Simulate progressive loading for better UX
      for (let i = 0; i < itineraryData.length; i++) {
        const dayData = itineraryData[i];
        const convertedDay = convertBackendDay(dayData);
        days.push(convertedDay);

        setProgress(prev => ({
          ...prev,
          progress: Math.round(((i + 1) / itineraryData.length) * 100),
          currentDay: i + 1,
          message: `Generated day ${i + 1} of ${itineraryData.length}`,
          days: [...days],
        }));

        // Small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setProgress(prev => ({
        ...prev,
        status: 'complete',
        progress: 100,
        message: 'Itinerary complete!',
        days,
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate itinerary';
      console.error('[Progressive] Generation error:', errorMessage);
      
      setProgress(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        message: errorMessage,
      }));
    } finally {
      isGeneratingRef.current = false;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isGeneratingRef.current = false;
    setProgress(prev => ({
      ...prev,
      status: 'idle',
      message: 'Generation cancelled',
    }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    setProgress({
      status: 'idle',
      progress: 0,
      currentDay: 0,
      totalDays: 0,
      message: '',
      days: [],
    });
  }, [cancel]);

  return {
    progress,
    generate,
    cancel,
    reset,
    isGenerating: progress.status === 'generating',
    isComplete: progress.status === 'complete',
    hasError: progress.status === 'error',
    days: progress.days,
  };
}

export default useProgressiveItinerary;
