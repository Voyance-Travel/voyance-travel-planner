/**
 * Trip Preview Service - Optimized Free Tier
 * 
 * ZERO-COST FIRST ARCHITECTURE:
 * 1. FIRST: Check for static template ($0 cost)
 * 2. FALLBACK: AI-generated preview (~$0.02-0.03 cost)
 * 
 * This reduces free user acquisition cost from ~$0.40 to ~$0.00-0.03
 */

import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/utils/dateUtils';
import { getDestinationTemplate, hasStaticTemplate, type DestinationTemplate } from '@/data/destinationTemplates';

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
  isStatic: boolean; // true = $0 template, false = AI-generated
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
  source?: 'static' | 'ai';
}

// =============================================================================
// Static Template Conversion
// =============================================================================

/**
 * Convert a static template to a preview format with date alignment
 */
function templateToPreview(template: DestinationTemplate, startDate: string, requestedDays: number): TripPreview {
  const start = new Date(startDate);
  const cappedDays = Math.min(requestedDays, template.totalDays);
  
  const days: PreviewDay[] = template.days.slice(0, cappedDays).map((day, index) => ({
    dayNumber: index + 1,
    date: new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    title: day.title,
    theme: day.theme,
    neighborhood: day.neighborhood,
    timeBlocks: day.timeBlocks,
  }));

  return {
    destination: template.destination,
    totalDays: cappedDays,
    days,
    highlights: template.highlights,
    dnaCallouts: template.dnaCallouts,
    isPreview: true,
    isStatic: true,
    generatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Generate a FREE trip preview
 * ZERO-COST FIRST: Uses static template if available, falls back to AI
 */
export async function generateTripPreview(
  params: GeneratePreviewParams
): Promise<PreviewResponse> {
  try {
    // Calculate trip duration
    const start = parseLocalDate(params.startDate);
    const end = parseLocalDate(params.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const cappedDays = Math.min(totalDays, 2); // Free preview limited to 2 days

    // FIRST: Try static template ($0 cost)
    const template = getDestinationTemplate(params.destination);
    if (template) {
      console.log(`[tripPreviewService] Using static template for ${params.destination} ($0 cost)`);
      return {
        success: true,
        preview: templateToPreview(template, params.startDate, cappedDays),
        message: 'This is a free preview. Unlock the full itinerary to see real venues, booking links, and optimized routing.',
        source: 'static',
      };
    }

    // FALLBACK: AI-generated preview (~$0.02-0.03 cost)
    console.log(`[tripPreviewService] No template for ${params.destination}, using AI preview`);
    
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

    return {
      ...data,
      source: 'ai',
      preview: data.preview ? { ...data.preview, isStatic: false } : undefined,
    } as PreviewResponse;
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
 * Returns cost estimate based on whether static template exists
 */
export async function canGeneratePreview(destination?: string): Promise<{
  canGenerate: boolean;
  remaining: number;
  hasTemplate: boolean;
  estimatedCost: number;
  resetAt?: string;
}> {
  const hasTemplate = destination ? hasStaticTemplate(destination) : false;
  return {
    canGenerate: true,
    remaining: 10, // Soft daily limit
    hasTemplate,
    estimatedCost: hasTemplate ? 0 : 0.025,
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
 * Hook for checking preview availability and cost
 */
export function usePreviewAvailability(destination?: string) {
  return useQuery({
    queryKey: ['preview-availability', destination],
    queryFn: () => canGeneratePreview(destination),
    staleTime: 60 * 1000, // 1 minute
    enabled: !!destination,
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
