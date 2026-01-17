/**
 * Progressive Itinerary Generation Hook
 * 
 * Implements the 4-stage progressive generation flow:
 * 1. Initialize (0% → 25%) - Validates trip, prepares generation
 * 2. Template (25% → 50%) - Creates skeleton with dates/titles
 * 3. Populate (50% → 75%) - Adds AI-generated activities
 * 4. Finalize (75% → 100%) - Finalizes details, saves to DB
 * 
 * Based on: docs/SOT_PROGRESSIVE_ITINERARY_GENERATION.md
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DayItinerary } from '@/types/itinerary';
import { convertBackendDay } from '@/types/itinerary';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export type ProgressStep = 'idle' | 'initialize' | 'template' | 'populate' | 'finalize' | 'complete' | 'error';

export interface UserPreferences {
  pace?: 'relaxed' | 'moderate' | 'packed';
  interests?: string[];
  budget?: 'budget' | 'moderate' | 'luxury';
  accessibility?: boolean;
  familyFriendly?: boolean;
}

export interface ProgressiveGenerationResponse {
  success: boolean;
  step: string;
  progress: number;
  message: string;
  data: {
    tripId?: string;
    destination?: string;
    duration?: number;
    template?: { days: any[] };
    itinerary?: { days: any[] };
  };
}

export interface ProgressiveItineraryState {
  loading: boolean;
  progress: number;
  currentStep: ProgressStep;
  message: string;
  days: DayItinerary[];
  error: Error | null;
  hasExistingItinerary: boolean;
  generationStartTime: number | null;
  generationDuration: number | null;
}

// ============================================================================
// HELPERS
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// HOOK
// ============================================================================

export function useProgressiveItinerary(tripId: string | null) {
  const [state, setState] = useState<ProgressiveItineraryState>({
    loading: false,
    progress: 0,
    currentStep: 'idle',
    message: '',
    days: [],
    error: null,
    hasExistingItinerary: false,
    generationStartTime: null,
    generationDuration: null,
  });

  const retryCount = useRef(0);
  const MAX_RETRIES = 2;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const executeStep = async (
    step: ProgressStep,
    preferences?: UserPreferences
  ): Promise<ProgressiveGenerationResponse> => {
    if (!tripId) throw new Error('No trip ID provided');

    const headers = await getAuthHeader();

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/trips/${tripId}/itinerary/generate-progressive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({ step, preferences }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(error.error || error.message || 'Generation failed');
      }

      return response.json();
    } catch (error) {
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        await delay(1000 * retryCount.current);
        return executeStep(step, preferences);
      }
      throw error;
    }
  };

  const checkExisting = useCallback(async (): Promise<boolean> => {
    if (!tripId) return false;

    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/itinerary`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) return false;
        throw new Error('Failed to check itinerary');
      }

      const data = await response.json();
      
      if (data.hasItinerary && data.itinerary?.days?.length > 0) {
        const convertedDays = data.itinerary.days.map(convertBackendDay);
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            hasExistingItinerary: true,
            days: convertedDays,
            currentStep: 'complete',
            progress: 100,
          }));
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking existing itinerary:', error);
      return false;
    }
  }, [tripId]);

  const generateProgressive = useCallback(async (preferences?: UserPreferences) => {
    if (!tripId) return;

    const startTime = Date.now();
    retryCount.current = 0;

    setState(prev => ({
      ...prev,
      loading: true,
      progress: 0,
      error: null,
      currentStep: 'initialize',
      message: 'Preparing your personalized itinerary...',
      generationStartTime: startTime,
    }));

    try {
      // Step 1: Initialize (0% → 25%)
      const step1 = await executeStep('initialize', preferences);
      if (!isMounted.current) return;
      setState(prev => ({
        ...prev,
        progress: step1.progress || 25,
        currentStep: 'initialize',
        message: step1.message || 'Analyzing your preferences...',
      }));
      await delay(500);

      // Step 2: Template (25% → 50%)
      const step2 = await executeStep('template', preferences);
      if (!isMounted.current) return;
      const templateDays = step2.data.template?.days?.map(convertBackendDay) || [];
      setState(prev => ({
        ...prev,
        progress: step2.progress || 50,
        currentStep: 'template',
        message: step2.message || 'Building your itinerary structure...',
        days: templateDays.length > 0 ? templateDays : prev.days,
      }));
      await delay(500);

      // Step 3: Populate (50% → 75%)
      const step3 = await executeStep('populate', preferences);
      if (!isMounted.current) return;
      const populatedDays = step3.data.itinerary?.days?.map(convertBackendDay) || [];
      setState(prev => ({
        ...prev,
        progress: step3.progress || 75,
        currentStep: 'populate',
        message: step3.message || 'Adding activities and recommendations...',
        days: populatedDays.length > 0 ? populatedDays : prev.days,
      }));
      await delay(500);

      // Step 4: Finalize (75% → 100%)
      const step4 = await executeStep('finalize', preferences);
      if (!isMounted.current) return;
      const finalDays = step4.data.itinerary?.days?.map(convertBackendDay) || [];
      const duration = Date.now() - startTime;

      setState(prev => ({
        ...prev,
        progress: 100,
        currentStep: 'complete',
        message: step4.message || 'Your itinerary is ready!',
        days: finalDays.length > 0 ? finalDays : prev.days,
        loading: false,
        generationDuration: duration,
        hasExistingItinerary: true,
      }));

    } catch (error) {
      if (!isMounted.current) return;
      setState(prev => ({
        ...prev,
        loading: false,
        currentStep: 'error',
        error: error instanceof Error ? error : new Error('Generation failed'),
        message: 'Something went wrong. Please try again.',
      }));
    }
  }, [tripId]);

  const regenerate = useCallback(async (preferences?: UserPreferences) => {
    setState(prev => ({
      ...prev,
      hasExistingItinerary: false,
      days: [],
      progress: 0,
      currentStep: 'idle',
    }));
    await generateProgressive(preferences);
  }, [generateProgressive]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, currentStep: 'idle' }));
  }, []);

  return {
    ...state,
    checkExisting,
    generateProgressive,
    regenerate,
    clearError,
  };
}
