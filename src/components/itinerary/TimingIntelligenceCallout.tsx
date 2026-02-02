/**
 * Timing Intelligence Callout
 * 
 * Displays "Why This Time" information with crowd level visualization.
 * Shows users the value of the timing optimization.
 */

import { Clock, Users, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimingIntelligenceCalloutProps {
  scheduledTime: string;
  reason: string;
  crowdLevel?: {
    atScheduledTime: number;  // 0-100
    atPeakTime: number;       // 0-100
    peakTimeLabel?: string;   // e.g., "2pm"
  };
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  className?: string;
}

export function TimingIntelligenceCallout({
  scheduledTime,
  reason,
  crowdLevel,
  timeOfDay,
  className,
}: TimingIntelligenceCalloutProps) {
  const timeIcons = {
    morning: <Sunrise className="h-3.5 w-3.5" />,
    afternoon: <Sun className="h-3.5 w-3.5" />,
    evening: <Sunset className="h-3.5 w-3.5" />,
    night: <Moon className="h-3.5 w-3.5" />,
  };

  return (
    <div className={cn(
      'p-3 rounded-lg bg-accent/5 border border-accent/20',
      className
    )}>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <Clock className="h-3.5 w-3.5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-accent uppercase tracking-wide">
              Why {scheduledTime}
            </span>
            {timeOfDay && (
              <span className="text-muted-foreground">
                {timeIcons[timeOfDay]}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {reason}
          </p>

          {/* Crowd Level Visualization */}
          {crowdLevel && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" />
                  Crowd at {scheduledTime}
                </span>
                <span className="text-accent font-medium">
                  {crowdLevel.atScheduledTime}%
                </span>
              </div>
              <CrowdBar level={crowdLevel.atScheduledTime} variant="good" />
              
              <div className="flex items-center justify-between text-[10px] mt-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" />
                  Crowd at {crowdLevel.peakTimeLabel || 'peak'}
                </span>
                <span className="text-rose-500 font-medium">
                  {crowdLevel.atPeakTime}%
                </span>
              </div>
              <CrowdBar level={crowdLevel.atPeakTime} variant="bad" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CrowdBarProps {
  level: number;
  variant: 'good' | 'bad';
}

function CrowdBar({ level, variant }: CrowdBarProps) {
  return (
    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          variant === 'good' ? 'bg-accent' : 'bg-rose-500'
        )}
        style={{ width: `${level}%` }}
      />
    </div>
  );
}

export default TimingIntelligenceCallout;
