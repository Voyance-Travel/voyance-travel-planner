/**
 * Locked Day Card
 * 
 * Blurred preview of locked days 2-5 with:
 * - Day title visible
 * - Activity count
 * - One teaser line
 * - Intelligence badge count
 * - Unlock CTA
 */

import { motion } from 'framer-motion';
import { Lock, Sparkles, Clock, MapPinOff, Target, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LockedDayCardProps {
  dayNumber: number;
  title: string;
  activityCount: number;
  teaserLine: string;
  intelligenceBadges: {
    finds: number;
    timingHacks: number;
    trapsAvoided: number;
    tips: number;
  };
  onUnlock: () => void;
  creditsNeeded: number;
  className?: string;
}

export function LockedDayCard({
  dayNumber,
  title,
  activityCount,
  teaserLine,
  intelligenceBadges,
  onUnlock,
  creditsNeeded,
  className,
}: LockedDayCardProps) {
  const totalBadges = 
    intelligenceBadges.finds + 
    intelligenceBadges.timingHacks + 
    intelligenceBadges.trapsAvoided + 
    intelligenceBadges.tips;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl border border-border bg-card overflow-hidden",
        className
      )}
    >
      {/* Blurred background - represents the content */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Day {dayNumber}
              </span>
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-serif font-medium text-foreground">
              {title}
            </h3>
          </div>
          
          {/* Activity count */}
          <div className="text-right">
            <span className="text-2xl font-bold text-foreground">{activityCount}</span>
            <span className="text-xs text-muted-foreground block">activities</span>
          </div>
        </div>

        {/* Teaser line */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {teaserLine}
        </p>

        {/* Intelligence badges - mini version */}
        {totalBadges > 0 && (
          <div className="flex items-center gap-3 mb-6">
            {intelligenceBadges.finds > 0 && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <Sparkles className="h-3 w-3" />
                <span>{intelligenceBadges.finds}</span>
              </div>
            )}
            {intelligenceBadges.timingHacks > 0 && (
              <div className="flex items-center gap-1 text-xs text-accent">
                <Clock className="h-3 w-3" />
                <span>{intelligenceBadges.timingHacks}</span>
              </div>
            )}
            {intelligenceBadges.trapsAvoided > 0 && (
              <div className="flex items-center gap-1 text-xs text-rose-500">
                <MapPinOff className="h-3 w-3" />
                <span>{intelligenceBadges.trapsAvoided}</span>
              </div>
            )}
            {intelligenceBadges.tips > 0 && (
              <div className="flex items-center gap-1 text-xs text-gold">
                <Target className="h-3 w-3" />
                <span>{intelligenceBadges.tips}</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">insights waiting</span>
          </div>
        )}

        {/* Blurred activity previews - decorative */}
        <div className="space-y-2 mb-6 opacity-40 blur-[2px] pointer-events-none">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
            >
              <div className="w-8 h-8 rounded-lg bg-muted" />
              <div className="flex-1">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-2 w-16 bg-muted/50 rounded mt-1" />
              </div>
            </div>
          ))}
        </div>

        {/* Unlock CTA */}
        <Button
          onClick={onUnlock}
          className="w-full gap-2 rounded-xl"
          size="lg"
        >
          <Lock className="h-4 w-4" />
          Unlock Day {dayNumber}
          <span className="text-xs opacity-80">({creditsNeeded} credits)</span>
        </Button>
      </div>

      {/* Decorative lock overlay */}
      <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
    </motion.div>
  );
}

export default LockedDayCard;
