/**
 * Hook for real-time trip cost estimation
 * Uses the shared tripCostCalculator for consistent pricing
 */

import { useMemo } from 'react';
import { useCredits } from './useCredits';
import {
  calculateTripCredits,
  getRecommendedPackForEstimate,
  type TravelDNA,
  type TripParams,
  type TripEstimate,
} from '@/lib/tripCostCalculator';

interface UseTripEstimateParams {
  days: number;
  cities: string[];
  dna?: TravelDNA;
  mustIncludes?: string[];
  includeHotels?: boolean;
}

interface TripEstimateResult {
  estimate: TripEstimate;
  canAfford: boolean;
  creditsNeeded: number;
  currentBalance: number;
  recommendedPack: ReturnType<typeof getRecommendedPackForEstimate>;
  isLoading: boolean;
}

export function useTripEstimate(params: UseTripEstimateParams): TripEstimateResult {
  const { data: creditData, isLoading } = useCredits();

  return useMemo(() => {
    const tripParams: TripParams = {
      days: params.days,
      cities: params.cities,
      mustIncludes: params.mustIncludes,
      includeHotels: params.includeHotels,
    };

    const estimate = calculateTripCredits(tripParams, params.dna);
    const currentBalance = creditData?.totalCredits ?? 0;
    const canAfford = currentBalance >= estimate.totalCredits;
    const creditsNeeded = Math.max(0, estimate.totalCredits - currentBalance);
    const recommendedPack = canAfford
      ? null
      : getRecommendedPackForEstimate(estimate.totalCredits, currentBalance);

    return {
      estimate,
      canAfford,
      creditsNeeded,
      currentBalance,
      recommendedPack,
      isLoading,
    };
  }, [params.days, params.cities, params.mustIncludes, params.includeHotels, params.dna, creditData, isLoading]);
}

export default useTripEstimate;
