/**
 * Voyance Maps API Service
 * 
 * Integrates with Railway backend maps endpoints:
 * - POST /api/v1/maps/details - Get map details (photos, reviews, rating)
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// ============================================================================
// Types
// ============================================================================

export interface MapsDetailsInput {
  placeId?: string;
  lat?: number;
  lng?: number;
}

export interface MapsReview {
  author: string;
  rating: number;
  text: string;
  date?: string;
}

export interface MapsDetailsResponse {
  success: boolean;
  photos?: string[];
  reviews?: MapsReview[];
  rating?: number;
  sourceBreakdown?: Record<string, number>;
  error?: string;
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
  
  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// Maps API
// ============================================================================

/**
 * Get map details for a place (photos, reviews, rating)
 */
export async function getMapsDetails(input: MapsDetailsInput): Promise<MapsDetailsResponse> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/maps/details`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(input),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[MapsAPI] Get details error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get map details',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useGetMapsDetails() {
  return useMutation({
    mutationFn: getMapsDetails,
  });
}

// ============================================================================
// Export
// ============================================================================

const mapsAPI = {
  getMapsDetails,
};

export default mapsAPI;
