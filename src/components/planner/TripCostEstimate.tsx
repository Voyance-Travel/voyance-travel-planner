/**
 * TripCostEstimate - Shows estimated credit cost before trip creation.
 * Displays as a subtle info card below the date picker area.
 * Now uses calculateTripCredits for accurate multi-city fees.
 */

import { Coins, Sparkles, Info } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { useEntitlements, type EntitlementsResponse } from '@/hooks/useEntitlements';
import { calculateTripCredits, BASE_RATE_PER_DAY } from '@/lib/tripCostCalculator';
import { cn } from '@/lib/utils';

interface TripCostEstimateProps {
  tripDays: number;
  cities?: string[];
  className?: string;
}

export function TripCostEstimate({ tripDays, cities = ['single'], className }: TripCostEstimateProps) {
  const { data: creditData, isLoading: creditsLoading } = useCredits();
  const { data: entitlementsData, isLoading: entitlementsLoading } = useEntitlements();

  if (creditsLoading || entitlementsLoading || tripDays < 1) return null;

  const totalCredits = creditData?.totalCredits ?? 0;
  const isFirstTrip = (entitlementsData as EntitlementsResponse | undefined)?.is_first_trip ?? false;

  const freeDays = isFirstTrip ? 2 : 0;
  const paidDays = Math.max(0, tripDays - freeDays);
  const estimate = calculateTripCredits({ days: paidDays, cities });
  const estimatedCost = estimate.totalCredits;
  const shortfall = Math.max(0, estimatedCost - totalCredits);

  if (isFirstTrip) {
    return (
      <div className={cn(
        'rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1',
        className
      )}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm font-medium text-foreground">
            Your first trip is free!
          </p>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          No credits charged for generation. Days 1–2 are fully unlocked.{' '}
          {tripDays > 2
            ? `Days 3–${tripDays} can be unlocked later with credits (${BASE_RATE_PER_DAY} credits/day).`
            : ''}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg border border-border bg-muted/30 p-3 space-y-1.5',
      className
    )}>
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm text-foreground">
          This {tripDays}-day trip will use approximately{' '}
          <span className="font-semibold">{estimatedCost} credits</span>
          {estimate.multiCityFee > 0 && (
            <span className="text-muted-foreground text-xs ml-1">(incl. multi-city fee)</span>
          )}
        </p>
      </div>
      <p className="text-xs text-muted-foreground pl-6">
        You have {totalCredits} credits available
      </p>
      {shortfall > 0 && (
        <div className="flex items-start gap-2 pl-6">
          <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You'll need ~{shortfall} more credits to unlock all days.
            You can still create the trip and unlock days later.
          </p>
        </div>
      )}
    </div>
  );
}
