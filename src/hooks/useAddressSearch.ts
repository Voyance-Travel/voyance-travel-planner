/**
 * Hybrid Address Search Hook
 * 1. Nominatim (OpenStreetMap) — free, decent for addresses
 * 2. Falls back to Google Places if user clicks "Search with Google" or no results
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AddressResult {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  source: 'nominatim' | 'google';
}

interface UseAddressSearchReturn {
  results: AddressResult[];
  isSearching: boolean;
  searchNominatim: (query: string, near?: string) => Promise<void>;
  searchGoogle: (query: string, near?: string) => Promise<void>;
  clearResults: () => void;
  hasGoogleFallback: boolean;
}

export function useAddressSearch(): UseAddressSearchReturn {
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const searchNominatim = useCallback(async (query: string, near?: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    try {
      const searchQuery = near ? `${query} ${near}` : query;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`;
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' },
      });

      if (!response.ok) throw new Error('Nominatim search failed');

      const data = await response.json();
      const mapped: AddressResult[] = data.map((item: any) => ({
        name: item.name || item.display_name?.split(',')[0] || query,
        address: item.display_name || '',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        source: 'nominatim' as const,
      }));

      setResults(mapped);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[AddressSearch] Nominatim error:', e);
        setResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  // C-COST-4: route the Google fallback through the server proxy
  // (places-search-proxy) — cached, ceiling-gated, cost-tracked, and the Google
  // key never reaches the browser. The client no longer calls Google directly.
  const searchGoogle = useCallback(async (query: string, near?: string) => {
    if (!query) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('places-search-proxy', {
        body: { query, near, maxResultCount: 5 },
      });

      if (error) throw error;

      const mapped: AddressResult[] = (data?.results ?? []).map((r: any) => ({
        name: r.name || query,
        address: r.address || '',
        lat: r.lat,
        lng: r.lng,
        source: 'google' as const,
      }));

      setResults(mapped);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[AddressSearch] Google proxy error:', e);
        setResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    abortRef.current?.abort();
  }, []);

  return {
    results,
    isSearching,
    searchNominatim,
    searchGoogle,
    clearResults,
    // Google fallback is always available now — it runs server-side via the proxy.
    hasGoogleFallback: true,
  };
}
