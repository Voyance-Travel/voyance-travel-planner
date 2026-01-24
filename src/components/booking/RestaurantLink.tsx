/**
 * RestaurantLink Component
 * 
 * Uses AI-powered search (Perplexity) to find the official restaurant website URL.
 * Falls back to Yelp search if no direct URL is found.
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
  return `${name.toLowerCase().trim()}|${destination.toLowerCase().trim()}`;
}

function cleanRestaurantName(name: string): string {
  return name
    .replace(/^(dinner|lunch|breakfast|brunch|meal|dining|drinks?|coffee|dessert)\s*(at|@)?\s*/i, '')
    .replace(/\s*restaurant$/i, '')
    .trim();
}

function generateYelpFallback(restaurantName: string, destination: string): string {
  const cleanName = cleanRestaurantName(restaurantName);
  const searchQuery = encodeURIComponent(cleanName);
  const location = encodeURIComponent(destination);
  return `https://www.yelp.com/search?find_desc=${searchQuery}&find_loc=${location}`;
}

export function RestaurantLink({ restaurantName, destination, className }: RestaurantLinkProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    async function lookupUrl() {
      const cacheKey = getCacheKey(restaurantName, destination);
      
      // Check cache first
      const cached = urlCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        if (!cancelled) {
          if (cached.url) {
            setUrl(cached.url);
            setUsedFallback(false);
          } else {
            setUrl(generateYelpFallback(restaurantName, destination));
            setUsedFallback(true);
          }
          setIsLoading(false);
        }
        return;
      }
      
      try {
        const cleanName = cleanRestaurantName(restaurantName);
        
        const { data, error } = await supabase.functions.invoke('lookup-restaurant-url', {
          body: { restaurantName: cleanName, destination }
        });
        
        if (!cancelled) {
          if (error || !data?.success || !data?.url) {
            // Cache the miss and use fallback
            urlCache.set(cacheKey, { url: null, timestamp: Date.now() });
            setUrl(generateYelpFallback(restaurantName, destination));
            setUsedFallback(true);
          } else {
            // Cache the hit
            urlCache.set(cacheKey, { url: data.url, timestamp: Date.now() });
            setUrl(data.url);
            setUsedFallback(false);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error looking up restaurant URL:', err);
        if (!cancelled) {
          setUrl(generateYelpFallback(restaurantName, destination));
          setUsedFallback(true);
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
      <span className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className || ''}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Finding restaurant...
      </span>
    );
  }

  if (!url) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs text-primary hover:underline ${className || ''}`}
    >
      <ExternalLink className="h-3 w-3" />
      {usedFallback ? 'Find Restaurant' : 'View Restaurant'}
    </a>
  );
}
