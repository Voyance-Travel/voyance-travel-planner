/**
 * Full Preview Service - "Full Preview, No Details" Model
 * 
 * Generates complete itineraries with real venue names but gated details.
 * Cost: ~$0.10-0.14 per preview (AI + light validation)
 * 
 * What users SEE (free):
 * - Real venue names and times
 * - Personalized reasoning
 * - Full day structure
 * 
 * What users PAY for:
 * - Addresses, hours, tips
 * - Photos and booking links
 * - Map coordinates
 * - PDF export
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// Types
// =============================================================================

export interface FullPreviewRequest {
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
  archetype?: string;
}

export interface PreviewActivity {
  time: string;
  venueName: string;
  venueType: 'dining' | 'cultural' | 'nature' | 'shopping' | 'entertainment' | 'transport' | 'accommodation';
  neighborhood: string;
  reasoning: string;
  durationMinutes: number;
  // GATED - null in preview
  address?: null;
  hours?: null;
  photoUrl?: null;
  bookingUrl?: null;
  tips?: null;
  coordinates?: null;
}

export interface PreviewDay {
  dayNumber: number;
  date: string;
  title: string;
  theme: string;
  activities: PreviewActivity[];
}

export interface FullPreview {
  destination: string;
  country?: string;
  totalDays: number;
  totalActivities: number;
  days: PreviewDay[];
  tripSummary: {
    experienceCount: number;
    diningCount: number;
    culturalCount: number;
    uniqueNeighborhoods: string[];
  };
  dnaAlignment: string[];
  isPreview: true;
  gatedFeatures: string[];
  generatedAt: string;
}

export interface ConversionCopy {
  headline: string;
  subheadline: string;
  cta: string;
  valueProps: string[];
}

export interface FullPreviewResponse {
  success: boolean;
  preview?: FullPreview;
  conversionCopy?: ConversionCopy;
  error?: string;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Generate a full preview itinerary with real venue names
 * Requires authentication
 */
export async function generateFullPreview(
  params: FullPreviewRequest
): Promise<FullPreviewResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: 'Please sign in to generate your itinerary preview',
      };
    }

    const { data, error } = await supabase.functions.invoke('generate-full-preview', {
      body: params,
    });

    if (error) {
      console.error('[fullPreviewService] Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate preview',
      };
    }

    return data as FullPreviewResponse;
  } catch (err) {
    console.error('[fullPreviewService] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// =============================================================================
// React Query Hooks
// =============================================================================

/**
 * Hook for generating full preview itineraries
 */
export function useGenerateFullPreview() {
  return useMutation({
    mutationFn: generateFullPreview,
    mutationKey: ['generate-full-preview'],
  });
}

// =============================================================================
// Cost Constants
// =============================================================================

export const FULL_PREVIEW_COSTS = {
  // Estimated cost breakdown
  aiGeneration: 0.04,      // gemini-3-flash-preview
  venueValidation: 0.05,   // 1-3 Google text searches
  dnaLookup: 0.01,         // DB query
  total: 0.10,             // ~$0.10-0.14 per preview
  
  // What's gated (and costs us to provide)
  gatedCosts: {
    fullDetails: 0.15,     // Full Google Places details
    photos: 0.10,          // Photo API calls
    routing: 0.05,         // Routes/directions
    hotelSearch: 0.12,     // Amadeus
  },
};
