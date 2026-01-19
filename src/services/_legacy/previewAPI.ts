/**
 * Voyance Preview API Service
 * 
 * Integrates with Railway backend preview endpoints:
 * - POST /api/v1/preview/generate - Generate a preview/teaser itinerary
 * - GET /api/v1/preview/remaining - Get remaining previews count
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface PreviewActivity {
  time: string;
  name: string;
  type: string;
  description: string;
  isPlaceholder: boolean;
}

export interface PreviewHotel {
  name: string;
  priceRange: string;
  isPlaceholder: boolean;
}

export interface PreviewPricing {
  singleUnlock: number;
  tripPack: number;
  unlimitedMonthly: number;
}

export interface PreviewData {
  destination: string;
  days: number;
  dayTitle: string;
  activities: PreviewActivity[];
  hotels: PreviewHotel[];
  totalEstimatedCost: string;
  isPreview: true;
  previewsRemaining: number;
}

export interface PreviewUpgrade {
  message: string;
  ctaUrl: string;
  pricing: PreviewPricing;
}

export interface GeneratePreviewInput {
  destination: string;
  startDate?: string;
  endDate?: string;
}

export interface PreviewResponse {
  success: boolean;
  preview?: PreviewData;
  upgrade?: PreviewUpgrade;
  limitReached?: boolean;
  error?: string;
}

export interface PreviewRemainingResponse {
  success: boolean;
  remaining: number;
  limit: number;
  used: number;
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

async function previewApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/preview${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Preview API
// ============================================================================

/**
 * Generate a preview/teaser itinerary
 * Limited to 3 previews per user
 */
export async function generatePreview(
  input: GeneratePreviewInput
): Promise<PreviewResponse> {
  try {
    const response = await previewApiRequest<PreviewResponse>('/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[PreviewAPI] Generate preview error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview',
    };
  }
}

/**
 * Get remaining preview count for current user
 */
export async function getPreviewRemaining(): Promise<PreviewRemainingResponse> {
  try {
    const response = await previewApiRequest<PreviewRemainingResponse>('/remaining', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[PreviewAPI] Get remaining error:', error);
    return {
      success: false,
      remaining: 0,
      limit: 3,
      used: 0,
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function usePreviewRemaining() {
  return useQuery({
    queryKey: ['preview-remaining'],
    queryFn: getPreviewRemaining,
    staleTime: 60_000, // 1 minute
  });
}

export function useGeneratePreview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: generatePreview,
    onSuccess: () => {
      // Invalidate remaining count after generating a preview
      queryClient.invalidateQueries({ queryKey: ['preview-remaining'] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const previewAPI = {
  generatePreview,
  getPreviewRemaining,
};

export default previewAPI;
