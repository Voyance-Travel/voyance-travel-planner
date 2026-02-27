/**
 * useTransportComparison Hook
 * 
 * Fetches AI-generated transport comparison options for a city pair.
 * Returns TransportOption[] compatible with TransportComparisonCard.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TransportOption } from '@/components/itinerary/EditorialItinerary';

interface TransportComparisonParams {
  fromCity: string;
  fromCountry?: string;
  toCity: string;
  toCountry?: string;
  travelers: number;
  archetype?: string;
  budgetTier?: string;
  travelDate?: string;
  currency?: string;
}

interface TransportComparisonResult {
  options: TransportOption[];
  disclaimer: string;
}

async function fetchTransportComparison(params: TransportComparisonParams): Promise<TransportComparisonResult> {
  const { data, error } = await supabase.functions.invoke('compare-transport', {
    body: params,
  });

  if (error) throw new Error(error.message || 'Failed to fetch transport options');
  if (data?.error) throw new Error(data.error);

  return {
    options: (data.options || []) as TransportOption[],
    disclaimer: data.disclaimer || 'Prices are estimates. Book early for best rates.',
  };
}

export function useTransportComparison(
  params: TransportComparisonParams | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ['transport-comparison', params?.fromCity, params?.toCity, params?.travelers, params?.travelDate],
    queryFn: () => fetchTransportComparison(params!),
    enabled: enabled && !!params?.fromCity && !!params?.toCity,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
