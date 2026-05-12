/**
 * RestaurantLink Component
 * 
 * Uses AI-powered search (Perplexity) to find the official restaurant website URL.
 * If no direct URL is found, no link is shown (we don't want to redirect to search engines).
 */

import { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RestaurantLinkProps {
  restaurantName: string;
  destination: string;
  className?: string;
}

// Cache for looked up URLs to avoid repeated API calls
const urlCache = new Map<string, { url: string | null; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function getCacheKey(name: string, destination: string): string {
  return `${(name || '').toLowerCase().trim()}|${(destination || '').toLowerCase().trim()}`;
}

function cleanRestaurantName(name: string): string {
  return name
    .replace(/^(dinner|lunch|breakfast|brunch|meal|dining|drinks?|coffee|dessert)\s*(at|@)?\s*/i, '')
    .replace(/\s*restaurant$/i, '')
    .trim();
}

export function RestaurantLink({ restaurantName, destination, className }: RestaurantLinkProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    // Reset state on each prop change so a new lookup starts cleanly.
    setIsLoading(true);
    setUrl(null);

    // Deadline fallback FIRST: established before any async work so a hung
    // invoke (cold start, OOM, network drop) can never strand the spinner.
    const timeoutId = window.setTimeout(() => {
      if (cancelled || settled) return;
      settled = true;
      if (import.meta.env.DEV) {
        console.warn('[RestaurantLink] lookup deadline hit (5s)', { restaurantName, destination });
      }
      setUrl(null);
      setIsLoading(false);
    }, 5000);

    async function lookupUrl() {
      const cacheKey = getCacheKey(restaurantName, destination);

      const finish = (nextUrl: string | null) => {
        if (cancelled || settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        setUrl(nextUrl);
        setIsLoading(false);
      };

      // Check cache first
      const cached = urlCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        finish(cached.url);
        return;
      }

      try {
        const cleanName = cleanRestaurantName(restaurantName);

        // If cleaning stripped everything, skip the lookup
        if (!cleanName) {
          urlCache.set(cacheKey, { url: null, timestamp: Date.now() });
          finish(null);
          return;
        }

        const { data, error } = await supabase.functions.invoke('lookup-restaurant-url', {
          body: { restaurantName: cleanName, destination }
        });

        if (cancelled || settled) return;

        if (error || !data?.success || !data?.url) {
          urlCache.set(cacheKey, { url: null, timestamp: Date.now() });
          finish(null);
        } else {
          urlCache.set(cacheKey, { url: data.url, timestamp: Date.now() });
          finish(data.url);
        }
      } catch (err) {
        console.error('[RestaurantLink] Error looking up URL:', err);
        finish(null);
      }
    }

    lookupUrl();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [restaurantName, destination]);

  if (isLoading) {
    return (
      <span className={`inline-flex items-center gap-1 sm:gap-1.5 text-xs text-muted-foreground ${className || ''}`}>
        <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
        <span className="sm:hidden">Loading...</span>
        <span className="hidden sm:inline">Finding restaurant...</span>
      </span>
    );
  }

  // Don't show any link if we couldn't find the official URL
  // No more Google/Yelp fallback - either direct link or nothing
  if (!url) {
    return null;
  }

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
