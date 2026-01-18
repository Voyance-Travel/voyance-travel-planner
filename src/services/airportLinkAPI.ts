/**
 * Voyance Airport Link API Service
 * 
 * Airport lookup - now using Supabase destinations table.
 * Gets airport codes from destination data.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface AirportLinkResponse {
  destinationId: string;
  airportLookupCode: string;
  defaultTransportModes: string[];
  isGenerated: boolean;
}

// Major city airport codes fallback
const CITY_AIRPORT_CODES: Record<string, string> = {
  'paris': 'CDG',
  'london': 'LHR',
  'new york': 'JFK',
  'los angeles': 'LAX',
  'tokyo': 'NRT',
  'sydney': 'SYD',
  'dubai': 'DXB',
  'singapore': 'SIN',
  'hong kong': 'HKG',
  'amsterdam': 'AMS',
  'frankfurt': 'FRA',
  'barcelona': 'BCN',
  'rome': 'FCO',
  'bangkok': 'BKK',
  'madrid': 'MAD',
  'berlin': 'BER',
  'munich': 'MUC',
  'milan': 'MXP',
  'vienna': 'VIE',
  'zurich': 'ZRH',
  'istanbul': 'IST',
  'miami': 'MIA',
  'san francisco': 'SFO',
  'chicago': 'ORD',
  'boston': 'BOS',
  'seattle': 'SEA',
  'denver': 'DEN',
  'atlanta': 'ATL',
  'toronto': 'YYZ',
  'vancouver': 'YVR',
  'montreal': 'YUL',
  'mexico city': 'MEX',
  'cancun': 'CUN',
  'lisbon': 'LIS',
  'porto': 'OPO',
  'dublin': 'DUB',
  'edinburgh': 'EDI',
  'athens': 'ATH',
  'prague': 'PRG',
  'budapest': 'BUD',
  'copenhagen': 'CPH',
  'stockholm': 'ARN',
  'oslo': 'OSL',
  'helsinki': 'HEL',
  'brussels': 'BRU',
  'seoul': 'ICN',
  'osaka': 'KIX',
  'beijing': 'PEK',
  'shanghai': 'PVG',
  'taipei': 'TPE',
  'kuala lumpur': 'KUL',
  'bali': 'DPS',
  'phuket': 'HKT',
  'maldives': 'MLE',
  'johannesburg': 'JNB',
  'cape town': 'CPT',
  'cairo': 'CAI',
  'marrakech': 'RAK',
  'nairobi': 'NBO',
  'buenos aires': 'EZE',
  'rio de janeiro': 'GIG',
  'sao paulo': 'GRU',
  'lima': 'LIM',
  'bogota': 'BOG',
  'auckland': 'AKL',
  'fiji': 'NAN',
  'honolulu': 'HNL',
};

// ============================================================================
// Airport Link API - Using Supabase
// ============================================================================

/**
 * Get airport lookup code for a destination
 */
export async function getAirportLink(destinationId: string): Promise<AirportLinkResponse> {
  // Try to get from destinations table
  const { data: destination } = await supabase
    .from('destinations')
    .select('id, city, airport_lookup_codes, airport_codes, default_transport_modes')
    .eq('id', destinationId)
    .single();

  if (destination) {
    // Use stored airport code
    let airportCode = destination.airport_lookup_codes;

    if (!airportCode && destination.airport_codes) {
      const codes = destination.airport_codes;
      if (Array.isArray(codes) && codes.length > 0) {
        airportCode = codes[0] as string;
      } else if (typeof codes === 'object' && codes !== null && 'primary' in codes) {
        airportCode = (codes as { primary?: string }).primary;
      }
    }

    // Fallback to city lookup
    if (!airportCode) {
      const cityLower = destination.city.toLowerCase();
      airportCode = CITY_AIRPORT_CODES[cityLower];
    }

    const transportModes = Array.isArray(destination.default_transport_modes)
      ? destination.default_transport_modes as string[]
      : ['walking', 'public_transport', 'taxi'];

    return {
      destinationId: destination.id,
      airportLookupCode: airportCode || destination.city.substring(0, 3).toUpperCase(),
      defaultTransportModes: transportModes,
      isGenerated: !destination.airport_lookup_codes,
    };
  }

  // If not found by ID, try by city name in the ID
  const cityGuess = destinationId.replace(/-/g, ' ').toLowerCase();
  const airportCode = CITY_AIRPORT_CODES[cityGuess];

  return {
    destinationId,
    airportLookupCode: airportCode || destinationId.substring(0, 3).toUpperCase(),
    defaultTransportModes: ['walking', 'public_transport', 'taxi'],
    isGenerated: true,
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useAirportLink(destinationId: string | null) {
  return useQuery({
    queryKey: ['airport-link', destinationId],
    queryFn: () => destinationId ? getAirportLink(destinationId) : Promise.reject('No destination'),
    enabled: !!destinationId,
    staleTime: 30 * 60_000, // 30 minutes
  });
}

// ============================================================================
// Export
// ============================================================================

const airportLinkAPI = {
  getAirportLink,
};

export default airportLinkAPI;
