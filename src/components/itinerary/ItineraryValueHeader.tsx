/**
 * Itinerary Intelligence Summary
 * 
 * Displays quantified value at the top of each itinerary with expandable details:
 * - X Voyance Finds (hidden gems)
 * - Y Timing Hacks
 * - Z Local Picks (insider alternatives)
 * - W Insider Tips
 * 
 * Each badge is expandable to show specifics. Includes savings calculation.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Clock, MapPinOff, Target, TrendingUp, ChevronDown, ChevronUp,
  AlertTriangle, Lightbulb, MapPin, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';

export interface IntelligenceDetail {
  title: string;
  reason?: string;
  savingsTime?: string;
  savingsMoney?: string;
}

export interface ItineraryValueStats {
  voyanceFinds: number;
  timingOptimizations: number;
  touristTrapsAvoided: number;
  insiderTips: number;
  estimatedSavings?: {
    time: string;  // e.g., "3+ hours"
    money?: string; // e.g., "~$150"
  };
  // Expandable details
  voyanceFindsDetails?: IntelligenceDetail[];
  timingDetails?: IntelligenceDetail[];
  trapsAvoidedDetails?: IntelligenceDetail[];
  insiderTipsDetails?: IntelligenceDetail[];
}

interface ItineraryValueHeaderProps {
  stats: ItineraryValueStats;
  destination: string;
  archetype?: string;
  className?: string;
  tripId?: string;
}

export function ItineraryValueHeader({
  stats,
  destination,
  archetype,
  className,
  tripId,
}: ItineraryValueHeaderProps) {
  const isMobile = useIsMobile();
  const hasValue = stats.voyanceFinds > 0 || 
                   stats.timingOptimizations > 0 || 
                   stats.touristTrapsAvoided > 0 ||
                   stats.insiderTips > 0;

  // On mobile: default collapsed. On desktop: default expanded.
  const [isExpanded, setIsExpanded] = useState(!isMobile);

  if (!hasValue) return null;

  // Build summary line for collapsed state
  const summaryParts: string[] = [];
  if (stats.voyanceFinds > 0) summaryParts.push(`${stats.voyanceFinds} finds`);
  if (stats.timingOptimizations > 0) summaryParts.push(`${stats.timingOptimizations} timing hacks`);
  if (stats.touristTrapsAvoided > 0) summaryParts.push(`${stats.touristTrapsAvoided} local picks`);
  if (stats.insiderTips > 0) summaryParts.push(`${stats.insiderTips} insider tips`);
  if (stats.estimatedSavings?.time) summaryParts.push(`${stats.estimatedSavings.time} saved`);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-border bg-gradient-to-b from-card to-card/80 backdrop-blur-sm overflow-hidden',
        className
      )}
    >
      {/* Collapsible header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 sm:p-5 flex items-center justify-between text-left border-b border-border/50 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
              Voyance Intelligence
            </h2>
            {!isExpanded && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {summaryParts.join(' · ')}
              </p>
            )}
          </div>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
          isExpanded && "rotate-180"
        )} />
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >

      {/* Metric Badges Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border/50">
        {stats.voyanceFinds > 0 && (
          <ExpandableBadge
            icon={<Sparkles className="h-4 w-4" />}
            value={stats.voyanceFinds}
            label="Voyance Finds"
            subtitle="Hidden gems you wouldn't find alone"
            color="primary"
            details={stats.voyanceFindsDetails}
          />
        )}
        {stats.timingOptimizations > 0 && (
          <ExpandableBadge
            icon={<Clock className="h-4 w-4" />}
            value={stats.timingOptimizations}
            label="Timing Hacks"
            subtitle="Scheduled to beat crowds"
            color="accent"
            details={stats.timingDetails}
          />
        )}
        {stats.touristTrapsAvoided > 0 && (
          <ExpandableBadge
            icon={<Sparkles className="h-4 w-4" />}
            value={stats.touristTrapsAvoided}
            label="Local Picks"
            subtitle="Insider alternatives included"
            color="primary"
            details={stats.trapsAvoidedDetails}
          />
        )}
        {stats.insiderTips > 0 && (
          <ExpandableBadge
            icon={<Target className="h-4 w-4" />}
            value={stats.insiderTips}
            label="Insider Tips"
            subtitle="Local execution advice"
            color="gold"
            details={stats.insiderTipsDetails}
          />
        )}
      </div>

      {/* Savings Result */}
      {stats.estimatedSavings && (
        <div className="p-4 bg-primary/5 border-t border-border/50">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-primary font-medium">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Result:</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-foreground">
                {stats.estimatedSavings.time} saved
              </span>
              {stats.estimatedSavings.money && (
                <>
                  <span className="text-muted-foreground">+</span>
                  <span className="font-semibold text-foreground">
                    {stats.estimatedSavings.money}
                  </span>
                </>
              )}
              <span className="text-muted-foreground">vs. typical itinerary</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface ExpandableBadgeProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  subtitle: string;
  color: 'primary' | 'accent' | 'rose' | 'gold';
  details?: IntelligenceDetail[];
}

function ExpandableBadge({ icon, value, label, subtitle, color, details }: ExpandableBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = details && details.length > 0;

  const colorClasses = {
    primary: {
      icon: 'text-primary bg-primary/10',
      badge: 'text-primary',
      detail: 'border-primary/20 bg-primary/5',
    },
    accent: {
      icon: 'text-accent bg-accent/10',
      badge: 'text-accent',
      detail: 'border-accent/20 bg-accent/5',
    },
    rose: {
      icon: 'text-rose-500 bg-rose-500/10',
      badge: 'text-rose-500',
      detail: 'border-rose-500/20 bg-rose-500/5',
    },
    gold: {
      icon: 'text-gold bg-gold/10',
      badge: 'text-gold',
      detail: 'border-gold/20 bg-gold/5',
    },
  };

  const colors = colorClasses[color];

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger 
        className={cn(
          'w-full p-4 text-center transition-colors',
          hasDetails && 'hover:bg-secondary/30 cursor-pointer',
          !hasDetails && 'cursor-default'
        )}
        disabled={!hasDetails}
      >
        <div className="flex flex-col items-center">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center mb-2',
            colors.icon
          )}>
            {icon}
          </div>
          <span className={cn('text-3xl font-bold', colors.badge)}>{value}</span>
          <span className="text-xs font-medium text-foreground mt-0.5">{label}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{subtitle}</span>
          
          {hasDetails && (
            <div className={cn('mt-2 flex items-center gap-1 text-[10px]', colors.badge)}>
              <span>View details</span>
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          )}
        </div>
      </CollapsibleTrigger>

      {hasDetails && (
        <CollapsibleContent className="col-span-full">
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn('border-t p-3 space-y-2', colors.detail)}
              >
                {details.map((detail, idx) => (
                  <DetailItem key={idx} detail={detail} color={color} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function DetailItem({ detail, color }: { detail: IntelligenceDetail; color: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="mt-0.5">
        {color === 'rose' || color === 'primary' ? (
          <MapPin className="h-3 w-3 text-primary" />
        ) : color === 'gold' ? (
          <Lightbulb className="h-3 w-3 text-gold" />
        ) : color === 'accent' ? (
          <Clock className="h-3 w-3 text-accent" />
        ) : (
          <MapPin className="h-3 w-3 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{detail.title}</p>
        {detail.reason && (
          <p className="text-muted-foreground mt-0.5 leading-relaxed">{detail.reason}</p>
        )}
        {(detail.savingsTime || detail.savingsMoney) && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            {detail.savingsTime && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" /> {detail.savingsTime} saved
              </span>
            )}
            {detail.savingsMoney && (
              <span className="flex items-center gap-0.5">
                <DollarSign className="h-2.5 w-2.5" /> {detail.savingsMoney} saved
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ItineraryValueHeader;
