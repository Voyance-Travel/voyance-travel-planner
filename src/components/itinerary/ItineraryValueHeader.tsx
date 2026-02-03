/**
 * Itinerary Value Header
 * 
 * Displays the quantified value at the top of each itinerary:
 * - X Voyance Finds (hidden gems)
 * - Y Timing Optimizations
 * - Z Tourist Traps Avoided
 * - W Insider Tips
 */

import { motion } from 'framer-motion';
import { Sparkles, Clock, MapPinOff, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ItineraryValueStats {
  voyanceFinds: number;
  timingOptimizations: number;
  touristTrapsAvoided: number;
  insiderTips: number;
  estimatedSavings?: {
    time: string;  // e.g., "3+ hours"
    money?: string; // e.g., "~$150"
  };
}

interface ItineraryValueHeaderProps {
  stats: ItineraryValueStats;
  destination: string;
  archetype?: string;
  className?: string;
}

export function ItineraryValueHeader({
  stats,
  destination,
  archetype,
  className,
}: ItineraryValueHeaderProps) {
  const hasValue = stats.voyanceFinds > 0 || 
                   stats.timingOptimizations > 0 || 
                   stats.touristTrapsAvoided > 0 ||
                   stats.insiderTips > 0;

  if (!hasValue) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5',
        className
      )}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Your {destination}
          {archetype && <span className="ml-1">· {archetype} style</span>}
        </h3>
        {stats.estimatedSavings && (
          <div className="mt-2">
            <div className="flex items-center justify-center gap-1 text-primary text-sm font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>vs. typical itinerary</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.estimatedSavings.time} saved
              {stats.estimatedSavings.money && ` + ${stats.estimatedSavings.money}`}
            </p>
          </div>
        )}
      </div>

      {/* Value Stats Grid */}
      <div className="flex flex-wrap justify-center gap-3">
        {stats.voyanceFinds > 0 && (
          <ValueStat
            icon={<Sparkles className="h-4 w-4" />}
            value={stats.voyanceFinds}
            label="Voyance Finds"
            description="Places you wouldn't find on Google"
            color="primary"
          />
        )}
        {stats.timingOptimizations > 0 && (
          <ValueStat
            icon={<Clock className="h-4 w-4" />}
            value={stats.timingOptimizations}
            label="Timing Hacks"
            description="Scheduled to minimize crowds"
            color="accent"
          />
        )}
        {stats.touristTrapsAvoided > 0 && (
          <ValueStat
            icon={<MapPinOff className="h-4 w-4" />}
            value={stats.touristTrapsAvoided}
            label="Traps Avoided"
            description="Tourist traps we skipped"
            color="rose"
          />
        )}
        {stats.insiderTips > 0 && (
          <ValueStat
            icon={<Target className="h-4 w-4" />}
            value={stats.insiderTips}
            label="Insider Tips"
            description="Local execution advice"
            color="gold"
          />
        )}
      </div>

      {/* Tagline */}
      <p className="text-xs text-muted-foreground text-center mt-4 italic">
        "This isn't a list of famous places. It's a designed experience built around how you travel."
      </p>
    </motion.div>
  );
}

interface ValueStatProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  description: string;
  color: 'primary' | 'accent' | 'rose' | 'gold';
}

function ValueStat({ icon, value, label, description, color }: ValueStatProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    accent: 'text-accent bg-accent/10',
    rose: 'text-rose-500 bg-rose-500/10',
    gold: 'text-gold bg-gold/10',
  };

  return (
    <div className="flex flex-col items-center text-center p-3 rounded-lg bg-secondary/30">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center mb-2',
        colorClasses[color]
      )}>
        {icon}
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
        {description}
      </span>
    </div>
  );
}

export default ItineraryValueHeader;
