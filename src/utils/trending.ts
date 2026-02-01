/**
 * Trending Metrics Utilities
 * Calculate and display destination trending status
 */

export interface TrendingMetrics {
  searchVolume: number;
  bookingCount: number;
  timestamp: number;
}

export interface TrendingData {
  current: TrendingMetrics;
  previous: TrendingMetrics;
}

export type TrendingBadgeType = 'most-booked' | 'trending' | 'editor-choice' | 'new';

/**
 * Calculate the percentage change in interest for a destination
 */
export function calculateInterestDelta(
  current: TrendingMetrics,
  previous: TrendingMetrics
): number {
  // Weighted score combining search volume and booking count
  const currentScore = current.searchVolume * 0.6 + current.bookingCount * 0.4;
  const previousScore = previous.searchVolume * 0.6 + previous.bookingCount * 0.4;

  if (previousScore === 0) return 0;

  return Math.round(((currentScore - previousScore) / previousScore) * 100);
}

/**
 * Get trending status based on metrics
 */
export function getTrendingStatus(data: TrendingData): {
  type: TrendingBadgeType | undefined;
  percentage: number;
} {
  const delta = calculateInterestDelta(data.current, data.previous);
  const bookingRatio = data.previous.bookingCount > 0 
    ? data.current.bookingCount / data.previous.bookingCount 
    : 1;

  if (bookingRatio > 2) {
    return {
      type: 'most-booked',
      percentage: Math.round((bookingRatio - 1) * 100),
    };
  }

  if (delta > 20) {
    return {
      type: 'trending',
      percentage: delta,
    };
  }

  return {
    type: undefined,
    percentage: delta,
  };
}

/**
 * Check if destination is in optimal season
 */
export function isInSeason(
  optimalMonths: number[],
  currentDate: Date = new Date()
): boolean {
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  return optimalMonths.includes(currentMonth);
}

/**
 * Get personalized tags based on user preferences
 */
export function getPersonalizedTags(
  baseTags: string[],
  userPreferences?: {
    interests?: string[];
    travelStyle?: string[];
  }
): string[] {
  if (!userPreferences) return baseTags.slice(0, 3);

  const prioritizedTags = [...baseTags].sort((a, b) => {
    const aMatches = userPreferences.interests?.includes(a.toLowerCase()) ?? false;
    const bMatches = userPreferences.interests?.includes(b.toLowerCase()) ?? false;

    if (bMatches && !aMatches) return 1;
    if (aMatches && !bMatches) return -1;
    return 0;
  });

  return prioritizedTags.slice(0, 3);
}

/**
 * Get badge display info for trending type
 */
export function getTrendingBadgeInfo(type: TrendingBadgeType): {
  label: string;
  color: string;
  iconName: string;
} {
  const badges: Record<TrendingBadgeType, { label: string; color: string; iconName: string }> = {
    'most-booked': {
      label: 'Most Booked',
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      iconName: 'Flame',
    },
    trending: {
      label: 'Trending',
      color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
      iconName: 'TrendingUp',
    },
    'editor-choice': {
      label: "Editor's Choice",
      color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
      iconName: 'Star',
    },
    new: {
      label: 'New',
      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      iconName: 'Sparkles',
    },
  };

  return badges[type];
}
