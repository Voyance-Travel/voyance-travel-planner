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
    
    async function lookupUrl() {
      // Log what we're looking up for debugging
      // Looking up restaurant URL
      
      const cacheKey = getCacheKey(restaurantName, destination);
      
      // Check cache first
      const cached = urlCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        // Cache hit
        if (!cancelled) {
          setUrl(cached.url); // Will be null if no URL was found
          setIsLoading(false);
        }
        return;
      }
      
      try {
        const cleanName = cleanRestaurantName(restaurantName);
        
        // If cleaning stripped everything, skip the lookup
        if (!cleanName) {
          urlCache.set(cacheKey, { url: null, timestamp: Date.now() });
          if (!cancelled) { setUrl(null); setIsLoading(false); }
          return;
        }
        
        const { data, error } = await supabase.functions.invoke('lookup-restaurant-url', {
          body: { restaurantName: cleanName, destination }
        });
        
        if (!cancelled) {
          if (error || !data?.success || !data?.url) {
            // Cache the miss - no URL found
            // No URL found - cache the miss
            urlCache.set(cacheKey, { url: null, timestamp: Date.now() });
            setUrl(null);
          } else {
            // Cache the hit
            // Found URL - cache the hit
            urlCache.set(cacheKey, { url: data.url, timestamp: Date.now() });
            setUrl(data.url);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[RestaurantLink] Error looking up URL:', err);
        if (!cancelled) {
          setUrl(null);
          setIsLoading(false);
        }
      }
    }
    
    lookupUrl();
    
    return () => {
      cancelled = true;
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
