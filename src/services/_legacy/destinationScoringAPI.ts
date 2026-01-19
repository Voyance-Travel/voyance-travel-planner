/**
 * Voyance Destination Scoring API Service
 * 
 * Integrates with Railway backend destination scoring endpoints:
 * - POST /api/v1/destinations/score - Score destinations based on user preferences
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type PricingTier = 'budget' | 'mid-range' | 'luxury';
export type ActivityLevel = 'relaxed' | 'moderate' | 'high';

export interface DestinationToScore {
  id: string;
  name: string;
  country: string; // ISO country code (2 chars)
  continent: string;
  lat: number;
  lon: number;
  popularityScore?: number;
  emotionalTags?: string[];
  pricingTier?: PricingTier;
  activityLevel?: ActivityLevel;
  touristFriendly?: boolean;
  averageHotelStars?: number;
  averageDailyBudget?: number;
}

export interface ScoredDestination extends DestinationToScore {
  score: number;
  matchReasons: string[];
  mismatchReasons: string[];
}

export interface ScoreDestinationsInput {
  destinations: DestinationToScore[];
}

export interface ScoreDestinationsResponse {
  success: boolean;
  scoredDestinations?: ScoredDestination[];
  topMatches?: ScoredDestination[];
  userPreferences?: {
    budgetLevel?: string;
    pacePreference?: number;
    luxuryLevel?: number;
  };
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
// Destination Scoring API
// ============================================================================

/**
 * Score destinations based on user preferences
 */
export async function scoreDestinations(
  input: ScoreDestinationsInput
): Promise<ScoreDestinationsResponse> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/destinations/score`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(input),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[DestinationScoringAPI] Score error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to score destinations',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useScoreDestinations() {
  return useMutation({
    mutationFn: scoreDestinations,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sort destinations by score (descending)
 */
export function sortByScore(destinations: ScoredDestination[]): ScoredDestination[] {
  return [...destinations].sort((a, b) => b.score - a.score);
}

/**
 * Get top N destinations by score
 */
export function getTopDestinations(
  destinations: ScoredDestination[],
  n: number = 5
): ScoredDestination[] {
  return sortByScore(destinations).slice(0, n);
}

/**
 * Filter destinations by minimum score
 */
export function filterByMinScore(
  destinations: ScoredDestination[],
  minScore: number
): ScoredDestination[] {
  return destinations.filter(d => d.score >= minScore);
}

// ============================================================================
// Export
// ============================================================================

const destinationScoringAPI = {
  scoreDestinations,
  sortByScore,
  getTopDestinations,
  filterByMinScore,
};

export default destinationScoringAPI;
