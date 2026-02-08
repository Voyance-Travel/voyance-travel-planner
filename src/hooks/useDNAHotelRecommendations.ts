/**
 * useDNAHotelRecommendations
 * 
 * Chains: AI profiling → hotel search → DNA ranking
 * to produce personalized hotel recommendations for a destination.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { searchHotels, type HotelOption } from '@/services/hotelAPI';
import {
  mapHotelToMetadata,
  getBudgetTarget,
  type MappingContext,
} from '@/utils/hotelMetadataMapper';

// ============================================================================
// Types
// ============================================================================

export interface IdealHotelProfile {
  idealTypes: string[];
  idealNeighborhoods: string[];
  idealAmenities: string[];
  priceRange: { min: number; max: number };
  styleDescription: string;
  avoidTypes: string[];
  searchKeywords: string[];
}

export interface DNARecommendedHotel extends HotelOption {
  dnaMatchScore: number;
  matchReasons: string[];
  isTopPick: boolean;
}

export interface DNAHotelRecommendationResult {
  profile: IdealHotelProfile | null;
  recommendations: DNARecommendedHotel[];
  topPick: DNARecommendedHotel | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  isHotelsLoading: boolean;
  error: string | null;
}

// ============================================================================
// DNA Trait Fetching (reused from ranking hook)
// ============================================================================

interface DNATraits {
  planning: number; social: number; comfort: number; pace: number;
  budget: number; adventure: number; culture: number; authenticity: number;
}

async function fetchUserDNA(userId: string) {
  const [dnaResult, prefsResult] = await Promise.all([
    supabase.from('travel_dna_profiles').select('trait_scores, primary_archetype_name').eq('user_id', userId).maybeSingle(),
    supabase.from('user_preferences').select('budget_tier').eq('user_id', userId).maybeSingle(),
  ]);

  const rawTraits = dnaResult.data?.trait_scores as Record<string, unknown> | null;
  const traitScores: DNATraits | null = rawTraits ? {
    planning: typeof rawTraits.planning === 'number' ? rawTraits.planning : 0.5,
    social: typeof rawTraits.social === 'number' ? rawTraits.social : 0.5,
    comfort: typeof rawTraits.comfort === 'number' ? rawTraits.comfort : 0.5,
    pace: typeof rawTraits.pace === 'number' ? rawTraits.pace : 0.5,
    budget: typeof rawTraits.budget === 'number' ? rawTraits.budget : 0.5,
    adventure: typeof rawTraits.adventure === 'number' ? rawTraits.adventure : 0.5,
    culture: typeof rawTraits.culture === 'number' ? rawTraits.culture : 0.5,
    authenticity: typeof rawTraits.authenticity === 'number' ? rawTraits.authenticity : 0.5,
  } : null;

  return {
    traitScores,
    budgetTier: prefsResult.data?.budget_tier || 'moderate',
    primaryArchetype: dnaResult.data?.primary_archetype_name || null,
  };
}

// ============================================================================
// AI Profile Fetching
// ============================================================================

async function fetchIdealProfile(
  userId: string | null,
  destination: string,
  traitScores: DNATraits | null,
  budgetTier: string,
  primaryArchetype: string | null,
  tripType?: string,
): Promise<IdealHotelProfile> {
  const { data, error } = await supabase.functions.invoke('profile-ideal-hotel', {
    body: {
      userId,
      destination,
      traitScores,
      budgetTier,
      primaryArchetype,
      tripType,
    },
  });

  if (error || !data?.success) {
    throw new Error(data?.error || 'Failed to generate hotel profile');
  }

  return data.profile;
}

// ============================================================================
// Scoring (lightweight version of the ranking hook)
// ============================================================================

function scoreAndRankHotels(
  hotels: HotelOption[],
  traitScores: DNATraits,
  budgetTier: string,
  profile: IdealHotelProfile,
): DNARecommendedHotel[] {
  const budgetTarget = getBudgetTarget(budgetTier);
  const context: MappingContext = {
    userBudgetTarget: budgetTarget,
    userBudgetTier: budgetTier as 'budget' | 'moderate' | 'premium' | 'luxury',
  };

  const scored: DNARecommendedHotel[] = hotels.map(hotel => {
    const metadata = mapHotelToMetadata(hotel, context);

    // Weighted DNA alignment score
    const dimensions = [
      { hotelScore: metadata.comfortScore, userTrait: traitScores.comfort, weight: 0.15 },
      { hotelScore: metadata.adventureScore, userTrait: traitScores.adventure, weight: 0.12 },
      { hotelScore: metadata.cultureScore, userTrait: traitScores.culture, weight: 0.10 },
      { hotelScore: metadata.socialScore, userTrait: traitScores.social, weight: 0.12 },
      { hotelScore: metadata.priceScore, userTrait: 1.0, weight: 0.18 },
      { hotelScore: metadata.paceScore, userTrait: traitScores.pace, weight: 0.10 },
      { hotelScore: metadata.authenticityScore, userTrait: traitScores.authenticity, weight: 0.13 },
      { hotelScore: metadata.simplicityScore, userTrait: 1 - traitScores.planning, weight: 0.10 },
    ];

    let totalScore = 0;
    let totalWeight = 0;
    for (const { hotelScore, userTrait, weight } of dimensions) {
      const alignment = 1 - Math.abs(hotelScore - userTrait);
      totalScore += alignment * (0.5 + userTrait * 0.5) * weight;
      totalWeight += weight;
    }

    let rawScore = (totalScore / totalWeight) * 100;

    // Quality bonus
    if (metadata.qualityScore >= 0.8) rawScore += 5;
    else if (metadata.qualityScore >= 0.7) rawScore += 2;

    // Neighborhood bonus from AI profile
    const lowerNeighborhood = (hotel.neighborhood || '').toLowerCase();
    if (profile.idealNeighborhoods.some(n => lowerNeighborhood.includes(n.toLowerCase()))) {
      rawScore += 8;
    }

    const dnaMatchScore = Math.min(100, Math.round(rawScore));

    // Generate match reasons
    const matchReasons: string[] = [];
    if (profile.idealNeighborhoods.some(n => lowerNeighborhood.includes(n.toLowerCase()))) {
      matchReasons.push(`In ${hotel.neighborhood} - one of your ideal neighborhoods`);
    }
    if (metadata.priceScore >= 0.9) matchReasons.push('Great value for your budget');
    if (traitScores.comfort >= 0.7 && metadata.comfortScore >= 0.8) matchReasons.push('Matches your comfort-first style');
    if (traitScores.culture >= 0.7 && metadata.cultureScore >= 0.7) matchReasons.push('Rich cultural surroundings');
    if (traitScores.authenticity >= 0.7 && metadata.authenticityScore >= 0.8) matchReasons.push('Authentic local character');
    if (traitScores.social >= 0.7 && metadata.socialScore >= 0.7) matchReasons.push('Social atmosphere you\'ll love');
    if (matchReasons.length === 0) matchReasons.push('Good overall match');

    return {
      ...hotel,
      dnaMatchScore,
      matchReasons: matchReasons.slice(0, 3),
      isTopPick: false,
    };
  });

  scored.sort((a, b) => b.dnaMatchScore - a.dnaMatchScore);

  // Mark top pick
  if (scored.length > 0) {
    scored[0].isTopPick = true;
  }

  return scored;
}

// ============================================================================
// Main Hook
// ============================================================================

interface UseDNAHotelRecommendationsParams {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  tripType?: string;
  enabled?: boolean;
}

export function useDNAHotelRecommendations({
  destination,
  checkIn,
  checkOut,
  guests = 2,
  tripType,
  enabled = true,
}: UseDNAHotelRecommendationsParams): DNAHotelRecommendationResult {
  const { user } = useAuth();

  // Step 1: Fetch user's DNA traits
  const { data: dnaData, isLoading: isDNALoading } = useQuery({
    queryKey: ['user-dna-for-hotels', user?.id],
    queryFn: () => fetchUserDNA(user!.id),
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
  });

  // Step 2: Get AI-generated ideal hotel profile
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useQuery({
    queryKey: ['ideal-hotel-profile', user?.id, destination, dnaData?.budgetTier],
    queryFn: () => fetchIdealProfile(
      user?.id || null,
      destination,
      dnaData?.traitScores || null,
      dnaData?.budgetTier || 'moderate',
      dnaData?.primaryArchetype || null,
      tripType,
    ),
    enabled: !!destination && enabled && !isDNALoading,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Step 3: Search for real hotels
  const effectiveCheckIn = checkIn || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const effectiveCheckOut = checkOut || new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: hotels, isLoading: isHotelsLoading } = useQuery({
    queryKey: ['dna-hotel-search', destination, effectiveCheckIn, effectiveCheckOut, guests],
    queryFn: () => searchHotels({
      destination,
      checkIn: effectiveCheckIn,
      checkOut: effectiveCheckOut,
      guests,
      budgetTier: (dnaData?.budgetTier as any) || 'moderate',
    }),
    enabled: !!destination && !!profile && enabled,
    staleTime: 10 * 60 * 1000,
  });

  // Step 4: Score and rank
  const defaultTraits: DNATraits = {
    planning: 0.5, social: 0.5, comfort: 0.5, pace: 0.5,
    budget: 0.5, adventure: 0.5, culture: 0.5, authenticity: 0.5,
  };

  const recommendations = (hotels && profile)
    ? scoreAndRankHotels(
        hotels,
        dnaData?.traitScores || defaultTraits,
        dnaData?.budgetTier || 'moderate',
        profile,
      )
    : [];

  return {
    profile: profile || null,
    recommendations,
    topPick: recommendations.find(h => h.isTopPick) || null,
    isLoading: isDNALoading || isProfileLoading || isHotelsLoading,
    isProfileLoading: isDNALoading || isProfileLoading,
    isHotelsLoading,
    error: profileError ? (profileError as Error).message : null,
  };
}
