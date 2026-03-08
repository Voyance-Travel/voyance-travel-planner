/**
 * ActiveTripStats
 * Live dashboard showing key trip metrics: activities, budget, steps, photos, neighborhoods
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Footprints, Camera, CheckCircle2, MapPin,
  Utensils, TrendingUp, Clock, Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
    // All activities across entire trip
    const allActivities = itinerary.flatMap(d => d.activities);
    const totalActivities = allActivities.length;
    const completedCount = completedActivities.size;
    const completionRate = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

    // Unique neighborhoods/areas from activity categories
    const categories = new Set(allActivities.map(a => a.category).filter(Boolean));

    // Estimated steps: ~3500 per completed activity + 2000 base per day elapsed
    const estimatedSteps = completedCount * 3500 + currentDayNumber * 2000;

    // Estimated walking distance (km): avg 0.7 km per 1000 steps
    const walkingKm = Math.round((estimatedSteps / 1000) * 0.7 * 10) / 10;

    // Budget spent estimate: rough per-activity cost based on budget / total activities
    const perActivityCost = budget && allActivities.length > 0 ? budget / allActivities.length : 0;
    const totalSpentEstimate = Math.round(perActivityCost * completedCount);

    // Meals estimate: ~2 meals per day elapsed
    const mealsEstimate = Math.ceil(currentDayNumber * 2);

    // Time spent: sum durations of completed activities
    const totalMinutes = allActivities
      .filter(a => completedActivities.has(a.id))
      .reduce((sum, a) => sum + (a.duration || 90), 0);
    const hoursExploring = Math.round(totalMinutes / 60 * 10) / 10;

    return {
      totalActivities,
      completedCount,
      completionRate,
      categories: categories.size,
      estimatedSteps,
      walkingKm,
      totalSpentEstimate,
      mealsEstimate,
      photosCount: memories.length,
      hoursExploring,
    };
  }, [itinerary, completedActivities, currentDayNumber, memories.length, travelers]);

  const statCards = [
    {
      icon: CheckCircle2,
      label: 'Activities Done',
      value: `${stats.completedCount}/${stats.totalActivities}`,
      subValue: `${stats.completionRate}% complete`,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      progress: stats.completionRate,
    },
    {
      icon: Footprints,
      label: 'Est. Walking',
      value: `${Math.round(stats.estimatedSteps / 1000)}k`,
      subValue: `~${stats.walkingKm} km walked`,
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10',
    },
    {
      icon: Camera,
      label: 'Memories',
      value: stats.photosCount,
      subValue: stats.photosCount === 0 ? 'Start capturing!' : `${Math.round(stats.photosCount / currentDayNumber)} per day`,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      icon: Clock,
      label: 'Hours Exploring',
      value: stats.hoursExploring,
      subValue: `across ${stats.completedCount} activities`,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Utensils,
      label: 'Meals (est.)',
      value: stats.mealsEstimate,
      subValue: `~${Math.round(stats.mealsEstimate / currentDayNumber)} per day`,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      icon: MapPin,
      label: 'Categories',
      value: stats.categories,
      subValue: 'types of experiences',
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    },
  ];

  // Only show budget card if budget is set
  if (budget && budget > 0) {
    const budgetUsedPercent = stats.totalSpentEstimate > 0
      ? Math.min(Math.round((stats.totalSpentEstimate / budget) * 100), 100)
      : 0;

    statCards.splice(2, 0, {
      icon: TrendingUp,
      label: 'Budget Used',
      value: new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(stats.totalSpentEstimate),
      subValue: `of ${new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(budget)}`,
      color: budgetUsedPercent > 80 ? 'text-red-500' : 'text-amber-500',
      bgColor: budgetUsedPercent > 80 ? 'bg-red-500/10' : 'bg-amber-500/10',
      progress: budgetUsedPercent,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Trip Stats
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Day {currentDayNumber} of {totalDays} in {destination}
        </p>
      </div>

      {/* Overall progress */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Trip Completion</span>
            <span className="text-sm font-bold text-primary">{stats.completionRate}%</span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {stats.completedCount} of {stats.totalActivities} activities completed
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="h-full">
                <CardContent className="pt-4 pb-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', card.bgColor)}>
                    <Icon className={cn('w-4 h-4', card.color)} />
                  </div>
                  <p className="text-xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  {card.subValue && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{card.subValue}</p>
                  )}
                  {card.progress !== undefined && (
                    <Progress value={card.progress} className="h-1 mt-2" />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
