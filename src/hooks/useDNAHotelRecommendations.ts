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

async function fetchUserDNA(userId: string) {
  const [dnaResult, prefsResult] = await Promise.all([
    supabase.from('travel_dna_profiles').select('trait_scores, primary_archetype_name').eq('user_id', userId).maybeSingle(),
    supabase.from('user_preferences').select('budget_tier').eq('user_id', userId).maybeSingle(),
  ]);

  const rawTraits = dnaResult.data?.trait_scores as Record<string, unknown> | null;
  const traitScores: DNATraits | null = rawTraits ? {
    planning: normalizeTraitValue(rawTraits.planning),
    social: normalizeTraitValue(rawTraits.social),
    comfort: normalizeTraitValue(rawTraits.comfort),
    pace: normalizeTraitValue(rawTraits.pace),
    budget: normalizeTraitValue(rawTraits.budget),
    adventure: normalizeTraitValue(rawTraits.adventure),
    culture: normalizeTraitValue(rawTraits.culture),
    authenticity: normalizeTraitValue(rawTraits.authenticity),
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

  // First pass: compute raw scores
  const scoredWithRaw: Array<{ hotel: HotelOption; rawScore: number; matchReasons: string[]; metadata: ReturnType<typeof mapHotelToMetadata> }> = hotels.map(hotel => {
    const metadata = mapHotelToMetadata(hotel, context);

    // Weighted DNA alignment score — quadratic distance for better differentiation
    const dimensions = [
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
    for (const { hotelScore, userTrait, weight } of dimensions) {
      const clampedTrait = Math.max(0, Math.min(1, userTrait));
      const diff = Math.abs(hotelScore - clampedTrait);
      const alignment = Math.max(0, 1 - diff * diff); // Quadratic penalty
      totalScore += alignment * weight;
      totalWeight += weight;
    }

    let rawScore = (totalScore / totalWeight) * 100;

    // Quality bonus (capped)
    if (metadata.qualityScore >= 0.8) rawScore += 2;
    else if (metadata.qualityScore >= 0.7) rawScore += 1;

    // Neighborhood bonus from AI profile (capped)
    const lowerNeighborhood = (hotel.neighborhood || '').toLowerCase();
    if (profile.idealNeighborhoods.some(n => lowerNeighborhood.includes(n.toLowerCase()))) {
      rawScore += 5;
    }

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

    return { hotel, rawScore: isNaN(rawScore) ? 50 : rawScore, matchReasons: matchReasons.slice(0, 3), metadata };
  });

  // Second pass: percentile-based rescaling to spread scores across 35-96
  const rawScores = scoredWithRaw.map(h => h.rawScore);
  const minRaw = Math.min(...rawScores);
  const maxRaw = Math.max(...rawScores);
  const range = maxRaw - minRaw || 1;

  // Compute scaled scores
  const scaledScores = scoredWithRaw.map(({ rawScore }) =>
    Math.round(35 + ((rawScore - minRaw) / range) * 61)
  );

  // Sort indices by raw score descending for tie-breaking
  const sortedIndices = rawScores.map((_, i) => i).sort((a, b) => rawScores[b] - rawScores[a]);
  for (let i = 1; i < sortedIndices.length; i++) {
    const cur = sortedIndices[i];
    const prev = sortedIndices[i - 1];
    if (scaledScores[cur] >= scaledScores[prev]) {
      scaledScores[cur] = Math.max(15, scaledScores[prev] - 3);
    }
  }

  const scored: DNARecommendedHotel[] = scoredWithRaw.map(({ hotel, matchReasons }, idx) => ({
    ...hotel,
    dnaMatchScore: Math.max(15, Math.min(96, scaledScores[idx])),
    matchReasons,
    isTopPick: false,
  }));

  scored.sort((a, b) => b.dnaMatchScore - a.dnaMatchScore);

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
    staleTime: 30 * 60 * 1000,
    gcTime: 35 * 60 * 1000,
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
    gcTime: 15 * 60 * 1000,
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
