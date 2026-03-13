/**
 * useRefreshDay — Triggers lightweight validation of a single itinerary day.
 * Calls the refresh-day edge function and returns issues, proposed changes & transit estimates.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RefreshIssue {
  type: 'timing_overlap' | 'operating_hours' | 'transit_gap' | 'insufficient_buffer' | 'sequence_error';
  activityId: string;
  activityTitle: string;
  severity: 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export interface RefreshTransitEstimate {
  fromId: string;
  toId: string;
  method: string;
  durationMinutes: number;
  distance: string;
  recommended?: boolean;
}

export interface ProposedChange {
  id: string;
  type: 'time_shift' | 'replacement' | 'buffer_added' | 'reorder' | 'no_change';
  activityId: string;
  activityTitle: string;
  icon: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  patch?: Record<string, unknown>;
}

export interface BufferInfo {
  fromId: string;
  fromTitle: string;
  toId: string;
  toTitle: string;
  bufferMinutes: number;
  requiredMinutes: number;
  isInsufficient: boolean;
}

export interface RefreshResult {
  issues: RefreshIssue[];
  proposedChanges: ProposedChange[];
  transitEstimates: RefreshTransitEstimate[];
  buffers: BufferInfo[];
  totalCost: number;
  activitiesValidated: number;
  dayNumber: number;
}

interface ActivityInput {
  id: string;
  title: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  location?: { lat?: number; lng?: number; address?: string; name?: string };
  operatingHours?: Record<string, { open: string; close: string }> | null;
  durationMinutes?: number;
  cost?: { amount: number; currency: string };
}

export function useRefreshDay() {
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDay = useCallback(async (
    activities: ActivityInput[],
    date: string,
    destination: string,
    dayNumber: number
  ): Promise<RefreshResult | null> => {
    setIsRefreshing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('refresh-day', {
        body: { activities, date, destination, dayNumber },
      });

      if (fnError) throw fnError;

      const refreshResult = data as RefreshResult;
      // Ensure proposedChanges array exists for backward compat
      if (!refreshResult.proposedChanges) {
        refreshResult.proposedChanges = [];
      }
      setResult(refreshResult);
      return refreshResult;
    } catch (err) {
      console.error('[useRefreshDay] Error:', err);
      setError(String(err));
      setResult(null);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isRefreshing, error, refreshDay, clearResult };
}
