import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { destinations as staticDestinations, Destination as StaticDestination } from '@/lib/destinations';
import { searchDestinations as searchDbDestinations } from '@/services/supabase/destinations';

export interface HybridDestination {
  id: string;
  city: string;
  country: string;
  region: string;
  tagline: string;
  imageUrl?: string;
  source: 'featured' | 'database';
}

/**
 * Hybrid search that prioritizes curated static destinations,
 * then supplements with database results
 */
export function useHybridDestinationSearch(query: string, enabled: boolean = true) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Filter static destinations (instant)
  const staticResults = useMemo(() => {
    if (!normalizedQuery) return [];
    
    return staticDestinations
      .filter(d => 
        d.city.toLowerCase().includes(normalizedQuery) || 
        d.country.toLowerCase().includes(normalizedQuery) ||
        d.tagline.toLowerCase().includes(normalizedQuery) ||
        d.region.toLowerCase().includes(normalizedQuery)
      )
      .map(d => ({
        id: d.id,
        city: d.city,
        country: d.country,
        region: d.region,
        tagline: d.tagline,
        imageUrl: d.imageUrl,
        source: 'featured' as const
      }));
  }, [normalizedQuery]);
  
  // Query database for additional results
  const { data: dbResults, isLoading: isLoadingDb } = useQuery({
    queryKey: ['destination-search', normalizedQuery],
    queryFn: async () => {
      if (!normalizedQuery || normalizedQuery.length < 2) return [];
      return searchDbDestinations(normalizedQuery, 20);
    },
    enabled: enabled && normalizedQuery.length >= 2,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
  // Merge and deduplicate results
  const combinedResults = useMemo(() => {
    const seenCities = new Set<string>();
    const results: HybridDestination[] = [];
    
    // Add static results first (featured get priority)
    for (const d of staticResults) {
      const key = d.city.toLowerCase();
      if (!seenCities.has(key)) {
        seenCities.add(key);
        results.push(d);
      }
    }
    
    // Add database results, deduplicating within db results as well
    for (const d of dbResults || []) {
      const key = d.city.toLowerCase();
      if (!seenCities.has(key)) {
        seenCities.add(key);
        results.push({
          id: d.id,
          city: d.city,
          country: d.country || '',
          region: d.region || '',
          tagline: d.description || `Discover ${d.city}`,
          imageUrl: d.stock_image_url || undefined,
          source: 'database' as const
        });
      }
    }
    
    return results;
  }, [staticResults, dbResults]);
  
  return {
    results: combinedResults,
    isLoading: isLoadingDb,
    featuredCount: staticResults.length,
    databaseCount: combinedResults.length - staticResults.length,
  };
}
