import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FillDeadGapInput {
  destination: string;
  dayNumber: number;
  date?: string;
  activities: Array<{ id?: string; title?: string; startTime?: string; endTime?: string; category?: string }>;
  gap: { startTime: string; endTime: string; beforeId?: string; afterId?: string };
  archetype?: string;
  dietaryRestrictions?: string[];
  budgetTier?: string;
  tripCurrency?: string;
}

export interface SuggestedActivity {
  id: string;
  title: string;
  description?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  location?: { name?: string; address?: string };
  cost?: { amount: number; currency: string };
  rationale?: string;
}

export interface FillDeadGapResult {
  proposedChange?: {
    type: 'insert_activity';
    insertAfterId?: string;
    activity: SuggestedActivity;
  };
  fallback?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Calls refresh-day with mode:'fill_dead_gap'. Tracks avoidIds across retries
 * so "Try another" never returns the same suggestion twice.
 */
export function useFillDeadGap() {
  const [loading, setLoading] = useState(false);
  const [avoidIds, setAvoidIds] = useState<string[]>([]);

  const fetchSuggestion = useCallback(async (input: FillDeadGapInput): Promise<FillDeadGapResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-day', {
        body: {
          mode: 'fill_dead_gap',
          destination: input.destination,
          dayNumber: input.dayNumber,
          date: input.date || new Date().toISOString().slice(0, 10),
          activities: input.activities,
          gap: input.gap,
          avoidIds,
          archetype: input.archetype,
          dietaryRestrictions: input.dietaryRestrictions || [],
          budgetTier: input.budgetTier || 'standard',
          tripCurrency: input.tripCurrency || 'USD',
        },
      });
      if (error) return { error: error.message || 'request_failed' };
      const result = data as FillDeadGapResult;
      const title = result?.proposedChange?.activity?.title;
      if (title) setAvoidIds(prev => [...prev, title]);
      return result || { fallback: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'unknown' };
    } finally {
      setLoading(false);
    }
  }, [avoidIds]);

  const reset = useCallback(() => setAvoidIds([]), []);

  return { fetchSuggestion, loading, reset, attemptCount: avoidIds.length };
}
