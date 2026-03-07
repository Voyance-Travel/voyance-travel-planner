/**
 * TransitGapIndicator — Always-visible compact indicator between activities
 * showing the time gap and estimated travel mode.
 * Complements TransitBadge (which requires optimization data and "Show Routes" toggle).
 */

import { Footprints, AlertTriangle, Clock, Train, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransitGapIndicatorProps {
  /** Minutes between end of previous activity and start of next */
  gapMinutes: number;
  /** Transport data from the previous activity (if available from optimization) */
  transportation?: {
    method: string;
    duration: string;
  } | null;
  /** Whether full TransitBadge is already visible (avoid duplication) */
  hasTransitBadge?: boolean;
  /** Category/type of the current (previous) activity */
  currentCategory?: string;
  /** Category/type of the next activity */
  nextCategory?: string;
  /** Whether the two activities share the same location */
  sameLocation?: boolean;
}

function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const n = timeStr.trim().toUpperCase();
  const m = n.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Compute gap in minutes between two activities by their time strings */
export function computeGapMinutes(
  prevEndTime?: string,
  prevStartTime?: string,
  prevDuration?: string,
  nextStartTime?: string,
): number | null {
  const nextStart = parseTimeToMinutes(nextStartTime);
  if (nextStart === null) return null;

  // Prefer endTime if available
  let prevEnd = parseTimeToMinutes(prevEndTime);
  
  // Fall back to startTime + duration
  if (prevEnd === null) {
    const prevStart = parseTimeToMinutes(prevStartTime);
    if (prevStart === null) return null;
    
    // Parse duration like "2 hours", "1.5 hours", "90 minutes", "1h 30m"
    let durationMin = 60; // default 1 hour
    if (prevDuration) {
      const d = prevDuration.toLowerCase();
      const hoursMatch = d.match(/([\d.]+)\s*(?:hours?|hrs?|h)/);
      const minsMatch = d.match(/([\d.]+)\s*(?:minutes?|mins?|m(?!onth))/);
      durationMin = 0;
      if (hoursMatch) durationMin += parseFloat(hoursMatch[1]) * 60;
      if (minsMatch) durationMin += parseFloat(minsMatch[1]);
      if (durationMin === 0) durationMin = 60;
    }
    
    prevEnd = prevStart + durationMin;
  }

  return nextStart - prevEnd;
}

function getTransportIcon(method?: string) {
  if (!method) return <Footprints className="h-2.5 w-2.5" />;
  const m = method.toLowerCase();
  if (m.includes('metro') || m.includes('train') || m.includes('subway')) return <Train className="h-2.5 w-2.5" />;
  if (m.includes('taxi') || m.includes('uber') || m.includes('car') || m.includes('driv')) return <Car className="h-2.5 w-2.5" />;
  return <Footprints className="h-2.5 w-2.5" />;
}

const TRANSIT_CATEGORIES = ['transit', 'transportation', 'transfer', 'taxi', 'transport', 'commute', 'travel'];

function isTransitCategory(cat?: string): boolean {
  if (!cat) return false;
  const lower = cat.toLowerCase();
  return TRANSIT_CATEGORIES.some(t => lower.includes(t));
}

export function TransitGapIndicator({ gapMinutes, transportation, hasTransitBadge, currentCategory, nextCategory, sameLocation }: TransitGapIndicatorProps) {
  // Don't show if TransitBadge is already visible with full details
  if (hasTransitBadge) return null;

  // Transit/transportation slots ARE the buffer — don't warn about them
  const eitherIsTransit = isTransitCategory(currentCategory) || isTransitCategory(nextCategory);

  // Hide the gap indicator entirely when adjacent to a transport activity
  // — the compact transport row already conveys travel time
  if (eitherIsTransit) return null;

  // Same-location activities don't need transit buffer
  const skipBufferWarning = sameLocation;

  const isZeroGap = !skipBufferWarning && gapMinutes <= 0;
  const isTightGap = !skipBufferWarning && gapMinutes > 0 && gapMinutes < 15;
  const isComfortable = gapMinutes >= 15 || skipBufferWarning;

  const icon = transportation ? getTransportIcon(transportation.method) : <Clock className="h-2.5 w-2.5" />;
  // Use real transport duration when available, fall back to computed gap
  const label = transportation?.duration || `~${Math.abs(gapMinutes)} min`;

  return (
    <div className="flex items-center gap-2 py-1 pl-4">
      {/* Dotted connector line */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-px h-2 border-l border-dashed border-border" />
        <div className="w-px h-2 border-l border-dashed border-border" />
      </div>

      <div className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
        isZeroGap && "bg-destructive/10 text-destructive border border-destructive/20",
        isTightGap && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20",
        isComfortable && "bg-secondary/50 text-muted-foreground border border-border/30",
      )}>
        {isZeroGap ? (
          <AlertTriangle className="h-2.5 w-2.5" />
        ) : (
          icon
        )}
        <span>
          {isZeroGap 
            ? 'No buffer' 
            : isTightGap 
              ? `${gapMinutes} min (tight)` 
              : label
          }
        </span>
      </div>
    </div>
  );
}

export default TransitGapIndicator;
