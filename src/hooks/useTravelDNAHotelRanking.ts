/**
 * Travel DNA Hotel Ranking Hook
 * 
 * Orchestrates fetching user's Travel DNA and applying the
 * UserPreferenceWeightingEngine to rank hotels based on personality match.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { HotelOption } from '@/services/hotelAPI';
import {
  mapHotelToMetadata,
  getBudgetTarget,
  type MappingContext,
  type HotelMetadata,
} from '@/utils/hotelMetadataMapper';

// ============================================================================
// Types
// ============================================================================

export interface DNATraitScores {
  planning: number;
  social: number;
  comfort: number;
  pace: number;
  budget: number;
  adventure: number;
  culture: number;
  authenticity: number;
}

export interface TravelDNAData {
  traitScores: DNATraitScores | null;
  budgetTier: string | null;
  primaryArchetype: string | null;
}

// ============================================================================
// DNA Fetching
// ============================================================================

async function fetchTravelDNA(userId: string): Promise<TravelDNAData | null> {
  // Fetch both travel_dna_profiles and user_preferences in parallel
  const [dnaResult, prefsResult] = await Promise.all([
    supabase
      .from('travel_dna_profiles')
      .select('trait_scores, primary_archetype_name')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_preferences')
      .select('budget_tier')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  
  if (dnaResult.error) {
    console.error('Error fetching travel DNA:', dnaResult.error);
  }
  
  if (prefsResult.error) {
    console.error('Error fetching user preferences:', prefsResult.error);
  }
  
  // If neither has data, return null
  if (!dnaResult.data && !prefsResult.data) {
    return null;
  }
  
  // Parse trait scores from JSON — normalize to 0–1 range
  const rawTraitScores = dnaResult.data?.trait_scores;
  let traitScores: DNATraitScores | null = null;
  
  if (rawTraitScores && typeof rawTraitScores === 'object') {
    const scores = rawTraitScores as Record<string, unknown>;
    traitScores = {
      planning: normalizeTraitValue(scores.planning),
      social: normalizeTraitValue(scores.social),
      comfort: normalizeTraitValue(scores.comfort),
      pace: normalizeTraitValue(scores.pace),
      budget: normalizeTraitValue(scores.budget),
      adventure: normalizeTraitValue(scores.adventure),
      culture: normalizeTraitValue(scores.culture),
      authenticity: normalizeTraitValue(scores.authenticity),
    };
  }
  
  return {
    traitScores,
    budgetTier: prefsResult.data?.budget_tier || null,
    primaryArchetype: dnaResult.data?.primary_archetype_name || null,
  };
}

/**
 * Normalize a trait value to 0–1 range.
 * Quiz may store values as 0–1, 0–100, or 1–10.
 */
function normalizeTraitValue(value: unknown): number {
  if (typeof value !== 'number' || isNaN(value)) return 0.5;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 100) return value / 100;
  if (value > 100) return Math.min(1, value / 100);
  return 0.5;
}

// ============================================================================
// Match Reason Generation
// ============================================================================

function generateMatchReasons(
  metadata: HotelMetadata,
  traitScores: DNATraitScores,
  dnaMatchScore: number
): string[] {
  const reasons: string[] = [];
  
  // High comfort match
  if (traitScores.comfort >= 0.7 && metadata.comfortScore >= 0.8) {
    reasons.push('Matches your comfort-first travel style');
  }
  
  // High adventure match
  if (traitScores.adventure >= 0.7 && metadata.adventureScore >= 0.7) {
    reasons.push('Perfect for adventurous explorers');
  }
  
  // Price alignment
  if (metadata.priceScore >= 0.9) {
    reasons.push('Great value for your budget');
  } else if (metadata.priceScore >= 0.7) {
    reasons.push('Within your budget range');
  }
  
  // Social match
  if (traitScores.social >= 0.7 && metadata.socialScore >= 0.7) {
    reasons.push('Social atmosphere you\'ll love');
  } else if (traitScores.social <= 0.3 && metadata.socialScore <= 0.3) {
    reasons.push('Private retreat perfect for you');
  }
  
  // Authenticity match
  if (traitScores.authenticity >= 0.7 && metadata.authenticityScore >= 0.8) {
    reasons.push('Authentic local experience');
  }
  
  // Culture match
  if (traitScores.culture >= 0.7 && metadata.cultureScore >= 0.7) {
    reasons.push('Rich cultural surroundings');
  }
  
  // Pace match
  if (traitScores.pace >= 0.7 && metadata.paceScore >= 0.7) {
    reasons.push('Easy access for active exploration');
  } else if (traitScores.pace <= 0.3 && metadata.paceScore <= 0.4) {
    reasons.push('Peaceful escape from the bustle');
  }
  
  // Planning/simplicity match
  if (traitScores.planning <= 0.4 && metadata.simplicityScore >= 0.7) {
    reasons.push('Hassle-free booking and stay');
  }
  
  // Quality baseline
  if (metadata.qualityScore >= 0.85) {
    reasons.push('Highly rated by guests');
  }
  
  // Default reason if none matched
  if (reasons.length === 0) {
    if (dnaMatchScore >= 80) {
      reasons.push('Strong overall match to your travel style');
    } else if (dnaMatchScore >= 60) {
      reasons.push('Good match for your preferences');
    } else {
      reasons.push('Consider for your trip');
    }
  }
  
  // Limit to top 3 reasons
  return reasons.slice(0, 3);
}

// ============================================================================
// Scoring Algorithm
// ============================================================================

function calculateDNAMatchScoreRaw(
  metadata: HotelMetadata,
  traitScores: DNATraitScores
): number {
  const dimensionMappings: Array<{
    hotelScore: number;
    userTrait: number;
    weight: number;
  }> = [
    { hotelScore: metadata.comfortScore, userTrait: traitScores.comfort, weight: 0.20 },
    { hotelScore: metadata.adventureScore, userTrait: traitScores.adventure, weight: 0.12 },
    { hotelScore: metadata.cultureScore, userTrait: traitScores.culture, weight: 0.10 },
    { hotelScore: metadata.socialScore, userTrait: traitScores.social, weight: 0.08 },
    { hotelScore: metadata.priceScore, userTrait: traitScores.budget, weight: 0.20 },
    { hotelScore: metadata.paceScore, userTrait: traitScores.pace, weight: 0.08 },
    { hotelScore: metadata.authenticityScore, userTrait: traitScores.authenticity, weight: 0.13 },
    { hotelScore: metadata.simplicityScore, userTrait: 1 - traitScores.planning, weight: 0.09 },
  ];
  
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const { hotelScore, userTrait, weight } of dimensionMappings) {
    const clampedTrait = Math.max(0, Math.min(1, userTrait));
    const diff = Math.abs(hotelScore - clampedTrait);
    // Quadratic alignment: amplifies mismatches for better differentiation
    const alignment = Math.max(0, 1 - diff * diff);
    totalScore += alignment * weight;
    totalWeight += weight;
  }
  
  let rawScore = (totalScore / totalWeight) * 100;
  
  // Tiered quality bonus
  if (metadata.qualityScore >= 0.85) rawScore += 4;
  else if (metadata.qualityScore >= 0.8) rawScore += 2;
  else if (metadata.qualityScore >= 0.7) rawScore += 1;
  
  return isNaN(rawScore) ? 50 : rawScore;
}

/**
 * Percentile-rescale an array of raw scores to a target display range.
 * Returns a new array of integer display scores.
 */
function rescaleScores(rawScores: number[], minDisplay: number, maxDisplay: number): number[] {
  if (rawScores.length === 0) return [];
  const minRaw = Math.min(...rawScores);
  const maxRaw = Math.max(...rawScores);
  const range = maxRaw - minRaw || 1;
  
  const scaled = rawScores.map(raw =>
    Math.round(minDisplay + ((raw - minRaw) / range) * (maxDisplay - minDisplay))
  );
  
  // Tie-breaking: ensure no two adjacent scores are identical after rounding
  // Sort indices by raw score descending, then spread ties by 2 points
  const indices = rawScores.map((_, i) => i).sort((a, b) => rawScores[b] - rawScores[a]);
  for (let i = 1; i < indices.length; i++) {
    const cur = indices[i];
    const prev = indices[i - 1];
    if (scaled[cur] >= scaled[prev]) {
      scaled[cur] = Math.max(minDisplay, scaled[prev] - 2);
    }
  }
  
  return scaled.map(s => Math.max(minDisplay, Math.min(maxDisplay, s)));
}

// ============================================================================
// Default Trait Scores (for users without DNA)
// ============================================================================

const DEFAULT_TRAIT_SCORES: DNATraitScores = {
  planning: 0.5,
  social: 0.5,
  comfort: 0.5,
  pace: 0.5,
  budget: 0.5,
  adventure: 0.5,
  culture: 0.5,
  authenticity: 0.5,
};

// ============================================================================
// Main Hook
// ============================================================================

export interface RankedHotel extends HotelOption {
  dnaMatchScore: number; // 0-100
  matchReasons: string[];
  metadata: HotelMetadata;
}

export interface DNAHotelRankingResult {
  rankedHotels: RankedHotel[];
  isPersonalized: boolean;
  isLoading: boolean;
  userBudgetTier: string | null;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useTravelDNAHotelRanking(
  hotels: HotelOption[],
  overrideBudgetTier?: string
): DNAHotelRankingResult {
  const { user } = useAuth();
  
  // Fetch user's Travel DNA
  const { data: dnaData, isLoading: isDNALoading } = useQuery({
    queryKey: ['travel-dna-hotel-ranking', user?.id],
    queryFn: () => fetchTravelDNA(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Compute ranked hotels
  const result = useMemo(() => {
    if (hotels.length === 0) {
      return {
        rankedHotels: [],
        isPersonalized: false,
        userBudgetTier: null,
      };
    }
    
    // Determine budget tier
    const budgetTier = overrideBudgetTier || dnaData?.budgetTier || 'moderate';
    const budgetTarget = getBudgetTarget(budgetTier);
    
    // Determine trait scores
    const traitScores: DNATraitScores = dnaData?.traitScores
      ? {
          planning: dnaData.traitScores.planning ?? 0.5,
          social: dnaData.traitScores.social ?? 0.5,
          comfort: dnaData.traitScores.comfort ?? 0.5,
          pace: dnaData.traitScores.pace ?? 0.5,
          budget: dnaData.traitScores.budget ?? 0.5,
          adventure: dnaData.traitScores.adventure ?? 0.5,
          culture: dnaData.traitScores.culture ?? 0.5,
          authenticity: dnaData.traitScores.authenticity ?? 0.5,
        }
      : DEFAULT_TRAIT_SCORES;
    
    // Create mapping context
    const context: MappingContext = {
      userBudgetTarget: budgetTarget,
      userBudgetTier: budgetTier as 'budget' | 'moderate' | 'premium' | 'luxury',
    };
    
    // Map each hotel and compute raw scores
    const hotelData = hotels.map(hotel => {
      const metadata = mapHotelToMetadata(hotel, context);
      const rawScore = calculateDNAMatchScoreRaw(metadata, traitScores);
      return { hotel, metadata, rawScore };
    });
    
    // Percentile rescaling across the full result set (30-95 range)
    const rawScores = hotelData.map(h => h.rawScore);
    const displayScores = rescaleScores(rawScores, 30, 95);
    
    const rankedHotels: RankedHotel[] = hotelData.map(({ hotel, metadata, rawScore }, idx) => {
      const dnaMatchScore = displayScores[idx];
      const matchReasons = generateMatchReasons(metadata, traitScores, dnaMatchScore);
      
      logger.debug(`[DNA Ranking] ${hotel.name}: raw=${rawScore.toFixed(1)} display=${dnaMatchScore}`, {
        comfort: metadata.comfortScore,
        adventure: metadata.adventureScore,
        culture: metadata.cultureScore,
        social: metadata.socialScore,
        price: metadata.priceScore,
        pace: metadata.paceScore,
        authenticity: metadata.authenticityScore,
        simplicity: metadata.simplicityScore,
        quality: metadata.qualityScore,
      });

      return {
        ...hotel,
        dnaMatchScore,
        matchReasons,
        metadata,
      };
    });
    
    // Sort by DNA match score (highest first)
    rankedHotels.sort((a, b) => b.dnaMatchScore - a.dnaMatchScore);
    
    // Mark top 3 as recommended
    rankedHotels.forEach((hotel, index) => {
      hotel.isRecommended = index < 3;
    });
    
    return {
      rankedHotels,
      isPersonalized: !!dnaData?.traitScores,
      userBudgetTier: budgetTier,
    };
  }, [hotels, dnaData, overrideBudgetTier]);
  
  return {
    ...result,
    isLoading: isDNALoading,
  };
}

// ============================================================================
// Utility: Get Budget Target from Tier
// ============================================================================

export { getBudgetTarget };
