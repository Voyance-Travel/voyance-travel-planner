/**
 * Performance configuration utilities
 * For caching and performance optimization
 */

const CACHE_PREFIX = 'voyance_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Get cached user data
 */
export function getCachedUserData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Set cached user data
 */
export function setCachedUserData<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

/**
 * Clear cached data
 */
export function clearCachedData(key?: string): void {
  if (key) {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } else {
    // Clear all cached data
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}

/**
 * Performance monitoring
 */
export function measurePerformance(label: string) {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      if (import.meta.env.DEV) {
        console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
      }
      return duration;
    },
  };
}
