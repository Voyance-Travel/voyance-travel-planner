/**
 * Voyance Itinerary Preview API Service
 * 
 * Integrates with Railway backend itinerary preview endpoints:
 * - POST /api/v1/itinerary/preview - Generate itinerary preview
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type BudgetTier = 'safe' | 'stretch' | 'splurge';

export interface ActivityBlock {
  id: string;
  time: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  cost: number;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface DayBlock {
  date: string;
  dayNumber: number;
  theme?: string;
  activities: ActivityBlock[];
  totalCost: number;
}

export interface ItineraryPreviewInput {
  tripId?: string;
  destinations: string[];
  dates: {
    start: string;
    end: string;
  };
  budgetTier: BudgetTier;
  styles?: string[];
}

export interface ItineraryPreviewResponse {
  success: boolean;
  preview?: {
    days: DayBlock[];
    totalDays: number;
    estimatedCost: number;
    source: 'db' | 'mock';
  };
  destinations?: string[];
  budgetTier?: BudgetTier;
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
// Itinerary Preview API
// ============================================================================

/**
 * Generate an itinerary preview
 */
export async function generateItineraryPreview(
  input: ItineraryPreviewInput
): Promise<ItineraryPreviewResponse> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/itinerary/preview`, {
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
    console.error('[ItineraryPreviewAPI] Generate error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate total trip cost from day blocks
 */
export function calculateTotalCost(days: DayBlock[]): number {
  return days.reduce((sum, day) => sum + day.totalCost, 0);
}

/**
 * Get budget tier display label
 */
export function getBudgetTierLabel(tier: BudgetTier): string {
  switch (tier) {
    case 'safe': return 'Budget-Friendly';
    case 'stretch': return 'Moderate';
    case 'splurge': return 'Premium';
    default: return 'Unknown';
  }
}

/**
 * Get budget tier color
 */
export function getBudgetTierColor(tier: BudgetTier): string {
  switch (tier) {
    case 'safe': return 'text-green-600';
    case 'stretch': return 'text-blue-600';
    case 'splurge': return 'text-purple-600';
    default: return 'text-muted-foreground';
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useGenerateItineraryPreview() {
  return useMutation({
    mutationFn: generateItineraryPreview,
  });
}

// ============================================================================
// Export
// ============================================================================

const itineraryPreviewAPI = {
  generateItineraryPreview,
  calculateTotalCost,
  getBudgetTierLabel,
  getBudgetTierColor,
};

export default itineraryPreviewAPI;
