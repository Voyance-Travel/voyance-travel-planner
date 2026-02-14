/**
 * FrostedGateOverlay — Blurs premium content and overlays an unlock CTA.
 * Wraps children (activity list) with a frosted-glass effect on locked days.
 */

import { type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FrostedGateOverlayProps {
  dayNumber: number;
  activityCount: number;
  creditCost?: number;
  onUnlock: () => void;
  isUnlocking?: boolean;
  children: ReactNode;
  className?: string;
}

export function FrostedGateOverlay({
  dayNumber,
  activityCount,
  creditCost = 60,
  onUnlock,
  isUnlocking = false,
  children,
  className,
}: FrostedGateOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Actual content rendered but blurred */}
      <div className="blur-[8px] pointer-events-none select-none">
        {children}
      </div>

      {/* Frosted overlay with CTA */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center bg-background/30 backdrop-blur-[2px] cursor-pointer z-10"
        onClick={onUnlock}
      >
        <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-lg max-w-xs text-center">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onUnlock();
            }}
            disabled={isUnlocking}
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-md"
            size="lg"
          >
            <Sparkles className="h-4 w-4" />
            {isUnlocking
              ? `Unlocking Day ${dayNumber}...`
              : `Unlock Day ${dayNumber} - ${creditCost} credits`}
          </Button>
          <p className="text-sm text-muted-foreground">
            {activityCount} activit{activityCount === 1 ? 'y' : 'ies'} curated for your DNA profile
          </p>
        </div>
      </div>
    </div>
  );
}
