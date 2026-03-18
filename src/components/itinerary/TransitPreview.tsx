/**
 * TransitPreview — Shows transit estimates from/to surrounding activities
 * when adding or editing an activity. Includes schedule conflict warnings.
 */

import { useEffect, useMemo } from 'react';
import { Footprints, Train, Car, Bus, AlertTriangle, ArrowDown, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTransitEstimate, getRecommendedTransit, checkScheduleConflict, type TransitEstimate } from '@/hooks/useTransitEstimate';
import { computeGapMinutes } from './TransitGapIndicator';

interface ActivityLocation {
  lat?: number;
  lng?: number;
  address?: string;
  name?: string;
}

interface SurroundingActivity {
  title: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  location?: ActivityLocation;
}

interface TransitPreviewProps {
  /** The location being added/edited */
  newLocation?: ActivityLocation;
  /** Start time of the new activity */
  newStartTime?: string;
  /** End time of the new activity */
  newEndTime?: string;
  /** Activity before the insertion point */
  prevActivity?: SurroundingActivity | null;
  /** Activity after the insertion point */
  nextActivity?: SurroundingActivity | null;
  className?: string;
}

const transportIcons: Record<string, React.ReactNode> = {
  walking: <Footprints className="h-3.5 w-3.5" />,
  transit: <Train className="h-3.5 w-3.5" />,
  bus: <Bus className="h-3.5 w-3.5" />,
  taxi: <Car className="h-3.5 w-3.5" />,
  metro: <Train className="h-3.5 w-3.5" />,
};

function EstimateRow({ estimate, label, conflict }: { 
  estimate: TransitEstimate; 
  label: string;
  conflict?: { hasConflict: boolean; message: string };
}) {
  const icon = transportIcons[estimate.method] || <MapPin className="h-3.5 w-3.5" />;
  
  return (
    <div className="space-y-1">
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
        estimate.recommended 
          ? "bg-primary/10 border border-primary/20 text-primary" 
          : "bg-secondary/50 border border-border/30 text-muted-foreground"
      )}>
        {icon}
        <span className="font-medium capitalize">{estimate.method}</span>
        <span className="text-muted-foreground/70">•</span>
        <span>{estimate.duration}</span>
        {estimate.distance && (
          <>
            <span className="text-muted-foreground/70">•</span>
            <span>{estimate.distance}</span>
          </>
        )}
        {estimate.estimatedCost?.amount ? (
          <>
            <span className="text-muted-foreground/70">•</span>
            <span className="font-medium">~${estimate.estimatedCost.amount}</span>
          </>
        ) : null}
        {estimate.recommended && (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider">Best</span>
        )}
      </div>
      {conflict?.hasConflict && (
        <div className="flex items-start gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{conflict.message}</span>
        </div>
      )}
    </div>
  );
}

function TransitSection({ 
  direction, 
  activityTitle, 
  estimates, 
  isLoading,
  gapMinutes,
}: { 
  direction: 'from' | 'to'; 
  activityTitle: string;
  estimates: TransitEstimate[];
  isLoading: boolean;
  gapMinutes: number | null;
}) {
  const recommended = getRecommendedTransit(estimates);
  const conflict = recommended && gapMinutes !== null
    ? checkScheduleConflict(recommended.durationMinutes, gapMinutes)
    : gapMinutes !== null && gapMinutes < 0
      ? { hasConflict: true, message: `These activities overlap by ${Math.abs(gapMinutes)} minutes. Consider adjusting the timing.` }
      : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowDown className={cn("h-3 w-3", direction === 'from' && "rotate-180")} />
        <span className="font-medium">
          {direction === 'from' ? `From "${activityTitle}"` : `To "${activityTitle}"`}
        </span>
        {gapMinutes !== null && (
          <span className="text-muted-foreground/60">
            {gapMinutes < 0 ? '(times overlap)' : `(${gapMinutes} min gap)`}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Calculating transit...
        </div>
      ) : estimates.length > 0 ? (
        <div className="space-y-1.5">
          {estimates.map((est, i) => (
            <EstimateRow 
              key={`${est.method}-${i}`} 
              estimate={est} 
              label={direction} 
              conflict={est === recommended ? conflict : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TransitPreview({
  newLocation,
  newStartTime,
  newEndTime,
  prevActivity,
  nextActivity,
  className,
}: TransitPreviewProps) {
  const fromPrev = useTransitEstimate();
  const toNext = useTransitEstimate();

  const hasNewLocation = !!(newLocation?.lat || newLocation?.address || newLocation?.name);

  // Fetch transit from previous activity
  useEffect(() => {
    if (!hasNewLocation || !prevActivity?.location) {
      fromPrev.clear();
      return;
    }
    const prevLoc = prevActivity.location;
    if (!prevLoc.lat && !prevLoc.address && !prevLoc.name) {
      fromPrev.clear();
      return;
    }
    fromPrev.fetchEstimate(prevLoc, newLocation!);
  }, [
    hasNewLocation, 
    prevActivity?.location?.lat, 
    prevActivity?.location?.lng,
    prevActivity?.location?.address,
    newLocation?.lat, 
    newLocation?.lng,
    newLocation?.address,
  ]);

  // Fetch transit to next activity
  useEffect(() => {
    if (!hasNewLocation || !nextActivity?.location) {
      toNext.clear();
      return;
    }
    const nextLoc = nextActivity.location;
    if (!nextLoc.lat && !nextLoc.address && !nextLoc.name) {
      toNext.clear();
      return;
    }
    toNext.fetchEstimate(newLocation!, nextLoc);
  }, [
    hasNewLocation,
    nextActivity?.location?.lat,
    nextActivity?.location?.lng,
    nextActivity?.location?.address,
    newLocation?.lat,
    newLocation?.lng,
    newLocation?.address,
  ]);

  // Compute gaps
  const gapFromPrev = useMemo(() => {
    if (!prevActivity || !newStartTime) return null;
    return computeGapMinutes(prevActivity.endTime, prevActivity.startTime, prevActivity.duration, newStartTime);
  }, [prevActivity?.endTime, prevActivity?.startTime, prevActivity?.duration, newStartTime]);

  const gapToNext = useMemo(() => {
    if (!nextActivity?.startTime || !newEndTime) return null;
    return computeGapMinutes(newEndTime, undefined, undefined, nextActivity.startTime);
  }, [nextActivity?.startTime, newEndTime]);

  const showFromPrev = prevActivity && (fromPrev.isLoading || fromPrev.estimates.length > 0);
  const showToNext = nextActivity && (toNext.isLoading || toNext.estimates.length > 0);

  if (!hasNewLocation || (!showFromPrev && !showToNext)) return null;

  return (
    <div className={cn("space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50", className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        Transit Context
      </div>

      {showFromPrev && (
        <TransitSection
          direction="from"
          activityTitle={prevActivity!.title || 'Previous activity'}
          estimates={fromPrev.estimates}
          isLoading={fromPrev.isLoading}
          gapMinutes={gapFromPrev}
        />
      )}

      {showToNext && (
        <TransitSection
          direction="to"
          activityTitle={nextActivity!.title || 'Next activity'}
          estimates={toNext.estimates}
          isLoading={toNext.isLoading}
          gapMinutes={gapToNext}
        />
      )}
    </div>
  );
}

export default TransitPreview;
