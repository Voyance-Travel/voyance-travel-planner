/**
 * RestaurantLink Component
 *
 * Uses AI-powered search (Perplexity) to find the official restaurant website URL.
 * If no direct URL is found, no link is shown (we don't want to redirect to search engines).
 *
 * Stability contract:
 *   - Lookups are deduped at module scope so re-mounts share one in-flight promise.
 *   - The promise (not the component) writes to `urlCache`, so unmounting before
 *     resolution still persists the result for the next mount.
 *   - Negative cache mirrored into sessionStorage so a hard refresh inherits known nulls.
 *   - The visible spinner is suppressed; we render `null` while loading and let the
 *     link fade in when (and if) Perplexity resolves. This eliminates the
 *     "stuck Finding restaurant…" regression by construction.
 */

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RestaurantLinkProps {
  restaurantName: string;
  destination: string;
  className?: string;
}

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const STORAGE_KEY = 'restaurantUrlCache:v1';

type CacheEntry = { url: string | null; timestamp: number };

// Hydrate session-persisted cache once per page load.
const urlCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

(function hydrateFromSession() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.timestamp === 'number' && now - v.timestamp < CACHE_TTL_MS) {
        urlCache.set(k, v);
      }
    }
  } catch {
    /* ignore corrupt cache */
  }
})();

function persistCache() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, CacheEntry> = {};
    urlCache.forEach((v, k) => {
      obj[k] = v;
    });
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* quota / disabled storage — best effort */
  }
}

function setCacheEntry(key: string, url: string | null) {
  urlCache.set(key, { url, timestamp: Date.now() });
  persistCache();
}

function getCacheKey(name: string, destination: string): string {
  return `${(name || '').toLowerCase().trim()}|${(destination || '').toLowerCase().trim()}`;
}

function cleanRestaurantName(name: string): string {
  return name
    .replace(/^(dinner|lunch|breakfast|brunch|meal|dining|drinks?|coffee|dessert)\s*(at|@)?\s*/i, '')
    .replace(/\s*restaurant$/i, '')
    .trim();
}

/**
 * Module-scoped lookup. Survives component unmount: even if every subscriber
 * cancels, the promise still writes the result to urlCache so the next mount
 * sees a hit.
 */
function lookupUrlOnce(restaurantName: string, destination: string): Promise<string | null> {
  const cacheKey = getCacheKey(restaurantName, destination);

  const cached = urlCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Promise.resolve(cached.url);
  }

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<string | null> => {
    const cleanName = cleanRestaurantName(restaurantName);
    if (!cleanName) {
      setCacheEntry(cacheKey, null);
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('lookup-restaurant-url', {
        body: { restaurantName: cleanName, destination },
      });
      if (error || !data?.success || !data?.url) {
        setCacheEntry(cacheKey, null);
        return null;
      }
      setCacheEntry(cacheKey, data.url);
      return data.url as string;
    } catch (err) {
      console.warn('[RestaurantLink] lookup failed:', err);
      setCacheEntry(cacheKey, null);
      return null;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

export function RestaurantLink({ restaurantName, destination, className }: RestaurantLinkProps) {
  // Initialize from cache synchronously so cached hits never flash empty.
  const initialKey = getCacheKey(restaurantName, destination);
  const initialCached = urlCache.get(initialKey);
  const initialUrl =
    initialCached && Date.now() - initialCached.timestamp < CACHE_TTL_MS ? initialCached.url : null;

  const [url, setUrl] = useState<string | null>(initialUrl);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = getCacheKey(restaurantName, destination);

    // Read cache synchronously on each prop change.
    const cached = urlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setUrl(cached.url);
      return () => {
        cancelled = true;
      };
    }

    // Otherwise render nothing while the background lookup runs.
    setUrl(null);

    lookupUrlOnce(restaurantName, destination).then((resolved) => {
      if (cancelled) return;
      setUrl(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [restaurantName, destination]);

  // No spinner: silent until we either have a link or know we don't.
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 sm:gap-1.5 text-xs text-primary hover:underline ${className || ''}`}
    >
      <ExternalLink className="h-3 w-3 flex-shrink-0" />
      <span className="sm:hidden">View</span>
      <span className="hidden sm:inline">View Restaurant</span>
    </a>
  );
}

// Test-only helpers
export const __testing = {
  urlCache,
  inflight,
  lookupUrlOnce,
  getCacheKey,
};
