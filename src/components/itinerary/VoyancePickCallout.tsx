/**
 * VoyancePickCallout — Personal endorsement for founder-curated picks
 * "We love this and we hope you will too"
 */

import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoyancePickCalloutProps {
  tip?: string;
  className?: string;
}

export function VoyancePickCallout({ tip, className }: VoyancePickCalloutProps) {
  return (
    <div
      className={cn(
        "mt-2 rounded-lg border border-primary/30 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent overflow-hidden",
        className
      )}
    >
      <div className="flex items-start gap-2.5 p-3">
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Heart className="h-3.5 w-3.5 text-primary fill-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-primary">
              Voyance Pick
            </span>
            <span className="text-[10px] text-primary/60 italic">
              Vetted by our founders
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We love this and we hope you will too.
            {tip && (
              <span className="text-foreground/80"> {tip}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default VoyancePickCallout;
