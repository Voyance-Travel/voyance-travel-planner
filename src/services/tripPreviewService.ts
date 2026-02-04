/**
 * Trip Preview Service - Optimized Free Tier
 * 
 * Generates AI-only trip previews that cost ~$0.02-0.03
 * Does NOT call expensive APIs (Google Places, Amadeus)
 * Returns teaser content without real venue names
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// Types
// =============================================================================

export interface PreviewTimeBlock {
  period: 'morning' | 'afternoon' | 'evening';
  activityType: string;
  teaser: string;
  dnaAlignment?: string;
}

export interface PreviewDay {
  dayNumber: number;
  date: string;
  title: string;
  theme: string;
  neighborhood: string;
  timeBlocks: PreviewTimeBlock[];
}

export interface TripPreview {
  destination: string;
  totalDays: number;
  days: PreviewDay[];
  highlights: string[];
  dnaCallouts: string[];
  isPreview: true;
  generatedAt: string;
}

export interface GeneratePreviewParams {
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
}

export interface PreviewResponse {
  success: boolean;
  preview?: TripPreview;
  message?: string;
  error?: string;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Generate a FREE trip preview (AI-only, no expensive APIs)
 * This is the cost-optimized free tier experience
 */
export async function generateTripPreview(
  params: GeneratePreviewParams
): Promise<PreviewResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-trip-preview', {
      body: params,
    });

    if (error) {
      console.error('[tripPreviewService] Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate preview',
      };
    }

    return data as PreviewResponse;
  } catch (err) {
    console.error('[tripPreviewService] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check if user can generate a free preview
 * (rate limiting, daily limits, etc.)
 */
export async function canGeneratePreview(): Promise<{
  canGenerate: boolean;
  remaining: number;
  resetAt?: string;
}> {
  // For now, allow unlimited previews since they're cheap (~$0.025 each)
  // TODO: Add rate limiting if abuse occurs
  return {
    canGenerate: true,
    remaining: 10, // Soft daily limit
  };
}

// =============================================================================
// React Query Integration
// =============================================================================

import { useMutation, useQuery } from '@tanstack/react-query';

/**
 * Hook for generating trip previews
 */
export function useGenerateTripPreview() {
  return useMutation({
    mutationFn: generateTripPreview,
    mutationKey: ['generate-trip-preview'],
  });
}

/**
 * Hook for checking preview availability
 */
export function usePreviewAvailability() {
  return useQuery({
    queryKey: ['preview-availability'],
    queryFn: canGeneratePreview,
    staleTime: 60 * 1000, // 1 minute
  });
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert a preview to a displayable format
 */
export function formatPreviewForDisplay(preview: TripPreview): {
  title: string;
  subtitle: string;
  dayCount: number;
  isTeaser: boolean;
} {
  return {
    title: `Your ${preview.totalDays}-Day ${preview.destination} Adventure`,
    subtitle: preview.highlights[0] || `Discover ${preview.destination}`,
    dayCount: preview.totalDays,
    isTeaser: true,
  };
}

/**
 * Check if content is a preview (vs full itinerary)
 */
export function isPreviewContent(data: any): data is TripPreview {
  return data?.isPreview === true;
}

export default {
  generateTripPreview,
  canGeneratePreview,
};
