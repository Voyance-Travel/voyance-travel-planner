/**
 * Voyance Transport API Service
 * 
 * Transport options - now using Supabase destinations table.
 * Falls back to sensible defaults if no data exists.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Types
// ============================================================================

export type TransportModeType = 
  | 'walking'
  | 'driving'
  | 'public_transport'
  | 'taxi'
  | 'bike'
  | 'metro'
  | 'bus'
  | 'tram'
  | 'ferry'
  | 'cable_car'
  | 'rickshaw'
  | 'scooter'
  | 'other';

export interface TransportOptionsResponse {
  destinationId: string;
  city: string;
  country: string;
  transportModes: TransportModeType[];
  isDefault: boolean;
}

// Default transport modes for most cities
const DEFAULT_TRANSPORT_MODES: TransportModeType[] = [
  'walking',
  'public_transport',
  'taxi',
  'metro',
  'bus',
];

// City-specific transport modes
const CITY_TRANSPORT_OVERRIDES: Record<string, TransportModeType[]> = {
  'venice': ['walking', 'ferry', 'taxi'],
  'amsterdam': ['walking', 'bike', 'tram', 'taxi', 'ferry'],
  'copenhagen': ['walking', 'bike', 'metro', 'bus', 'taxi'],
  'bangkok': ['walking', 'metro', 'taxi', 'bus', 'tram', 'ferry', 'rickshaw'],
  'tokyo': ['walking', 'metro', 'bus', 'taxi'],
  'new york': ['walking', 'metro', 'taxi', 'bus'],
  'london': ['walking', 'metro', 'bus', 'taxi'],
  'paris': ['walking', 'metro', 'bus', 'taxi', 'bike'],
  'san francisco': ['walking', 'metro', 'bus', 'taxi', 'cable_car'],
  'lisbon': ['walking', 'metro', 'tram', 'taxi', 'bus'],
  'hong kong': ['walking', 'metro', 'bus', 'taxi', 'ferry', 'tram'],
};

// ============================================================================
// Transport API - Using Supabase with smart defaults
// ============================================================================

/**
 * Get transport options available for a destination
 */
export async function getTransportOptions(destinationId: string): Promise<TransportOptionsResponse> {
  // Try to get from Supabase destinations table
  const { data: destination } = await supabase
    .from('destinations')
    .select('id, city, country, default_transport_modes')
    .eq('id', destinationId)
    .single();

  if (destination) {
    // Use stored transport modes or city-specific overrides or defaults
    const cityLower = destination.city.toLowerCase();
    let transportModes: TransportModeType[];

    if (destination.default_transport_modes && Array.isArray(destination.default_transport_modes)) {
      transportModes = destination.default_transport_modes as TransportModeType[];
    } else if (CITY_TRANSPORT_OVERRIDES[cityLower]) {
      transportModes = CITY_TRANSPORT_OVERRIDES[cityLower];
    } else {
      transportModes = DEFAULT_TRANSPORT_MODES;
    }

    return {
      destinationId: destination.id,
      city: destination.city,
      country: destination.country,
      transportModes,
      isDefault: !destination.default_transport_modes,
    };
  }

  // Fallback: search by ID pattern or return defaults
  return {
    destinationId,
    city: 'Unknown',
    country: 'Unknown',
    transportModes: DEFAULT_TRANSPORT_MODES,
    isDefault: true,
  };
}

/**
 * Get transport mode display name
 */
export function getTransportModeLabel(mode: TransportModeType): string {
  const labels: Record<TransportModeType, string> = {
    walking: 'Walking',
    driving: 'Driving',
    public_transport: 'Public Transport',
    taxi: 'Taxi/Rideshare',
    bike: 'Bicycle',
    metro: 'Metro/Subway',
    bus: 'Bus',
    tram: 'Tram',
    ferry: 'Ferry',
    cable_car: 'Cable Car',
    rickshaw: 'Rickshaw',
    scooter: 'Scooter',
    other: 'Other',
  };
  return labels[mode] || mode;
}

/**
 * Get transport mode icon name (for lucide-react)
 */
export function getTransportModeIcon(mode: TransportModeType): string {
  const icons: Record<TransportModeType, string> = {
    walking: 'Footprints',
    driving: 'Car',
    public_transport: 'Bus',
    taxi: 'CarTaxiFront',
    bike: 'Bike',
    metro: 'Train',
    bus: 'Bus',
    tram: 'Tram',
    ferry: 'Ship',
    cable_car: 'CableCar',
    rickshaw: 'Bike',
    scooter: 'Bike',
    other: 'Navigation',
  };
  return icons[mode] || 'Navigation';
}

// ============================================================================
// React Query Hooks
// ============================================================================

const transportKeys = {
  all: ['transport'] as const,
  options: (destinationId: string) => [...transportKeys.all, 'options', destinationId] as const,
};

export function useTransportOptions(destinationId: string | null) {
  return useQuery({
    queryKey: transportKeys.options(destinationId || ''),
    queryFn: () => destinationId ? getTransportOptions(destinationId) : Promise.reject('No destination ID'),
    enabled: !!destinationId,
    staleTime: 30 * 60_000, // 30 minutes - this data rarely changes
  });
}

// Default export
export default {
  getTransportOptions,
  getTransportModeLabel,
  getTransportModeIcon,
};
