import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Viator Product Search Edge Function
 * 
 * Searches for bookable Viator products matching an activity name and destination.
 * Returns the best matching product with booking details.
 */

interface SearchRequest {
  activityName: string;
  destination: string;
  category?: string;
  date?: string;
  travelers?: number;
  limit?: number;
}

interface ViatorProduct {
  productCode: string;
  title: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
  };
  duration?: {
    fixedDurationInMinutes?: number;
    variableDurationFromMinutes?: number;
    variableDurationToMinutes?: number;
  };
  images?: Array<{
    variants: Array<{
      url: string;
      width: number;
    }>;
  }>;
  rating?: number;
  reviewCount?: number;
  bookingInfo?: {
    url: string;
  };
  flags?: string[];
  productUrl?: string;
}

interface SearchResult {
  productCode: string;
  title: string;
  matchScore: number;
  price: number;
  priceCents: number;
  currency: string;
  priceFormatted: string;
  duration?: string;
  durationMinutes?: number;
  rating?: number;
  reviewCount?: number;
  bookingUrl: string;
  imageUrl?: string;
  isBookable: boolean;
}

const log = (msg: string, data?: any) => {
  console.log(`[viator-search] ${msg}`, data ? JSON.stringify(data) : '');
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

const formatPrice = (amount: number, currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
    AUD: 'A$', CAD: 'C$', CHF: 'CHF', MXN: 'MX$', BRL: 'R$',
  };
  const symbol = symbols[currency.toUpperCase()] || currency + ' ';
  return `${symbol}${amount.toFixed(2)}`;
};

/**
 * Calculate how well a Viator product matches the requested activity
 */
function calculateMatchScore(productTitle: string, activityName: string, destination: string): number {
  const normalizedProduct = productTitle.toLowerCase().trim();
  const normalizedActivity = activityName.toLowerCase().trim();
  const normalizedDest = destination.toLowerCase().trim();
  
  // Extract key words from activity name (excluding common words)
  const stopWords = ['the', 'a', 'an', 'in', 'at', 'to', 'of', 'for', 'with', 'visit', 'tour', 'experience'];
  const activityWords = normalizedActivity
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  let score = 0;
  
  // Exact match bonus
  if (normalizedProduct.includes(normalizedActivity)) {
    score += 50;
  }
  
  // Word matching
  for (const word of activityWords) {
    if (normalizedProduct.includes(word)) {
      score += 15;
    }
  }
  
  // Destination match
  if (normalizedProduct.includes(normalizedDest)) {
    score += 10;
  }
  
  // Key attraction names (e.g., "Colosseum", "Louvre", "Vatican")
  const landmarks = ['colosseum', 'louvre', 'vatican', 'sistine', 'eiffel', 'tower', 'museum', 
                     'palace', 'cathedral', 'basilica', 'gallery', 'castle', 'gardens'];
  for (const landmark of landmarks) {
    if (normalizedActivity.includes(landmark) && normalizedProduct.includes(landmark)) {
      score += 20;
    }
  }
  
  // Penalize generic tours
  if (normalizedProduct.includes('hop-on hop-off') && !normalizedActivity.includes('hop')) {
    score -= 10;
  }
  
  return Math.min(100, Math.max(0, score));
}

async function searchViatorProducts(
  activityName: string,
  destination: string,
  apiKey: string,
  category?: string,
  limit = 5
): Promise<SearchResult[]> {
  try {
    const url = 'https://api.viator.com/partner/products/search';
    
    log('Searching Viator products', { activityName, destination, category });
    
    // Build search text
    const searchText = `${activityName} ${destination}`;
    
    // Map category to Viator tags
    const tagMap: Record<string, string[]> = {
      'sightseeing': ['sightseeing', 'tours'],
      'cultural': ['cultural-tours', 'museums-galleries', 'historic-sites'],
      'adventure': ['adventure', 'outdoor-activities'],
      'food': ['food-tours', 'dining-experiences', 'cooking-classes'],
      'nature': ['nature-wildlife', 'day-trips-excursions'],
      'entertainment': ['shows-concerts', 'nightlife'],
      'water': ['water-sports', 'cruises-boat-tours'],
    };
    
    const tags = category ? tagMap[category.toLowerCase()] || [] : [];
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json;version=2.0',
        'Content-Type': 'application/json',
        'exp-api-key': apiKey,
      },
      body: JSON.stringify({
        filtering: {
          destination: destination,
          searchTerm: activityName,
          ...(tags.length > 0 && { tags }),
        },
        pagination: {
          start: 1,
          count: limit * 2, // Fetch more to filter
        },
        sorting: {
          sort: 'TRAVELER_RATING',
          order: 'DESCENDING',
        },
        currency: 'USD',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log('Viator API error', { status: response.status, error: errorText });
      return [];
    }

    const data = await response.json();
    const products: ViatorProduct[] = data.products || [];
    
    log('Found products', { count: products.length });

    // Score and sort products by match quality
    const scoredProducts = products.map(product => ({
      product,
      score: calculateMatchScore(product.title, activityName, destination),
    }))
    .filter(p => p.score >= 25) // Minimum match threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    return scoredProducts.map(({ product, score }) => {
      const durationMinutes = product.duration?.fixedDurationInMinutes || 
                              product.duration?.variableDurationFromMinutes;
      
      return {
        productCode: product.productCode,
        title: product.title,
        matchScore: score,
        price: product.price?.amount || 0,
        priceCents: Math.round((product.price?.amount || 0) * 100),
        currency: product.price?.currency || 'USD',
        priceFormatted: formatPrice(product.price?.amount || 0, product.price?.currency || 'USD'),
        duration: durationMinutes ? formatDuration(durationMinutes) : undefined,
        durationMinutes,
        rating: product.rating,
        reviewCount: product.reviewCount,
        bookingUrl: product.productUrl || `https://www.viator.com/tours/${product.productCode}`,
        imageUrl: product.images?.[0]?.variants?.find(v => v.width >= 300)?.url,
        isBookable: true,
      };
    });
  } catch (error) {
    log('Search error', { error: String(error) });
    return [];
  }
}

// ── In-memory 24h cache (warm-instance scope) ──────────────────────────────
// Same (activityName + destination + category) within 24h returns cached results
// at $0. Survives across requests on the same edge runtime instance.
interface CacheEntry { ts: number; results: SearchResult[]; }
const VIATOR_CACHE = new Map<string, CacheEntry>();
const VIATOR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VIATOR_CACHE_MAX = 500;

function cacheKey(activityName: string, destination: string, category?: string): string {
  return [activityName, destination, category || '']
    .map(s => s.toLowerCase().trim().replace(/\s+/g, ' '))
    .join('|');
}

function getCached(key: string): SearchResult[] | null {
  const entry = VIATOR_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > VIATOR_CACHE_TTL_MS) {
    VIATOR_CACHE.delete(key);
    return null;
  }
  return entry.results;
}

function setCached(key: string, results: SearchResult[]): void {
  if (VIATOR_CACHE.size >= VIATOR_CACHE_MAX) {
    // Drop oldest ~10% to keep map bounded
    const drop = Math.ceil(VIATOR_CACHE_MAX * 0.1);
    let i = 0;
    for (const k of VIATOR_CACHE.keys()) {
      VIATOR_CACHE.delete(k);
      if (++i >= drop) break;
    }
  }
  VIATOR_CACHE.set(key, { ts: Date.now(), results });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('viator_search', 'viator');

  try {
    const apiKey = Deno.env.get('VIATOR_API_KEY');
    if (!apiKey) {
      throw new Error('VIATOR_API_KEY not configured');
    }

    const body: (SearchRequest & { tripId?: string; userId?: string }) = await req.json();
    const { activityName, destination, category, limit = 3, tripId, userId } = body;

    if (!activityName || !destination) {
      throw new Error('activityName and destination are required');
    }

    // Attribution — so we can see who's driving spikes
    if (tripId) costTracker.setTripId?.(tripId);
    if (userId) costTracker.setUserId?.(userId);
    const referrer = req.headers.get('referer') || req.headers.get('origin') || 'unknown';
    log('Search request', { activityName, destination, category, tripId, userId, referrer });

    // ── Cache check ─────────────────────────────────────────────────────────
    const key = cacheKey(activityName, destination, category);
    const cached = getCached(key);
    if (cached) {
      log('Cache hit (24h)', { key, results: cached.length });
      // Skip costTracker.save() — billable=0 will skip the row automatically.
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          bestMatch: cached[0] || null,
          alternatives: cached.slice(1),
          totalFound: cached.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = await searchViatorProducts(
      activityName,
      destination,
      apiKey,
      category,
      limit
    );

    // Cache (even empty results — they're a valid negative for 24h)
    setCached(key, results);

    // Return best match and alternatives
    const bestMatch = results[0] || null;
    const alternatives = results.slice(1);

    log('Search complete', {
      bestMatch: bestMatch?.productCode,
      matchScore: bestMatch?.matchScore,
      alternatives: alternatives.length,
    });

    costTracker.addMetadata('results_count', results.length);
    costTracker.addMetadata('query', activityName);
    costTracker.addMetadata('destination', destination);
    costTracker.addMetadata('referrer', referrer);
    // Viator API cost: ~$0.005 per search call (partner tier estimate)
    costTracker.recordPerplexity(1);
    await costTracker.save();

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        bestMatch,
        alternatives,
        totalFound: results.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    log('Error', { error: String(error) });
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
