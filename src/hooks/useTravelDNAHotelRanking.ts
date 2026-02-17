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
  
  // Parse trait scores from JSON
  const rawTraitScores = dnaResult.data?.trait_scores;
  let traitScores: DNATraitScores | null = null;
  
  if (rawTraitScores && typeof rawTraitScores === 'object') {
    const scores = rawTraitScores as Record<string, unknown>;
    traitScores = {
      planning: typeof scores.planning === 'number' ? scores.planning : 0.5,
      social: typeof scores.social === 'number' ? scores.social : 0.5,
      comfort: typeof scores.comfort === 'number' ? scores.comfort : 0.5,
      pace: typeof scores.pace === 'number' ? scores.pace : 0.5,
      budget: typeof scores.budget === 'number' ? scores.budget : 0.5,
      adventure: typeof scores.adventure === 'number' ? scores.adventure : 0.5,
      culture: typeof scores.culture === 'number' ? scores.culture : 0.5,
      authenticity: typeof scores.authenticity === 'number' ? scores.authenticity : 0.5,
    };
  }
  
  return {
    traitScores,
    budgetTier: prefsResult.data?.budget_tier || null,
    primaryArchetype: dnaResult.data?.primary_archetype_name || null,
  };
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

function calculateDNAMatchScore(
  metadata: HotelMetadata,
  traitScores: DNATraitScores
): number {
  // Map DNA traits to hotel metadata dimensions with weights
  // The weights determine how much each dimension contributes to the match
  const dimensionMappings: Array<{
    hotelScore: number;
    userTrait: number;
    weight: number;
  }> = [
    { hotelScore: metadata.comfortScore, userTrait: traitScores.comfort, weight: 0.15 },
    { hotelScore: metadata.adventureScore, userTrait: traitScores.adventure, weight: 0.12 },
    { hotelScore: metadata.cultureScore, userTrait: traitScores.culture, weight: 0.10 },
    { hotelScore: metadata.socialScore, userTrait: traitScores.social, weight: 0.12 },
    { hotelScore: metadata.priceScore, userTrait: 1.0, weight: 0.18 }, // Price always matters
    { hotelScore: metadata.paceScore, userTrait: traitScores.pace, weight: 0.10 },
    { hotelScore: metadata.authenticityScore, userTrait: traitScores.authenticity, weight: 0.13 },
    { hotelScore: metadata.simplicityScore, userTrait: 1 - traitScores.planning, weight: 0.10 }, // Low planning = needs simplicity
  ];
  
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const { hotelScore, userTrait, weight } of dimensionMappings) {
    // Calculate alignment: how well does the hotel match what the user wants?
    // If user has high trait (wants it) and hotel has it → high score
    // If user has low trait (doesn't care) → hotel score matters less
    const alignment = 1 - Math.abs(hotelScore - userTrait);
    const prioritizedAlignment = alignment * (0.5 + userTrait * 0.5); // Boost if user cares about this trait
    
    totalScore += prioritizedAlignment * weight;
    totalWeight += weight;
  }
  
  // Normalize to 0-100
  const rawScore = (totalScore / totalWeight) * 100;
  
  // Apply quality filter bonus (good hotels get a slight boost)
  const qualityBonus = metadata.qualityScore >= 0.8 ? 5 : metadata.qualityScore >= 0.7 ? 2 : 0;
  
  return Math.max(10, Math.min(100, Math.round(rawScore + qualityBonus)));
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
    
    // Map and score each hotel
    const rankedHotels: RankedHotel[] = hotels.map(hotel => {
      const metadata = mapHotelToMetadata(hotel, context);
      const dnaMatchScore = calculateDNAMatchScore(metadata, traitScores);
      const matchReasons = generateMatchReasons(metadata, traitScores, dnaMatchScore);
      
      logger.debug(`[DNA Ranking] ${hotel.name}: score=${dnaMatchScore}`, {
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
