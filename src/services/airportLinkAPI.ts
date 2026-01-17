/**
 * Voyance Airport Link API Service
 * 
 * Integrates with Railway backend airport link endpoints:
 * - GET /api/v1/airportlink/:destinationId - Get airport code for destination
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface AirportLinkResponse {
  destinationId: string;
  airportLookupCode: string;
  defaultTransportModes: string[];
  isGenerated: boolean;
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// Airport Link API
// ============================================================================

/**
 * Get airport lookup code for a destination
 */
export async function getAirportLink(destinationId: string): Promise<AirportLinkResponse> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/airportlink/${destinationId}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[AirportLinkAPI] Get airport link error:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useAirportLink(destinationId: string | null) {
  return useQuery({
    queryKey: ['airport-link', destinationId],
    queryFn: () => destinationId ? getAirportLink(destinationId) : Promise.reject('No destination'),
    enabled: !!destinationId,
    staleTime: 30 * 60_000, // 30 minutes - airport codes don't change often
  });
}

// ============================================================================
// Export
// ============================================================================

const airportLinkAPI = {
  getAirportLink,
};

export default airportLinkAPI;
