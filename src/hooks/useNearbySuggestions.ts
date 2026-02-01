/**
 * Nearby Suggestions Hook
 * 
 * Fetches archetype-filtered nearby places based on user location
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type NearbyCategory = 'coffee' | 'food' | 'wander' | 'drinks' | 'snacks';

export interface NearbySuggestion {
  id: string;
  name: string;
  category: string;
  description: string;
  whyForYou: string;
  distance: string;
  walkTime: string;
  priceLevel: number;
  rating?: number;
  isOpen?: boolean;
  address?: string;
  coordinates?: { lat: number; lng: number };
}

interface UseNearbySuggestionsState {
  suggestions: NearbySuggestion[];
  loading: boolean;
  error: string | null;
  category: NearbyCategory | null;
}

export function useNearbySuggestions() {
  const { toast } = useToast();
  const [state, setState] = useState<UseNearbySuggestionsState>({
    suggestions: [],
    loading: false,
    error: null,
    category: null,
  });

  const fetchSuggestions = useCallback(async (
    lat: number,
    lng: number,
    category: NearbyCategory,
    archetype?: string,
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night'
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null, category }));

    try {
      const { data, error } = await supabase.functions.invoke('nearby-suggestions', {
        body: {
          lat,
          lng,
          category,
          archetype,
          timeOfDay,
          radiusMeters: 800,
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setState({
        suggestions: data?.suggestions || [],
        loading: false,
        error: null,
        category,
      });

      return data?.suggestions || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch nearby places';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      toast({
        title: "Couldn't find nearby places",
        description: errorMessage,
        variant: "destructive",
      });
      return [];
    }
  }, [toast]);

  const clearSuggestions = useCallback(() => {
    setState({
      suggestions: [],
      loading: false,
      error: null,
      category: null,
    });
  }, []);

  return {
    ...state,
    fetchSuggestions,
    clearSuggestions,
  };
}
