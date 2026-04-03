/**
 * useTransitEstimate — Fetches walking/transit/taxi estimates between two locations.
 * Calls the transit-estimate edge function.
 */

import { useState, useCallback } from 'react';
import { formatDuration } from '@/utils/plannerUtils';
import { supabase } from '@/integrations/supabase/client';

export interface TransitEstimate {
  method: string;
  duration: string;
  durationMinutes: number;
  distance: string;
  distanceMeters: number;
  estimatedCost: { amount: number; currency: string } | null;
  recommended?: boolean;
}

interface LocationInput {
  lat?: number;
  lng?: number;
  address?: string;
  name?: string;
}

function toFunctionInput(loc: LocationInput): { lat: number; lng: number } | string {
  if (loc.lat && loc.lng) return { lat: loc.lat, lng: loc.lng };
  return loc.address || loc.name || '';
}

export function useTransitEstimate() {
  const [estimates, setEstimates] = useState<TransitEstimate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEstimate = useCallback(async (origin: LocationInput, destination: LocationInput, city?: string) => {
    const originInput = toFunctionInput(origin);
    const destInput = toFunctionInput(destination);

    // Need at least one valid input for each
    if ((!originInput || originInput === '') || (!destInput || destInput === '')) {
      setEstimates([]);
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('transit-estimate', {
        body: { origin: originInput, destination: destInput, city },
      });

      if (fnError) throw fnError;

      const result = data?.estimates || [];
      setEstimates(result);
      return result as TransitEstimate[];
    } catch (err) {
      console.error('[useTransitEstimate] Error:', err);
      setError(String(err));
      setEstimates([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setEstimates([]);
    setError(null);
  }, []);

  return { estimates, isLoading, error, fetchEstimate, clear };
}

/**
 * Get the recommended transit estimate from a list
 */
export function getRecommendedTransit(estimates: TransitEstimate[]): TransitEstimate | null {
  return estimates.find(e => e.recommended) || estimates[0] || null;
}

/**
 * Check if transit time exceeds available gap
 */
export function checkScheduleConflict(
  transitMinutes: number,
  gapMinutes: number
): { hasConflict: boolean; message: string } {
  if (gapMinutes < 0) {
    const overlapFormatted = formatDuration(Math.abs(gapMinutes));
    return {
      hasConflict: true,
      message: `This is ${transitMinutes} min away, and these activities would overlap by ${overlapFormatted}. Consider adjusting the timing.`,
    };
  }
  if (transitMinutes > gapMinutes) {
    return {
      hasConflict: true,
      message: `This is ${transitMinutes} min away but you only have a ${formatDuration(gapMinutes)} gap. Consider adjusting the timing.`,
    };
  }
  return { hasConflict: false, message: '' };
}
