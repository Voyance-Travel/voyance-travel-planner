import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { getCachedPhotoUrl } from "../_shared/photo-storage.ts";
import { trackCost } from "../_shared/cost-tracker.ts";
import { googlePlacesTextSearch } from "../_shared/google-api.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =============================================================================
// TYPES
// =============================================================================

interface RecommendationRequest {
  destination: string;
  coordinates?: { lat: number; lng: number };
  date?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  partySize?: number;
  maxResults?: number;
  budgetLevel?: 'budget' | 'moderate' | 'upscale' | 'fine_dining';
  userId?: string; // For personalization
  minRating?: number; // Minimum star rating to include (default 4.0)
}

interface Restaurant {
  id: string;
  name: string;
  cuisine: string[];
  rating: number;
  reviewCount: number;
  priceLevel: number; // 1-4 ($-$$$$)
  address: string;
  coordinates?: { lat: number; lng: number };
  distance?: number; // meters from search location
  photoUrl?: string;
  website?: string;
  phone?: string;
  openNow?: boolean;
  openingHours?: string[];
  source: 'google' | 'tripadvisor' | 'foursquare';
  sourceId: string;
  dietaryOptions?: string[]; // vegetarian, vegan, halal, etc.
  highlights?: string[]; // "Great for groups", "Romantic", etc.
  reviewSnippets?: string[];
}

interface ScoredRestaurant extends Restaurant {
  personalizedScore: number;
  scoreBreakdown: {
    baseRating: number;
    cuisineMatch: number;
    dietaryFit: number;
    priceFit: number;
    learnedPreference: number;
    popularityBoost: number;
  };
  matchReasons: string[];
}

interface UserPreferences {
  food_likes?: string[];
  food_dislikes?: string[];
  dietary_restrictions?: string[];
  budget_tier?: string;
  taste_graph?: Record<string, unknown>;
}

interface LearnedInsights {
  loved_cuisines: Record<string, number>;
  disliked_cuisines: Record<string, number>;
  loved_categories: Record<string, number>;
  disliked_categories: Record<string, number>;
  avg_rating_given: number;
}

// =============================================================================
// API CLIENTS
// =============================================================================

/**
 * Execute a single Google Places search
 */
async function executeGoogleSearch(
  query: string,
  coordinates: { lat: number; lng: number } | undefined,
  apiKey: string,
  maxResults: number = 20
): Promise<Record<string, unknown>[]> {
  const requestBody: Record<string, unknown> = {
    textQuery: query,
    includedType: 'restaurant',
    maxResultCount: maxResults,
    languageCode: 'en',
  };

  if (coordinates) {
    requestBody.locationBias = {
      circle: {
        center: { latitude: coordinates.lat, longitude: coordinates.lng },
        radius: 8000, // Increased radius to 8km
      },
    };
  }

  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.photos,places.websiteUri,places.nationalPhoneNumber,places.currentOpeningHours,places.types,places.reviews',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    console.error('[Google Places] Search error for query:', query, await response.text());
    return [];
  }

  const data = await response.json();
  return data.places || [];
}

/**
 * Fetch restaurants from Google Places API (New) - Multi-strategy search
 */
async function fetchGooglePlaces(
  destination: string,
  coordinates: { lat: number; lng: number } | undefined,
  mealType: string,
  apiKey: string
): Promise<Restaurant[]> {
  try {
    // Multiple search strategies to find more restaurants
    const searchQueries = [
      // Primary: meal-specific or general restaurants
      `${mealType !== 'any' ? mealType + ' ' : ''}restaurants in ${destination}`,
      // Best/top rated restaurants
      `best restaurants in ${destination}`,
      // Popular restaurants
      `popular restaurants ${destination}`,
      // Fine dining if looking for quality
      `fine dining ${destination}`,
    ];

    // Execute searches in parallel (limit to 3 to avoid rate limits)
    const searchPromises = searchQueries.slice(0, 3).map(query => 
      executeGoogleSearch(query, coordinates, apiKey, 20)
    );

    const results = await Promise.all(searchPromises);
    const allPlaces = results.flat();
    
    // Deduplicate by place ID
    const seenIds = new Set<string>();
    const uniquePlaces: Record<string, unknown>[] = [];
    for (const place of allPlaces) {
      const id = place.id as string;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        uniquePlaces.push(place);
      }
    }

    console.log(`[Google Places] Found ${uniquePlaces.length} unique restaurants from ${searchQueries.length} queries`);

    // Process restaurants with async photo caching
    const restaurants = await Promise.all(uniquePlaces.map(async (place: Record<string, unknown>): Promise<Restaurant> => {
      const displayName = place.displayName as { text: string } | undefined;
      const location = place.location as { latitude: number; longitude: number } | undefined;
      const photos = place.photos as Array<{ name: string }> | undefined;
      const openingHours = place.currentOpeningHours as { weekdayDescriptions?: string[]; openNow?: boolean } | undefined;
      const types = (place.types as string[]) || [];
      const reviews = (place.reviews as Array<{ text?: { text: string } }>) || [];

      // Extract cuisine from types
      const cuisineTypes = types.filter((t: string) =>
        t.includes('restaurant') || t.includes('cuisine') || t.includes('food')
      ).map((t: string) => t.replace(/_/g, ' ').replace(' restaurant', ''));

      // Extract dietary options from types
      const dietaryOptions = types.filter((t: string) =>
        ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free'].some(d => t.includes(d))
      );

      // Get cached photo URL from Supabase Storage (downloads once, serves forever)
      let photoUrl: string | undefined;
      if (photos?.[0]?.name) {
        const googlePhotoUrl = `https://places.googleapis.com/v1/${photos[0].name}/media?maxHeightPx=400&key=${apiKey}`;
        const cacheResult = await getCachedPhotoUrl(
          'restaurant',
          place.id as string,
          googlePhotoUrl,
          { destination, placeName: displayName?.text, placeId: place.id as string }
        );
        photoUrl = cacheResult.url;
      }

      return {
        id: `google_${place.id}`,
        name: displayName?.text || 'Unknown',
        cuisine: cuisineTypes.length > 0 ? cuisineTypes : ['Restaurant'],
        rating: (place.rating as number) || 0,
        reviewCount: (place.userRatingCount as number) || 0,
        priceLevel: parsePriceLevel(place.priceLevel as string),
        address: (place.formattedAddress as string) || '',
        coordinates: location ? { lat: location.latitude, lng: location.longitude } : undefined,
        photoUrl,
        website: place.websiteUri as string | undefined,
        phone: place.nationalPhoneNumber as string | undefined,
        openNow: openingHours?.openNow,
        openingHours: openingHours?.weekdayDescriptions,
        source: 'google',
        sourceId: place.id as string,
        dietaryOptions,
        reviewSnippets: reviews.slice(0, 3).map((r) => r.text?.text || '').filter(Boolean),
      };
    }));
    
    return restaurants;
  } catch (error) {
    console.error('[Google Places] Fetch error:', error);
    return [];
  }
}

function parsePriceLevel(priceLevel: string | undefined): number {
  if (!priceLevel) return 2;
  const mapping: Record<string, number> = {
    'PRICE_LEVEL_FREE': 1,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4,
  };
  return mapping[priceLevel] || 2;
}

/**
 * Fetch restaurants from TripAdvisor API - Enhanced with multiple searches
 */
async function fetchTripAdvisor(
  destination: string,
  coordinates: { lat: number; lng: number } | undefined,
  apiKey: string
): Promise<Restaurant[]> {
  try {
    // Multiple search queries to find more restaurants
    const searchQueries = [
      destination,
      `best restaurants ${destination}`,
      `top rated ${destination}`,
    ];

    const allLocations: Array<{ location_id: string }> = [];
    const seenIds = new Set<string>();

    // Execute multiple searches
    for (const query of searchQueries) {
      const searchParams = new URLSearchParams({
        searchQuery: query,
        category: 'restaurants',
        language: 'en',
      });

      if (coordinates) {
        searchParams.set('latLong', `${coordinates.lat},${coordinates.lng}`);
      }

      try {
        const searchResponse = await fetch(
          `https://api.content.tripadvisor.com/api/v1/location/search?${searchParams.toString()}&key=${apiKey}`,
          { headers: { accept: 'application/json' } }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const locations = searchData.data || [];
          
          for (const loc of locations) {
            if (loc.location_id && !seenIds.has(loc.location_id)) {
              seenIds.add(loc.location_id);
              allLocations.push(loc);
            }
          }
        }
      } catch (err) {
        console.error(`[TripAdvisor] Search error for "${query}":`, err);
      }
    }

    console.log(`[TripAdvisor] Found ${allLocations.length} unique locations from ${searchQueries.length} queries`);

    // Fetch details for each restaurant (increased limit to 25)
    const restaurants: Restaurant[] = [];

    for (const loc of allLocations.slice(0, 25)) {
      if (loc.location_id) {
        try {
          const detailsResponse = await fetch(
            `https://api.content.tripadvisor.com/api/v1/location/${loc.location_id}/details?key=${apiKey}&language=en&currency=USD`,
            { headers: { accept: 'application/json' } }
          );

          if (detailsResponse.ok) {
            const details = await detailsResponse.json();

            restaurants.push({
              id: `tripadvisor_${details.location_id}`,
              name: details.name || 'Unknown',
              cuisine: (details.cuisine || []).map((c: { name: string }) => c.name),
              rating: parseFloat(details.rating) || 0,
              reviewCount: parseInt(details.num_reviews) || 0,
              priceLevel: details.price_level ? details.price_level.length : 2,
              address: details.address_obj?.address_string || '',
              coordinates: details.latitude && details.longitude
                ? { lat: parseFloat(details.latitude), lng: parseFloat(details.longitude) }
                : undefined,
              photoUrl: details.photo?.images?.medium?.url,
              website: details.website,
              phone: details.phone,
              openNow: undefined,
              openingHours: details.hours?.week_ranges?.map((r: { open_time: number; close_time: number }[]) =>
                r.map(t => `${t.open_time}-${t.close_time}`).join(', ')
              ),
              source: 'tripadvisor',
              sourceId: details.location_id,
              dietaryOptions: (details.dietary_restrictions || []).map((d: { name: string }) => d.name.toLowerCase()),
              highlights: (details.features || []).slice(0, 5),
              reviewSnippets: details.review_rating_count
                ? [`${details.review_rating_count['5'] || 0} excellent reviews`]
                : undefined,
            });
          }
        } catch (err) {
          console.error(`[TripAdvisor] Details error for ${loc.location_id}:`, err);
        }
      }
    }

    return restaurants;
  } catch (error) {
    console.error('[TripAdvisor] Fetch error:', error);
    return [];
  }
}

/**
 * Fetch restaurants from Foursquare API - Enhanced with multiple queries
 */
async function fetchFoursquare(
  destination: string,
  coordinates: { lat: number; lng: number } | undefined,
  apiKey: string
): Promise<Restaurant[]> {
  try {
    // Multiple search queries for better coverage
    const searchQueries = ['restaurant', 'best restaurant'];
    const allResults: Array<Record<string, unknown>> = [];
    const seenIds = new Set<string>();

    for (const query of searchQueries) {
      const params = new URLSearchParams({
        query,
        near: destination,
        categories: '13065', // Restaurants category
        limit: '30', // Increased from 20 to 30
        sort: 'RATING', // Sort by rating to get better results first
        fields: 'fsq_id,name,categories,rating,stats,price,location,photos,website,tel,hours,features,tastes,tips',
      });

      if (coordinates) {
        params.set('ll', `${coordinates.lat},${coordinates.lng}`);
        params.delete('near');
      }

      try {
        const response = await fetch(
          `https://api.foursquare.com/v3/places/search?${params.toString()}`,
          {
            headers: {
              Authorization: apiKey,
              accept: 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const results = data.results || [];
          
          for (const place of results) {
            const id = place.fsq_id as string;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              allResults.push(place);
            }
          }
        }
      } catch (err) {
        console.error(`[Foursquare] Search error for "${query}":`, err);
      }
    }

    console.log(`[Foursquare] Found ${allResults.length} unique restaurants from ${searchQueries.length} queries`);

    return allResults.map((place: Record<string, unknown>): Restaurant => {
      const categories = (place.categories as Array<{ name: string; short_name: string }>) || [];
      const location = place.location as { address?: string; formatted_address?: string; latitude?: number; longitude?: number } | undefined;
      const photos = place.photos as Array<{ prefix: string; suffix: string }> | undefined;
      const stats = place.stats as { total_ratings?: number } | undefined;
      const hours = place.hours as { display?: string } | undefined;
      const features = place.features as { dietary?: string[] } | undefined;
      const tips = place.tips as Array<{ text: string }> | undefined;

      return {
        id: `foursquare_${place.fsq_id}`,
        name: (place.name as string) || 'Unknown',
        cuisine: categories.map(c => c.short_name || c.name),
        rating: ((place.rating as number) || 0) / 2, // Foursquare uses 0-10 scale
        reviewCount: stats?.total_ratings || 0,
        priceLevel: (place.price as number) || 2,
        address: location?.formatted_address || location?.address || '',
        coordinates: location?.latitude && location?.longitude
          ? { lat: location.latitude, lng: location.longitude }
          : undefined,
        photoUrl: photos?.[0]
          ? `${photos[0].prefix}400x300${photos[0].suffix}`
          : undefined,
        website: place.website as string | undefined,
        phone: place.tel as string | undefined,
        openNow: undefined,
        openingHours: hours?.display ? [hours.display] : undefined,
        source: 'foursquare',
        sourceId: place.fsq_id as string,
        dietaryOptions: features?.dietary || [],
        highlights: (place.tastes as string[])?.slice(0, 5),
        reviewSnippets: tips?.slice(0, 3).map(t => t.text),
      };
    });
  } catch (error) {
    console.error('[Foursquare] Fetch error:', error);
    return [];
  }
}

// =============================================================================
// USER PREFERENCES & LEARNING
// =============================================================================

// deno-lint-ignore no-explicit-any
async function getUserPreferences(
  supabase: any,
  userId: string
): Promise<UserPreferences | null> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('food_likes, food_dislikes, dietary_restrictions, budget_tier, taste_graph')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[Preferences] Error fetching:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Preferences] Fetch error:', error);
    return null;
  }
}

interface FeedbackRow {
  rating: string;
  activity_type: string | null;
  activity_category: string | null;
  feedback_tags: string[] | null;
}

// deno-lint-ignore no-explicit-any
async function getLearnedInsights(
  supabase: any,
  userId: string
): Promise<LearnedInsights | null> {
  try {
    // Get all activity feedback for restaurants/dining
    const { data: feedback, error } = await supabase
      .from('activity_feedback')
      .select('rating, activity_type, activity_category, feedback_tags')
      .eq('user_id', userId)
      .or('activity_category.ilike.%restaurant%,activity_category.ilike.%food%,activity_category.ilike.%dining%,activity_type.ilike.%meal%,activity_type.ilike.%eat%');

    if (error || !feedback?.length) {
      return null;
    }

    const insights: LearnedInsights = {
      loved_cuisines: {},
      disliked_cuisines: {},
      loved_categories: {},
      disliked_categories: {},
      avg_rating_given: 0,
    };

    let totalRatings = 0;
    let ratingSum = 0;

    for (const fb of feedback as FeedbackRow[]) {
      const isPositive = fb.rating === 'loved' || fb.rating === 'liked';
      const isNegative = fb.rating === 'disliked';

      // Extract cuisine from tags or category
      const cuisineTag = (fb.feedback_tags || []).find((t: string) =>
        t.toLowerCase().includes('cuisine') || ['italian', 'japanese', 'mexican', 'indian', 'thai', 'chinese', 'french', 'american', 'mediterranean'].some(c => t.toLowerCase().includes(c))
      );

      if (cuisineTag) {
        if (isPositive) {
          insights.loved_cuisines[cuisineTag] = (insights.loved_cuisines[cuisineTag] || 0) + 1;
        } else if (isNegative) {
          insights.disliked_cuisines[cuisineTag] = (insights.disliked_cuisines[cuisineTag] || 0) + 1;
        }
      }

      // Category tracking
      if (fb.activity_category) {
        if (isPositive) {
          insights.loved_categories[fb.activity_category] = (insights.loved_categories[fb.activity_category] || 0) + 1;
        } else if (isNegative) {
          insights.disliked_categories[fb.activity_category] = (insights.disliked_categories[fb.activity_category] || 0) + 1;
        }
      }

      // Calculate average rating
      const ratingValue = fb.rating === 'loved' ? 5 : fb.rating === 'liked' ? 4 : fb.rating === 'neutral' ? 3 : 2;
      ratingSum += ratingValue;
      totalRatings++;
    }

    insights.avg_rating_given = totalRatings > 0 ? ratingSum / totalRatings : 3.5;

    return insights;
  } catch (error) {
    console.error('[LearnedInsights] Error:', error);
    return null;
  }
}

// =============================================================================
// SCORING ENGINE
// =============================================================================

function scoreRestaurant(
  restaurant: Restaurant,
  preferences: UserPreferences | null,
  insights: LearnedInsights | null,
  budgetLevel: string | undefined
): ScoredRestaurant {
  const scoreBreakdown = {
    baseRating: 0,
    cuisineMatch: 0,
    dietaryFit: 0,
    priceFit: 0,
    learnedPreference: 0,
    popularityBoost: 0,
  };
  const matchReasons: string[] = [];

  // 1. BASE RATING (0-25 points)
  // Normalize rating to 0-25 scale
  scoreBreakdown.baseRating = (restaurant.rating / 5) * 25;
  if (restaurant.rating >= 4.5) {
    matchReasons.push(`Exceptional ${restaurant.rating}★ rating`);
  } else if (restaurant.rating >= 4.0) {
    matchReasons.push(`Highly rated (${restaurant.rating}★)`);
  }

  // 2. CUISINE MATCH (0-25 points)
  if (preferences?.food_likes?.length) {
    const cuisineLower = restaurant.cuisine.map(c => c.toLowerCase());
    const matchedLikes = preferences.food_likes.filter(like =>
      cuisineLower.some(c => c.includes(like.toLowerCase()) || like.toLowerCase().includes(c))
    );
    if (matchedLikes.length > 0) {
      scoreBreakdown.cuisineMatch = Math.min(25, matchedLikes.length * 12);
      matchReasons.push(`Matches your love for ${matchedLikes.slice(0, 2).join(', ')}`);
    }
  }

  // Check for disliked cuisines (penalty)
  if (preferences?.food_dislikes?.length) {
    const cuisineLower = restaurant.cuisine.map(c => c.toLowerCase());
    const matchedDislikes = preferences.food_dislikes.filter(dislike =>
      cuisineLower.some(c => c.includes(dislike.toLowerCase()))
    );
    if (matchedDislikes.length > 0) {
      scoreBreakdown.cuisineMatch -= matchedDislikes.length * 15;
    }
  }

  // 3. DIETARY FIT (0-20 points)
  if (preferences?.dietary_restrictions?.length) {
    const restrictions = preferences.dietary_restrictions.map(r => r.toLowerCase());
    const options = (restaurant.dietaryOptions || []).map(o => o.toLowerCase());

    const matchedRestrictions = restrictions.filter(r =>
      options.some(o => o.includes(r) || r.includes(o))
    );

    if (matchedRestrictions.length > 0) {
      scoreBreakdown.dietaryFit = 20;
      matchReasons.push(`Accommodates ${matchedRestrictions.join(', ')}`);
    } else if (restrictions.length > 0) {
      // No dietary info, neutral score
      scoreBreakdown.dietaryFit = 5;
    }
  } else {
    scoreBreakdown.dietaryFit = 10; // Neutral if no restrictions
  }

  // 4. PRICE FIT (0-15 points)
  const userBudget = budgetLevel || preferences?.budget_tier || 'moderate';
  const budgetToPrice: Record<string, number> = {
    'budget': 1,
    'moderate': 2,
    'upscale': 3,
    'fine_dining': 4,
    'premium': 3,
    'luxury': 4,
  };
  const targetPrice = budgetToPrice[userBudget] || 2;
  const priceDiff = Math.abs(restaurant.priceLevel - targetPrice);

  if (priceDiff === 0) {
    scoreBreakdown.priceFit = 15;
    matchReasons.push(`Perfect for your budget`);
  } else if (priceDiff === 1) {
    scoreBreakdown.priceFit = 10;
  } else {
    scoreBreakdown.priceFit = 5;
  }

  // 5. LEARNED PREFERENCE (0-10 points)
  if (insights) {
    const cuisineLower = restaurant.cuisine.map(c => c.toLowerCase());

    // Boost for loved cuisines
    for (const [cuisine, count] of Object.entries(insights.loved_cuisines)) {
      if (cuisineLower.some(c => c.includes(cuisine.toLowerCase()))) {
        scoreBreakdown.learnedPreference += Math.min(5, count * 2);
        matchReasons.push(`You've loved ${cuisine} before`);
        break;
      }
    }

    // Penalty for disliked cuisines
    for (const [cuisine, count] of Object.entries(insights.disliked_cuisines)) {
      if (cuisineLower.some(c => c.includes(cuisine.toLowerCase()))) {
        scoreBreakdown.learnedPreference -= Math.min(10, count * 3);
        break;
      }
    }
  }

  // 6. POPULARITY BOOST (0-5 points)
  if (restaurant.reviewCount > 1000) {
    scoreBreakdown.popularityBoost = 5;
    matchReasons.push(`Popular choice (${restaurant.reviewCount.toLocaleString()} reviews)`);
  } else if (restaurant.reviewCount > 500) {
    scoreBreakdown.popularityBoost = 3;
  } else if (restaurant.reviewCount > 100) {
    scoreBreakdown.popularityBoost = 2;
  }

  // Calculate total personalized score
  const personalizedScore = Math.max(0, Math.min(100,
    scoreBreakdown.baseRating +
    scoreBreakdown.cuisineMatch +
    scoreBreakdown.dietaryFit +
    scoreBreakdown.priceFit +
    scoreBreakdown.learnedPreference +
    scoreBreakdown.popularityBoost
  ));

  return {
    ...restaurant,
    personalizedScore: Math.round(personalizedScore),
    scoreBreakdown,
    matchReasons: matchReasons.slice(0, 4),
  };
}

// =============================================================================
// DEDUPLICATION & MERGING
// =============================================================================

function deduplicateRestaurants(restaurants: Restaurant[]): Restaurant[] {
  const seen = new Map<string, Restaurant>();

  for (const r of restaurants) {
    // Create a normalized key for deduplication
    const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, r);
    } else {
      // Keep the one with more reviews or higher rating
      if (r.reviewCount > existing.reviewCount || (r.reviewCount === existing.reviewCount && r.rating > existing.rating)) {
        seen.set(key, r);
      }
    }
  }

  return Array.from(seen.values());
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  const costTracker = trackCost('recommend_restaurants', 'google/places-api');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RecommendationRequest = await req.json();
    const {
      destination,
      coordinates,
      mealType = 'any',
      maxResults = 10,
      budgetLevel,
      userId,
      minRating = 4.0, // Default to 4+ stars
    } = body;

    console.log(`[recommend-restaurants] Request for ${destination}, meal: ${mealType}`);

    // Get API keys
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const TRIPADVISOR_API_KEY = Deno.env.get('TRIPADVISOR_API_KEY');
    const FOURSQUARE_API_KEY = Deno.env.get('FOURSQUARE_API_KEY');

    // Initialize Supabase for user preferences
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch from all available APIs in parallel
    const apiPromises: Promise<Restaurant[]>[] = [];

    if (GOOGLE_MAPS_API_KEY) {
      console.log('[recommend-restaurants] Fetching from Google Places...');
      apiPromises.push(fetchGooglePlaces(destination, coordinates, mealType, GOOGLE_MAPS_API_KEY));
    }

    if (TRIPADVISOR_API_KEY) {
      console.log('[recommend-restaurants] Fetching from TripAdvisor...');
      apiPromises.push(fetchTripAdvisor(destination, coordinates, TRIPADVISOR_API_KEY));
    }

    if (FOURSQUARE_API_KEY) {
      console.log('[recommend-restaurants] Fetching from Foursquare...');
      apiPromises.push(fetchFoursquare(destination, coordinates, FOURSQUARE_API_KEY));
    }

    // Fetch user preferences and learned insights in parallel
    let preferences: UserPreferences | null = null;
    let insights: LearnedInsights | null = null;

    if (userId) {
      const [prefs, learned] = await Promise.all([
        getUserPreferences(supabase, userId),
        getLearnedInsights(supabase, userId),
      ]);
      preferences = prefs;
      insights = learned;
      console.log(`[recommend-restaurants] User preferences loaded: ${!!preferences}, Insights: ${!!insights}`);
    }

    // Wait for all API results
    const apiResults = await Promise.all(apiPromises);
    const allRestaurants = apiResults.flat();

    console.log(`[recommend-restaurants] Fetched ${allRestaurants.length} total restaurants`);

    // Deduplicate
    const uniqueRestaurants = deduplicateRestaurants(allRestaurants);
    console.log(`[recommend-restaurants] ${uniqueRestaurants.length} unique restaurants after dedup`);

    // Filter by minimum rating
    const filteredByRating = uniqueRestaurants.filter(r => r.rating >= minRating);
    console.log(`[recommend-restaurants] ${filteredByRating.length} restaurants with ${minRating}+ stars`);

    // Score each restaurant
    const scoredRestaurants = filteredByRating
      .map(r => scoreRestaurant(r, preferences, insights, budgetLevel))
      .sort((a, b) => b.personalizedScore - a.personalizedScore)
      .slice(0, maxResults);

    console.log(`[recommend-restaurants] Returning top ${scoredRestaurants.length} recommendations`);

    // Track cost - estimate Google Places calls based on restaurants found
    const googleCallCount = GOOGLE_MAPS_API_KEY ? Math.ceil(allRestaurants.filter(r => r.source === 'google').length / 20) : 0;
    costTracker.recordGooglePlaces(googleCallCount);
    if (userId) costTracker.setUserId(userId);
    await costTracker.save();

    return new Response(
      JSON.stringify({
        success: true,
        destination,
        mealType,
        count: scoredRestaurants.length,
        recommendations: scoredRestaurants,
        personalizationApplied: !!preferences || !!insights,
        sources: {
          google: !!GOOGLE_MAPS_API_KEY,
          tripadvisor: !!TRIPADVISOR_API_KEY,
          foursquare: !!FOURSQUARE_API_KEY,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[recommend-restaurants] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recommendations',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
