// Extracted from EditorialItinerary.tsx during the file-size decomposition.
// Compact, expandable inter-city transport row (train/flight/bus leg).
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import type { EditorialActivity } from '../EditorialItinerary';

export function InterCityTransportStrip({
  activity,
  travelMeta,
  TransportIcon,
}: {
  activity: EditorialActivity;
  travelMeta: any;
  TransportIcon: React.ComponentType<{ className?: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasExpandableDetails = travelMeta.arrTime || travelMeta.seatInfo || travelMeta.bookingRef;

  return (
    <div className="px-2 sm:px-0 py-1">
      <div
        className={cn(
          "rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2.5 group/transport",
          hasExpandableDetails && "cursor-pointer"
        )}
        onClick={hasExpandableDetails ? () => setExpanded(prev => !prev) : undefined}
      >
        {/* Single compact row */}
        <div className="flex items-center gap-2.5">
          {/* Transport icon in a tinted circle */}
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <TransportIcon className="h-3.5 w-3.5 text-primary" />
          </div>

          {/* Title + subtitle */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {activity.title}
            </p>
            {travelMeta.carrier && (
              <p className="text-[11px] text-muted-foreground truncate">
                {travelMeta.carrier}{travelMeta.flightNum ? ` ${travelMeta.flightNum}` : ''}
                {travelMeta.dur ? ` · ${travelMeta.dur}` : ''}
              </p>
            )}
            {!travelMeta.carrier && !travelMeta.depTime && (
              <p className="text-[11px] text-muted-foreground/60 italic truncate">
                Plan your transport details
              </p>
            )}
          </div>

          {/* Time pill */}
          {travelMeta.depTime && (
            <span className="text-xs font-semibold text-primary tabular-nums shrink-0">
              {travelMeta.depTime}
            </span>
          )}

          {/* Cost */}
          {travelMeta.price != null && travelMeta.price > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: travelMeta.currency || 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(travelMeta.price)}
            </span>
          )}

          {/* Collapse/expand chevron */}
          {hasExpandableDetails && (
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )} />
          )}
        </div>

        {/* Expandable details */}
        {expanded && hasExpandableDetails && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-primary/10 text-[11px] text-muted-foreground">
            {travelMeta.depTime && travelMeta.arrTime && (
              <span>{travelMeta.depTime} → {travelMeta.arrTime}</span>
            )}
            {travelMeta.seatInfo && <span>Class: {travelMeta.seatInfo}</span>}
            {travelMeta.bookingRef && <span>Ref: {travelMeta.bookingRef}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
