/**
 * Hook to track first-time tooltip displays
 * Returns whether this is the first time seeing a particular tooltip category
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'voyance_seen_tooltips';

export function useFirstTimeTooltip(category: string): {
  isFirstTime: boolean;
  markAsSeen: () => void;
} {
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    const seenTooltips = getSeenTooltips();
    setIsFirstTime(!seenTooltips.includes(category));
  }, [category]);

  const markAsSeen = useCallback(() => {
    const seenTooltips = getSeenTooltips();
    if (!seenTooltips.includes(category)) {
      seenTooltips.push(category);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seenTooltips));
      } catch {
        // localStorage might be full or unavailable
      }
      setIsFirstTime(false);
    }
  }, [category]);

  return { isFirstTime, markAsSeen };
}

function getSeenTooltips(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Check if user has seen intelligence badges before (static check)
 */
export function hasSeenIntelligenceBadges(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const seen = stored ? JSON.parse(stored) : [];
    return seen.includes('intelligence-badges');
  } catch {
    return false;
  }
}

/**
 * Mark intelligence badges as seen
 */
export function markIntelligenceBadgesSeen(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const seen = stored ? JSON.parse(stored) : [];
    if (!seen.includes('intelligence-badges')) {
      seen.push('intelligence-badges');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    }
  } catch {
    // Ignore errors
  }
}
