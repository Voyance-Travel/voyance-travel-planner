// ============================================================
// Trip Cost Calculator - Dynamic Pricing Engine
// Formula: roundUpTo10((Days × 90 + MultiCityFee) × TierMultiplier) + AddOns
// ============================================================

// ============================================================================
// TYPES
// ============================================================================

export interface TravelDNA {
  dietary?: 'none' | 'vegetarian' | 'vegan' | 'allergy' | 'halal' | 'kosher' | string;
  travelParty?: string[];
  budget?: 'flexible' | 'moderate' | 'strict' | string;
  specialOccasion?: string | null;
  crowdAversion?: 'none' | 'moderate' | 'high' | string;
  accessibility?: boolean;
  detailLevel?: 'standard' | 'extended' | string;
}

export interface TripParams {
  days: number;
  cities: string[];
  mustIncludes?: string[];
  includeHotels?: boolean;
}

export interface ComplexityResult {
  factorCount: number;
  factors: string[];
  tier: 'standard' | 'custom' | 'highly_curated';
  tierLabel: string;
  multiplier: number;
}

export interface TripEstimate {
  days: number;
  cityCount: number;
  baseCredits: number;
  multiCityFee: number;
  subtotal: number;
  complexity: ComplexityResult;
  tripCredits: number;
  hotelCredits: number;
  totalCredits: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const BASE_RATE_PER_DAY = 60;

export const MULTI_CITY_FEES: Record<number, number> = {
  1: 0,
  2: 60,
  3: 120,
};
export const MULTI_CITY_FEE_CAP = 180; // 4+ cities

export const COMPLEXITY_TIERS = {
  standard: { multiplier: 1.00, label: 'Standard', minFactors: 0, maxFactors: 1 },
  custom: { multiplier: 1.15, label: 'Custom', minFactors: 2, maxFactors: 3 },
  highly_curated: { multiplier: 1.30, label: 'Highly Curated', minFactors: 4, maxFactors: Infinity },
} as const;

// Dietary types that count as complexity factors (vegetarian alone does NOT count)
const COMPLEX_DIETARY = ['vegan', 'allergy', 'halal', 'kosher'];

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/** Round up to the nearest multiple of 10 */
export function roundUpTo10(n: number): number {
  return Math.ceil(n / 10) * 10;
}

/** Calculate multi-city fee (capped at 180 for 4+ cities) */
export function calculateMultiCityFee(cityCount: number): number {
  if (cityCount <= 1) return 0;
  if (cityCount === 2) return 60;
  if (cityCount === 3) return 120;
  return MULTI_CITY_FEE_CAP; // 4+
}

/** Calculate complexity tier from Travel DNA and trip params */
export function calculateComplexity(dna: TravelDNA, tripParams?: TripParams): ComplexityResult {
  const factors: string[] = [];

  if (dna.dietary && COMPLEX_DIETARY.includes(dna.dietary)) {
    factors.push(dna.dietary);
  }

  const party = dna.travelParty ?? [];
  if (party.includes('kids')) factors.push('kids');
  if (party.includes('pets')) factors.push('pets');

  if (dna.budget === 'strict') factors.push('strict_budget');
  if (dna.crowdAversion === 'high') factors.push('crowd_aversion');
  if (dna.specialOccasion) factors.push(dna.specialOccasion);

  if (tripParams?.mustIncludes && tripParams.mustIncludes.length >= 2) {
    factors.push('must_includes');
  }
  if (dna.detailLevel === 'extended') factors.push('extended_detail');

  const factorCount = factors.length;

  if (factorCount >= 4) {
    return { factorCount, factors, tier: 'highly_curated', tierLabel: 'Highly Curated', multiplier: 1.30 };
  }
  if (factorCount >= 2) {
    return { factorCount, factors, tier: 'custom', tierLabel: 'Custom', multiplier: 1.15 };
  }
  return { factorCount, factors, tier: 'standard', tierLabel: 'Standard', multiplier: 1.00 };
}

/** Calculate full trip credit cost */
export function calculateTripCredits(tripParams: TripParams, dna?: TravelDNA): TripEstimate {
  const { days, cities, includeHotels = false } = tripParams;
  const cityCount = cities.length;
  const baseCredits = days * BASE_RATE_PER_DAY;
  const multiCityFee = calculateMultiCityFee(cityCount);
  const subtotal = baseCredits + multiCityFee;

  const complexity = dna
    ? calculateComplexity(dna, tripParams)
    : { factorCount: 0, factors: [], tier: 'standard' as const, tierLabel: 'Standard', multiplier: 1.00 };

  const tripCreditsRaw = subtotal * complexity.multiplier;
  const tripCredits = roundUpTo10(tripCreditsRaw);

  const hotelCredits = includeHotels ? cityCount * 40 : 0;

  return {
    days,
    cityCount,
    baseCredits,
    multiCityFee,
    subtotal,
    complexity,
    tripCredits,
    hotelCredits,
    totalCredits: tripCredits + hotelCredits,
  };
}

// ============================================================================
// PACK RECOMMENDATION
// ============================================================================

import { FLEXIBLE_CREDITS, VOYANCE_CLUB_PACKS, BOOST_PACK } from '@/config/pricing';

/** Recommend the smallest pack that covers the shortfall, preferring Club value */
export function getRecommendedPackForEstimate(creditsNeeded: number, currentBalance: number) {
  const shortfall = Math.max(0, creditsNeeded - currentBalance);
  if (shortfall === 0) return null;

  // Check flex credits first (smallest)
  for (const pack of FLEXIBLE_CREDITS) {
    if (pack.credits >= shortfall) {
      return { ...pack, coversTrip: true, leftover: pack.credits - shortfall + currentBalance };
    }
  }

  // Check club packs (better value)
  for (const pack of VOYANCE_CLUB_PACKS) {
    if (pack.totalCredits >= shortfall) {
      return { ...pack, credits: pack.totalCredits, coversTrip: true, leftover: pack.totalCredits - shortfall + currentBalance };
    }
  }

  // Return largest pack even if insufficient
  const largest = VOYANCE_CLUB_PACKS[VOYANCE_CLUB_PACKS.length - 1];
  return { ...largest, credits: largest.totalCredits, coversTrip: largest.totalCredits >= shortfall, leftover: largest.totalCredits - shortfall + currentBalance };
}

// ============================================================================
// EXAMPLE COSTS (for pricing page)
// ============================================================================

export const EXAMPLE_TRIP_COSTS = [
  { label: 'Paris, 3 days', credits: 180 },
  { label: 'Barcelona, 4 days, anniversary + vegan', credits: 280 },
  { label: 'Tokyo, 5 days, vegetarian', credits: 300 },
  { label: 'Tokyo → Kyoto, 7 days', credits: 480 },
  { label: 'Japan, 3 cities, 10 days, honeymoon', credits: 900 },
] as const;
