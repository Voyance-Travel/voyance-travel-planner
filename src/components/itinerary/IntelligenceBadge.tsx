/**
 * Intelligence Badge Component
 * 
 * Visual badges that surface the hidden value in itinerary recommendations.
 * These make the "invisible" intelligence visible to users.
 */

import { cn } from '@/lib/utils';
import {
  Sparkles,
  Clock,
  Target,
  MapPinOff,
  User,
  Link2,
  Coins,
  Compass
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type IntelligenceType =
  | 'voyance-find'      // Hidden gem you wouldn't find on Google
  | 'timing-hack'       // Scheduled to avoid crowds
  | 'insider-tip'       // Execution advice from locals
  | 'off-the-path'      // Locals-only, not on tourist radar
  | 'personalized'      // Specifically matched to your DNA
  | 'connected'         // Flows from previous activity
  | 'value-play'        // Better experience for less money
  | 'skip-alternative'; // Replaces a tourist trap

interface IntelligenceBadgeProps {
  type: IntelligenceType;
  tooltip?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const badgeConfig: Record<IntelligenceType, {
  icon: React.ReactNode;
  label: string;
  defaultTooltip: string;
  className: string;
}> = {
  'voyance-find': {
    icon: <Sparkles className="h-3 w-3" />,
    label: 'Voyance Find',
    defaultTooltip: "You wouldn't find this on your own",
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  'timing-hack': {
    icon: <Clock className="h-3 w-3" />,
    label: 'Timing Hack',
    defaultTooltip: 'Scheduled specifically to avoid crowds',
    className: 'bg-accent/10 text-accent border-accent/20',
  },
  'insider-tip': {
    icon: <Target className="h-3 w-3" />,
    label: 'Insider Tip',
    defaultTooltip: 'Local knowledge on what to do there',
    className: 'bg-gold/10 text-gold border-gold/20',
  },
  'off-the-path': {
    icon: <Compass className="h-3 w-3" />,
    label: 'Off the Path',
    defaultTooltip: 'Locals know this. Tourists don\'t.',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  'personalized': {
    icon: <User className="h-3 w-3" />,
    label: 'For You',
    defaultTooltip: 'Matched to your travel style',
    className: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  },
  'connected': {
    icon: <Link2 className="h-3 w-3" />,
    label: 'Connected',
    defaultTooltip: 'Flows naturally from the previous activity',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  'value-play': {
    icon: <Coins className="h-3 w-3" />,
    label: 'Value Play',
    defaultTooltip: 'Better experience for less money',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  'skip-alternative': {
    icon: <MapPinOff className="h-3 w-3" />,
    label: 'Skip Alternative',
    defaultTooltip: 'This replaces a tourist trap',
    className: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  },
};

export function IntelligenceBadge({
  type,
  tooltip,
  size = 'sm',
  className,
}: IntelligenceBadgeProps) {
  const config = badgeConfig[type];
  
  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        config.className,
        className
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px] text-center">
        <p className="text-xs">{tooltip || config.defaultTooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Determine which intelligence badges apply to an activity
 */
export interface ActivityIntelligence {
  isHiddenGem?: boolean;
  hasTimingHack?: boolean;
  hasInsiderTip?: boolean;
  isOffThePath?: boolean;
  isPersonalized?: boolean;
  isConnected?: boolean;
  isValuePlay?: boolean;
  isSkipAlternative?: boolean;
  // Detailed data for tooltips
  timingReason?: string;
  insiderTip?: string;
  personalizationReason?: string;
  connectionReason?: string;
  crowdLevel?: 'low' | 'moderate' | 'high';
}

interface IntelligenceBadgeGroupProps {
  intelligence: ActivityIntelligence;
  maxBadges?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function IntelligenceBadgeGroup({
  intelligence,
  maxBadges = 3,
  size = 'sm',
  className,
}: IntelligenceBadgeGroupProps) {
  const badges: { type: IntelligenceType; tooltip?: string }[] = [];

  // Priority order for badges
  if (intelligence.isHiddenGem) {
    badges.push({ type: 'voyance-find' });
  }
  if (intelligence.hasTimingHack) {
    badges.push({ 
      type: 'timing-hack', 
      tooltip: intelligence.timingReason 
    });
  }
  if (intelligence.isOffThePath) {
    badges.push({ type: 'off-the-path' });
  }
  if (intelligence.isPersonalized) {
    badges.push({ 
      type: 'personalized', 
      tooltip: intelligence.personalizationReason 
    });
  }
  if (intelligence.hasInsiderTip) {
    badges.push({ 
      type: 'insider-tip', 
      tooltip: intelligence.insiderTip 
    });
  }
  if (intelligence.isValuePlay) {
    badges.push({ type: 'value-play' });
  }
  if (intelligence.isConnected) {
    badges.push({ 
      type: 'connected', 
      tooltip: intelligence.connectionReason 
    });
  }
  if (intelligence.isSkipAlternative) {
    badges.push({ type: 'skip-alternative' });
  }

  const visibleBadges = badges.slice(0, maxBadges);

  if (visibleBadges.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visibleBadges.map((badge, index) => (
        <IntelligenceBadge
          key={`${badge.type}-${index}`}
          type={badge.type}
          tooltip={badge.tooltip}
          size={size}
        />
      ))}
    </div>
  );
}

export default IntelligenceBadge;
