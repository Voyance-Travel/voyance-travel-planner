import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Sparkles, PartyPopper, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface DailyProgressBarProps {
  completedCount: number;
  totalCount: number;
  dayNumber: number;
  totalDays: number;
  daysRemaining: number;
  isLastDay: boolean;
}

function getMotivationalMessage(percent: number, completedCount: number, totalCount: number, dayNumber: number, isLastDay: boolean) {
  if (totalCount === 0) return { text: 'Free day, explore at your own pace!', icon: Sparkles };
  if (percent === 100) return { text: isLastDay ? 'Perfect finale! 🎉 You nailed this trip!' : 'Day crushed! You\'re on fire 🔥', icon: PartyPopper };
  if (percent >= 75) return { text: `Almost there! Just ${totalCount - completedCount} left`, icon: Trophy };
  if (percent >= 50) return { text: `Halfway through day ${dayNumber}, keep going!`, icon: TrendingUp };
  if (percent >= 25) return { text: `Great start! ${completedCount} down, ${totalCount - completedCount} to go`, icon: Flame };
  if (completedCount > 0) return { text: `You're off! ${totalCount - completedCount} adventures ahead`, icon: Sparkles };
  return { text: `${totalCount} experiences waiting for you today`, icon: Sparkles };
}

export function DailyProgressBar({
  completedCount,
  totalCount,
  dayNumber,
  totalDays,
  daysRemaining,
  isLastDay,
}: DailyProgressBarProps) {
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const motivation = useMemo(
    () => getMotivationalMessage(percent, completedCount, totalCount, dayNumber, isLastDay),
    [percent, completedCount, totalCount, dayNumber, isLastDay]
  );

  const MotivationIcon = motivation.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-4 space-y-3"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            percent === 100
              ? 'bg-emerald-500/15 text-emerald-600'
              : 'bg-primary/10 text-primary'
          )}>
            <MotivationIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {completedCount} of {totalCount} completed
            </p>
            <p className="text-xs text-muted-foreground">
              Day {dayNumber} of {totalDays}
              {daysRemaining > 0 && !isLastDay && ` · ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} left`}
            </p>
          </div>
        </div>

        {/* Percentage badge */}
        <span className={cn(
          'text-lg font-bold tabular-nums',
          percent === 100 ? 'text-emerald-600' : 'text-primary'
        )}>
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <Progress
        value={percent}
        className={cn(
          'h-2.5',
          percent === 100 && '[&>div]:bg-emerald-500'
        )}
      />

      {/* Motivational message */}
      <p className="text-xs text-muted-foreground text-center">
        {motivation.text}
      </p>
    </motion.div>
  );
}
