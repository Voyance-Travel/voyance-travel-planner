/**
 * Perplexity Enrichment API Service
 * 
 * Provides AI-powered real-time data enrichment for:
 * - Attraction info (hours, prices, closures)
 * - Activity booking URLs
 * - Local events during travel dates
 * - Travel advisories and visa requirements
 */

import { supabase } from '@/integrations/supabase/client';

// ============ TYPES ============

export interface AttractionInfo {
  isOpen: boolean | null;
  isClosed: boolean | null;
  closureReason: string | null;
  openingHours: string | null;
  admissionPrice: string | null;
  priceRange: string | null;
  reservationRequired: boolean | null;
  bookingUrl: string | null;
  website: string | null;
  bestTimeToVisit: string | null;
  currentWaitTime: string | null;
  specialNotes: string | null;
  lastUpdated: string;
}

export interface LocalEvent {
  name: string;
  type: 'festival' | 'concert' | 'exhibition' | 'sports' | 'cultural' | 'market' | 'other';
  dates: string;
  location: string;
  description: string;
  ticketUrl: string | null;
  isFree: boolean;
  priceRange: '$' | '$$' | '$$$' | null;
  isRecurring: boolean;
}

export interface TravelAdvisory {
  visaRequired: boolean;
  visaType: string | null;
  visaDetails: string | null;
  passportValidity: string | null;
  entryRequirements: string[];
  safetyLevel: 'low-risk' | 'moderate' | 'elevated' | 'high-risk';
  safetyAdvisory: string | null;
  healthRequirements: string[];
  covidRestrictions: string | null;
  currencyTips: string | null;
  importantNotes: string[];
  lastUpdated: string;
}

// ============ CACHING ============

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const attractionCache = new Map<string, CacheEntry<AttractionInfo | null>>();
const activityUrlCache = new Map<string, CacheEntry<string | null>>();
const eventsCache = new Map<string, CacheEntry<LocalEvent[]>>();
const advisoryCache = new Map<string, CacheEntry<TravelAdvisory | null>>();

const CACHE_TTL = {
  attraction: 1000 * 60 * 60 * 2,    // 2 hours
  activityUrl: 1000 * 60 * 60 * 24,  // 24 hours
  events: 1000 * 60 * 60 * 6,        // 6 hours
  advisory: 1000 * 60 * 60 * 12,     // 12 hours
};

function getCacheKey(...parts: string[]): string {
  return parts.map(p => p.toLowerCase().trim()).join('|');
}

function isValidCache<T>(entry: CacheEntry<T> | undefined, ttl: number): boolean {
  return !!entry && Date.now() - entry.timestamp < ttl;
}

// ============ API FUNCTIONS ============

/**
 * Get enriched information about an attraction (hours, prices, closures)
 */
export async function enrichAttraction(
  attractionName: string,
  destination: string,
  travelDate?: string
): Promise<{ success: boolean; data: AttractionInfo | null; error?: string }> {
  const cacheKey = getCacheKey(attractionName, destination, travelDate || '');
  const cached = attractionCache.get(cacheKey);
  
  if (isValidCache(cached, CACHE_TTL.attraction)) {
    return { success: true, data: cached!.data };
  }

  try {
    const { data, error } = await supabase.functions.invoke('enrich-attraction', {
      body: { attractionName, destination, travelDate }
    });

    if (error) {
      console.error('Attraction enrichment error:', error);
      return { success: false, data: null, error: error.message };
    }

    if (data?.success && data?.data) {
      attractionCache.set(cacheKey, { data: data.data, timestamp: Date.now() });
      return { success: true, data: data.data };
    }

    return { success: true, data: null };
  } catch (err) {
    console.error('Attraction enrichment failed:', err);
    return { success: false, data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Look up booking/ticket URL for an activity
 */
export async function lookupActivityUrl(
  activityName: string,
  destination: string,
  activityType?: string
): Promise<{ success: boolean; url: string | null; error?: string }> {
  const cacheKey = getCacheKey(activityName, destination, activityType || '');
  const cached = activityUrlCache.get(cacheKey);
  
  if (isValidCache(cached, CACHE_TTL.activityUrl)) {
    return { success: true, url: cached!.data };
  }

  try {
    const { data, error } = await supabase.functions.invoke('lookup-activity-url', {
      body: { activityName, destination, activityType }
    });

    if (error) {
      console.error('Activity URL lookup error:', error);
      return { success: false, url: null, error: error.message };
    }

    if (data?.success) {
      activityUrlCache.set(cacheKey, { data: data.url, timestamp: Date.now() });
      return { success: true, url: data.url };
    }

    return { success: true, url: null };
  } catch (err) {
    console.error('Activity URL lookup failed:', err);
    return { success: false, url: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Find local events during travel dates
 */
export async function lookupLocalEvents(
  destination: string,
  startDate: string,
  endDate: string,
  interests?: string[]
): Promise<{ success: boolean; events: LocalEvent[]; error?: string }> {
  const cacheKey = getCacheKey(destination, startDate, endDate, interests?.join(',') || '');
  const cached = eventsCache.get(cacheKey);
  
  if (isValidCache(cached, CACHE_TTL.events)) {
    return { success: true, events: cached!.data };
  }

  try {
    const { data, error } = await supabase.functions.invoke('lookup-local-events', {
      body: { destination, startDate, endDate, interests }
    });

    if (error) {
      console.error('Local events lookup error:', error);
      return { success: false, events: [], error: error.message };
    }

    if (data?.success && data?.events) {
      eventsCache.set(cacheKey, { data: data.events, timestamp: Date.now() });
      return { success: true, events: data.events };
    }

    return { success: true, events: [] };
  } catch (err) {
    console.error('Local events lookup failed:', err);
    return { success: false, events: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get travel advisory information
 */
export async function lookupTravelAdvisory(
  destination: string,
  originCountry?: string,
  travelDate?: string
): Promise<{ success: boolean; data: TravelAdvisory | null; error?: string }> {
  const cacheKey = getCacheKey(destination, originCountry || 'US', travelDate || '');
  const cached = advisoryCache.get(cacheKey);
  
  if (isValidCache(cached, CACHE_TTL.advisory)) {
    return { success: true, data: cached!.data };
  }

  try {
    const { data, error } = await supabase.functions.invoke('lookup-travel-advisory', {
      body: { destination, originCountry, travelDate }
    });

    if (error) {
      console.error('Travel advisory lookup error:', error);
      return { success: false, data: null, error: error.message };
    }

    if (data?.success && data?.data) {
      advisoryCache.set(cacheKey, { data: data.data, timestamp: Date.now() });
      return { success: true, data: data.data };
    }

    return { success: true, data: null };
  } catch (err) {
    console.error('Travel advisory lookup failed:', err);
    return { success: false, data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============ CACHE MANAGEMENT ============

/**
 * Clear all enrichment caches
 */
export function clearEnrichmentCache(): void {
  attractionCache.clear();
  activityUrlCache.clear();
  eventsCache.clear();
  advisoryCache.clear();
}

/**
 * Clear cache for a specific type
 */
export function clearCacheByType(type: 'attraction' | 'activityUrl' | 'events' | 'advisory'): void {
  switch (type) {
    case 'attraction':
      attractionCache.clear();
      break;
    case 'activityUrl':
      activityUrlCache.clear();
      break;
    case 'events':
      eventsCache.clear();
      break;
    case 'advisory':
      advisoryCache.clear();
      break;
  }
}
