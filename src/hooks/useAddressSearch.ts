/**
 * Hybrid Address Search Hook
 * 1. Nominatim (OpenStreetMap) — free, decent for addresses
 * 2. Falls back to Google Places if user clicks "Search with Google" or no results
 */

import { useState, useCallback, useRef } from 'react';
import { GOOGLE_MAPS_API_KEY } from '@/config/api.config';

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

  const searchGoogle = useCallback(async (query: string, near?: string) => {
    if (!query || !GOOGLE_MAPS_API_KEY) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    try {
      const textQuery = near ? `${query} in ${near}` : query;
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
        },
        body: JSON.stringify({ textQuery, maxResultCount: 5 }),
      });

      if (!response.ok) throw new Error('Google Places search failed');

      const data = await response.json();
      const places = data.places || [];

      const mapped: AddressResult[] = places.map((p: any) => ({
        name: p.displayName?.text || query,
        address: p.formattedAddress || '',
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        source: 'google' as const,
      }));

      setResults(mapped);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[AddressSearch] Google error:', e);
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
    hasGoogleFallback: !!GOOGLE_MAPS_API_KEY,
  };
}
