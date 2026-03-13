/**
 * ActiveTripStats
 * Editorial magazine-style trip metrics
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Footprints, Camera, CheckCircle2, MapPin,
  Utensils, TrendingUp, Clock
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useTripMemories } from '@/services/tripMemoriesAPI';
import { cn } from '@/lib/utils';

interface ItineraryDay {
  dayNumber: number;
  date: string;
  theme?: string;
  activities: {
    id: string;
    name: string;
    category?: string;
    duration?: number;
  }[];
}

interface ActiveTripStatsProps {
  tripId: string;
  tripName: string;
  destination: string;
  itinerary: ItineraryDay[];
  completedActivities: Set<string>;
  currentDayNumber: number;
  totalDays: number;
  budget?: number;
  currency?: string;
  travelers?: number;
}

export function ActiveTripStats({
  tripId,
  tripName,
  destination,
  itinerary,
  completedActivities,
  currentDayNumber,
  totalDays,
  budget,
  currency = 'USD',
  travelers = 1,
}: ActiveTripStatsProps) {
  const { data: memories = [] } = useTripMemories(tripId);

  const stats = useMemo(() => {
    const allActivities = itinerary.flatMap(d => d.activities);
    const totalActivities = allActivities.length;
    const completedCount = completedActivities.size;
    const completionRate = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;
    const categories = new Set(allActivities.map(a => a.category).filter(Boolean));
    const estimatedSteps = completedCount * 3500 + currentDayNumber * 2000;
    const walkingKm = Math.round((estimatedSteps / 1000) * 0.7 * 10) / 10;
    const perActivityCost = budget && allActivities.length > 0 ? budget / allActivities.length : 0;
    const totalSpentEstimate = Math.round(perActivityCost * completedCount);
    const mealsEstimate = Math.ceil(currentDayNumber * 2);
    const totalMinutes = allActivities
      .filter(a => completedActivities.has(a.id))
      .reduce((sum, a) => sum + (a.duration || 90), 0);
    const hoursExploring = Math.round(totalMinutes / 60 * 10) / 10;

    return {
      totalActivities, completedCount, completionRate, categories: categories.size,
      estimatedSteps, walkingKm, totalSpentEstimate, mealsEstimate,
      photosCount: memories.length, hoursExploring,
    };
  }, [itinerary, completedActivities, currentDayNumber, memories.length, travelers]);

  const statItems = [
    { icon: CheckCircle2, label: 'Activities', value: `${stats.completedCount}/${stats.totalActivities}`, sub: `${stats.completionRate}% complete`, color: 'text-primary' },
    { icon: Footprints, label: 'Walking', value: `${Math.round(stats.estimatedSteps / 1000)}k steps`, sub: `~${stats.walkingKm} km`, color: 'text-emerald-500' },
    { icon: Camera, label: 'Memories', value: String(stats.photosCount), sub: stats.photosCount === 0 ? 'Start capturing!' : `${Math.round(stats.photosCount / currentDayNumber)}/day`, color: 'text-pink-500' },
    { icon: Clock, label: 'Exploring', value: `${stats.hoursExploring}h`, sub: `across ${stats.completedCount} activities`, color: 'text-blue-500' },
    { icon: Utensils, label: 'Meals', value: String(stats.mealsEstimate), sub: `~${Math.round(stats.mealsEstimate / currentDayNumber)}/day`, color: 'text-amber-500' },
    { icon: MapPin, label: 'Categories', value: String(stats.categories), sub: 'types of experiences', color: 'text-violet-500' },
  ];

  // Inject budget if set
  if (budget && budget > 0) {
    const budgetUsedPercent = stats.totalSpentEstimate > 0
      ? Math.min(Math.round((stats.totalSpentEstimate / budget) * 100), 100) : 0;
    statItems.splice(2, 0, {
      icon: TrendingUp,
      label: 'Budget',
      value: new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(stats.totalSpentEstimate),
      sub: `of ${new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(budget)} (${budgetUsedPercent}%)`,
      color: 'text-teal-500',
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h2 className="font-serif text-xl font-semibold">Trip Stats</h2>
        <p className="font-serif text-sm italic text-muted-foreground mt-0.5">
          Day {currentDayNumber} of {totalDays} in {destination}
        </p>
      </div>

      {/* Overall progress — borderless */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Trip Completion</span>
          <span className="font-serif text-2xl font-bold text-primary">{stats.completionRate}%</span>
        </div>
        <Progress value={stats.completionRate} className="h-1.5" />
        <p className="text-xs text-muted-foreground mt-2">
          {stats.completedCount} of {stats.totalActivities} activities completed
        </p>
        <div className="h-px bg-gradient-to-r from-primary/20 via-border/50 to-transparent mt-6" />
      </div>

      {/* Stats — editorial list */}
      <div className="space-y-0">
        {statItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-4 py-4 border-b border-border/30 last:border-b-0"
            >
              <Icon className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
              </div>
              <p className="font-serif text-xl font-bold text-foreground/80 shrink-0">
                {item.value}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
