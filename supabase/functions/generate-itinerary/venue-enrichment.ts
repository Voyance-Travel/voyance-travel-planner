/**
 * Venue Enrichment Pipeline — Shared module for venue verification, caching,
 * photo fetching, Viator matching, and activity enrichment.
 *
 * Used by both generate-full (index.ts) and action-generate-day.ts.
 */

import type { StrictActivity, StrictDay, VenueVerification, CachedVenue, EnrichmentStats } from './generation-types.ts';
import { normalizeVenueName, haversineDistanceKm } from './generation-utils.ts';
import { googleGeocode, googlePlacesTextSearch } from '../_shared/google-api.ts';

// =============================================================================
// HOTEL PROXIMITY GUARD — Tight radius for water-bound / car-free destinations
// =============================================================================

/** Max km from hotel for venues in car-free / water-bound destinations */
const TIGHT_RADIUS_DESTINATIONS: Record<string, number> = {
  'venice': 5,      // Island — no cars, no mainland venues
  'murano': 3,
  'burano': 3,
  'santorini': 8,
  'hydra': 4,
  'mykonos': 8,
  'capri': 5,
  'macau': 6,
};
const DEFAULT_HOTEL_RADIUS_KM = 15;

// =============================================================================
// VENUE NAME OVERLAP — Detect mismatched Places API results
// =============================================================================

/** Returns word-overlap ratio (0..1) between original and enriched venue names */
function computeNameOverlap(original: string, enriched: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[''`´]/g, "'").replace(/[^a-z0-9\s'éèêëàâäùûüôöîïçñ]/g, ' ').trim();
  const toWords = (s: string) => normalize(s).split(/\s+/).filter(w => w.length > 2);

  const origWords = toWords(original);
  const enrichWords = toWords(enriched);

  if (origWords.length === 0) return 1; // no words to compare, allow

  const matches = origWords.filter(ow =>
    enrichWords.some(ew => ew.includes(ow) || ow.includes(ew))
  );
  return matches.length / origWords.length;
}

// =============================================================================
// DESTINATION CENTER CACHE (module-level singleton)
// =============================================================================

const destinationCenterCache = new Map<string, { lat: number; lng: number } | null>();

// =============================================================================
// VENUE CACHE — Read / Write
// =============================================================================

export async function checkVenueCache(
  venueName: string,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<CachedVenue | null> {
  try {
    const normalizedName = normalizeVenueName(venueName);
    const normalizedDest = destination.toLowerCase().trim();

    const response = await fetch(
      `${supabaseUrl}/rest/v1/verified_venues?normalized_name=eq.${encodeURIComponent(normalizedName)}&destination=ilike.%25${encodeURIComponent(normalizedDest)}%25&expires_at=gt.${new Date().toISOString()}&select=*&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0) {
      console.log(`[Stage 4] ✅ Cache HIT for "${venueName}" in ${destination}`);

      // Update usage stats (fire and forget)
      fetch(`${supabaseUrl}/rest/v1/verified_venues?id=eq.${data[0].id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          usage_count: (data[0].usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      }).catch(() => {});

      return data[0];
    }

    return null;
  } catch (e) {
    console.log(`[Stage 4] Cache check error for "${venueName}":`, e);
    return null;
  }
}

export async function cacheVerifiedVenue(
  venueName: string,
  destination: string,
  category: string,
  verification: VenueVerification,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  try {
    const normalizedName = normalizeVenueName(venueName);

    const venueData = {
      name: venueName,
      normalized_name: normalizedName,
      destination: destination.toLowerCase().trim(),
      category: category.toLowerCase(),
      address: verification.formattedAddress || null,
      coordinates: verification.coordinates || null,
      google_place_id: verification.placeId || null,
      rating: verification.rating?.value || null,
      total_reviews: verification.rating?.totalReviews || null,
      price_level: verification.priceLevel || null,
      website: verification.website || null,
      verification_source: verification.sourceProvider || 'google_places',
      verification_confidence: verification.confidence,
      last_verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/verified_venues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(venueData),
    });

    if (response.ok) {
      console.log(`[Stage 4] ✅ Cached venue: "${venueName}" in ${destination}`);
    }
  } catch (e) {
    console.log(`[Stage 4] Cache write error for "${venueName}":`, e);
  }
}

// =============================================================================
// GEOCODE DESTINATION CENTER
// =============================================================================

export async function getDestinationCenter(
  destination: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  // apiKey is read by the wrapper internally; we keep the param for signature
  // compatibility with the many existing callers.
  void apiKey;
  const result = await googleGeocode(
    { address: destination },
    { actionType: 'venue_enrichment_geocode', reason: `dest center: ${destination}` },
  );
  if (!result.ok) return null;
  const loc = result.data?.results?.[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

// =============================================================================
// GOOGLE PLACES VERIFICATION
// =============================================================================

export async function verifyVenueWithGooglePlaces(
  venueName: string,
  destination: string,
  GOOGLE_MAPS_API_KEY: string | undefined,
  hotelCoordinates?: { lat: number; lng: number }
): Promise<VenueVerification | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log('[Stage 4] Google Maps API key not configured, skipping venue verification');
    return null;
  }

  try {
    // Get destination center for location biasing (cached)
    let destCenter = destinationCenterCache.get(destination);
    if (destCenter === undefined) {
      destCenter = await getDestinationCenter(destination, GOOGLE_MAPS_API_KEY);
      destinationCenterCache.set(destination, destCenter);
    }

    const textQuery = `${venueName} ${destination}`;
    console.log(`[Stage 4] Verifying venue: ${venueName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const requestBody: Record<string, unknown> = {
      textQuery,
      maxResultCount: 1,
    };

    if (destCenter) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: destCenter.lat, longitude: destCenter.lng },
          radius: 30000.0,
        },
      };
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.websiteUri,places.googleMapsUri',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Stage 4] Google Places API error for "${venueName}":`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    const place = data.places?.[0];

    if (!place) {
      console.log(`[Stage 4] No place found for: ${venueName}`);
      return null;
    }

    // Distance guard — reject venues too far from destination
    if (destCenter && place.location) {
      const distKm = haversineDistanceKm(
        destCenter.lat,
        destCenter.lng,
        place.location.latitude,
        place.location.longitude
      );
      if (distKm > 50) {
        console.log(
          `[Stage 4] ❌ REJECTED venue "${venueName}" → "${place.displayName?.text}" is ${distKm.toFixed(0)}km from ${destination} (max 50km)`
        );
        return null;
      }
    }

    // Hotel proximity guard — reject venues unreachable from hotel
    if (hotelCoordinates && place.location) {
      const destLower = destination.toLowerCase();
      const tightRadius = Object.entries(TIGHT_RADIUS_DESTINATIONS)
        .find(([key]) => destLower.includes(key))?.[1];
      const maxRadius = tightRadius ?? DEFAULT_HOTEL_RADIUS_KM;

      const hotelDistKm = haversineDistanceKm(
        hotelCoordinates.lat, hotelCoordinates.lng,
        place.location.latitude, place.location.longitude
      );
      if (hotelDistKm > maxRadius) {
        console.log(
          `[Stage 4] ❌ REJECTED venue "${venueName}" → ${hotelDistKm.toFixed(1)}km from hotel (max ${maxRadius}km for ${destination})`
        );
        return null;
      }
    }

    const mapPriceLevel = (priceLevel: string): number => {
      const mapping: Record<string, number> = {
        PRICE_LEVEL_FREE: 0,
        PRICE_LEVEL_INEXPENSIVE: 1,
        PRICE_LEVEL_MODERATE: 2,
        PRICE_LEVEL_EXPENSIVE: 3,
        PRICE_LEVEL_VERY_EXPENSIVE: 4,
      };
      return mapping[priceLevel] ?? 2;
    };

    // Name mismatch guard — reduce confidence if Places returned a different venue
    const enrichedDisplayName = place.displayName?.text || '';
    const nameOverlap = computeNameOverlap(venueName, enrichedDisplayName);
    let confidence = 0.95;
    if (nameOverlap < 0.3) {
      confidence = 0.3;
      console.log(`[Stage 4] ⚠️ [VENUE-MISMATCH] "${venueName}" → "${enrichedDisplayName}" overlap=${(nameOverlap * 100).toFixed(0)}% — reducing confidence to 0.3`);
    } else {
      console.log(`[Stage 4] ✅ Verified venue: ${venueName} → ${enrichedDisplayName}`);
    }

    return {
      isValid: true,
      confidence,
      placeId: place.id,
      formattedAddress: place.formattedAddress,
      coordinates: place.location
        ? { lat: place.location.latitude, lng: place.location.longitude }
        : undefined,
      rating: place.rating
        ? { value: place.rating, totalReviews: place.userRatingCount || 0 }
        : undefined,
      priceLevel: place.priceLevel ? mapPriceLevel(place.priceLevel) : undefined,
      openingHours: place.currentOpeningHours?.weekdayDescriptions,
      website: place.websiteUri,
      googleMapsUrl: place.googleMapsUri,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[Stage 4] Venue verification timeout for: ${venueName}`);
    } else {
      console.log(`[Stage 4] Venue verification error for "${venueName}":`, error);
    }
    return null;
  }
}

// =============================================================================
// DUAL-AI VENUE VERIFICATION
// =============================================================================

export async function verifyVenueWithDualAI(
  activity: StrictActivity,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined,
  LOVABLE_API_KEY: string | undefined,
  hotelCoordinates?: { lat: number; lng: number }
): Promise<VenueVerification | null> {
  const venueName = activity.location?.name || activity.title;
  const category = activity.category || 'sightseeing';

  // Step 1: Check cache first
  const cached = await checkVenueCache(venueName, destination, supabaseUrl, supabaseKey);
  if (cached) {
    return {
      isValid: true,
      confidence: cached.verification_confidence,
      placeId: cached.google_place_id || undefined,
      formattedAddress: cached.address || undefined,
      coordinates: cached.coordinates || undefined,
      rating: cached.rating ? { value: cached.rating, totalReviews: cached.total_reviews || 0 } : undefined,
      priceLevel: cached.price_level || undefined,
      website: cached.website || undefined,
      sourceProvider: 'internal_db',
    };
  }

  // Step 2: Google Places lookup
  const googleResult = await verifyVenueWithGooglePlaces(venueName, destination, GOOGLE_MAPS_API_KEY, hotelCoordinates);

  if (!googleResult || !googleResult.isValid) {
    return {
      isValid: false,
      confidence: 0.4,
      sourceProvider: 'ai_verified',
    };
  }

  // Step 3: Semantic verification with second AI
  const skipSemanticCheck = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'].includes(
    category.toLowerCase()
  );

  let semanticConfidence = googleResult.confidence;

  if (!skipSemanticCheck && LOVABLE_API_KEY && googleResult.formattedAddress) {
    try {
      const semanticResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5-nano',
          messages: [
            {
              role: 'system',
              content: `You are a venue verification assistant. Determine if two venue descriptions refer to the same place.
Return ONLY a JSON object: { "match": true/false, "confidence": 0.0-1.0, "reason": "brief explanation" }
Consider: name similarity, location match, category alignment. Be strict about name matching.`,
            },
            {
              role: 'user',
              content: `AI-generated venue: "${venueName}" (category: ${category})
Google Places result: "${googleResult.formattedAddress}"
${googleResult.rating ? `Rating: ${googleResult.rating.value}/5 (${googleResult.rating.totalReviews} reviews)` : ''}

Are these the same venue?`,
            },
          ],
          max_tokens: 100,
        }),
      });

      if (semanticResponse.ok) {
        const semanticData = await semanticResponse.json();
        const content = semanticData.choices?.[0]?.message?.content || '';

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            if (result.match === false) {
              console.log(`[Stage 4] ⚠️ Semantic mismatch for "${venueName}": ${result.reason}`);
              semanticConfidence = result.confidence * 0.5;
            } else {
              semanticConfidence = Math.max(googleResult.confidence, result.confidence);
              console.log(
                `[Stage 4] ✅ Semantic match confirmed for "${venueName}" (${semanticConfidence.toFixed(2)})`
              );
            }
          }
        } catch (_parseErr) {
          // JSON parse failed, use Google result as-is
        }
      }
    } catch (semanticError) {
      console.log(`[Stage 4] Semantic check skipped for "${venueName}":`, semanticError);
    }
  }

  // Step 4: Cache the verified venue
  const finalResult: VenueVerification = {
    ...googleResult,
    confidence: semanticConfidence,
    sourceProvider: 'google_places',
  };

  if (semanticConfidence >= 0.7) {
    cacheVerifiedVenue(venueName, destination, category, finalResult, supabaseUrl, supabaseKey);
  }

  return finalResult;
}

// =============================================================================
// ACTIVITY IMAGE FETCHING
// =============================================================================

export async function fetchActivityImage(
  activityTitle: string,
  category: string,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ url: string; source: string; attribution?: string } | null> {
  try {
    const skipCategories = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
    if (skipCategories.includes(category?.toLowerCase() || '')) {
      return null;
    }

    console.log(`[Stage 4] Fetching real photo for: ${activityTitle} in ${destination}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${supabaseUrl}/functions/v1/destination-images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        venueName: activityTitle,
        destination: destination,
        category: category,
        imageType: 'activity',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[Stage 4] Image fetch failed for "${activityTitle}":`, response.status);
      return null;
    }

    const data = await response.json();
    const image = data.images?.[0];

    if (image?.url && image.source !== 'fallback') {
      console.log(`[Stage 4] ✅ Got ${image.source} photo for: ${activityTitle}`);
      return {
        url: image.url,
        source: image.source,
        attribution: image.attribution,
      };
    }

    return null;
  } catch (e) {
    console.log(`[Stage 4] Image fetch error for "${activityTitle}":`, e);
    return null;
  }
}

// =============================================================================
// VIATOR MATCHING
// =============================================================================

const NON_BOOKABLE_CATEGORIES = [
  'transport', 'transportation', 'downtime', 'free_time', 'accommodation', 'dining', 'restaurant', 'food',
];
const DINING_KEYWORDS = ['dinner', 'lunch', 'breakfast', 'brunch', 'restaurant', 'cafe', 'dining'];

export function isBookableActivity(activity: StrictActivity): boolean {
  const category = (activity.category || '').toLowerCase();
  const title = (activity.title || '').toLowerCase();

  if (NON_BOOKABLE_CATEGORIES.includes(category)) return false;
  if (DINING_KEYWORDS.some((kw) => title.includes(kw))) return false;

  const bookableCategories = [
    'sightseeing', 'cultural', 'adventure', 'tour', 'experience', 'entertainment', 'water', 'nature',
  ];
  return (
    bookableCategories.some((bc) => category.includes(bc)) ||
    ['museum', 'palace', 'castle', 'tower', 'cathedral', 'basilica', 'gallery', 'tour', 'experience'].some((kw) =>
      title.includes(kw)
    )
  );
}

export async function searchViatorForActivity(
  activityTitle: string,
  destination: string,
  category: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ productCode?: string; bookingUrl?: string; quotePriceCents?: number } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${supabaseUrl}/functions/v1/viator-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activityName: activityTitle,
        destination: destination,
        category: category,
        limit: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.success && data.bestMatch && data.bestMatch.matchScore >= 40) {
      console.log(
        `[Stage 4] ✅ Viator match for "${activityTitle}": ${data.bestMatch.title} (score: ${data.bestMatch.matchScore})`
      );
      return {
        productCode: data.bestMatch.productCode,
        bookingUrl: data.bestMatch.bookingUrl,
        quotePriceCents: data.bestMatch.priceCents,
      };
    }
    return null;
  } catch (e) {
    console.log(`[Stage 4] Viator search skipped for "${activityTitle}":`, e);
    return null;
  }
}

// =============================================================================
// SINGLE ACTIVITY ENRICHMENT
// =============================================================================

export async function enrichActivity(
  activity: StrictActivity,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined,
  LOVABLE_API_KEY: string | undefined,
  hotelCoordinates?: { lat: number; lng: number }
): Promise<StrictActivity> {
  const enriched = { ...activity };

  const skipCategories = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
  if (skipCategories.includes(activity.category?.toLowerCase() || '')) {
    enriched.verified = { isValid: true, confidence: 0.75 };
    return enriched;
  }

  const shouldSearchViator = isBookableActivity(activity) && !(enriched as any).viatorProductCode;

  const ENRICHMENT_TIMEOUT_MS = 10_000;

  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Enrichment timed out after ${ENRICHMENT_TIMEOUT_MS}ms`));
    }, ENRICHMENT_TIMEOUT_MS);
  });

  try {
    const [venueData, photoResult, viatorMatch] = await Promise.race([
      Promise.all([
        verifyVenueWithDualAI(activity, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY, hotelCoordinates)
          .catch((e) => {
            console.log(`[Stage 4] Venue verify timeout/error for "${activity.title}":`, e.message);
            return null;
          }),
        !enriched.photos?.length
          ? fetchActivityImage(activity.title, activity.category || 'sightseeing', destination, supabaseUrl, supabaseKey)
              .catch((e) => {
                console.log(`[Stage 4] Image fetch timeout/error for "${activity.title}":`, e.message);
                return null;
              })
          : Promise.resolve(null),
        shouldSearchViator
          ? searchViatorForActivity(
              activity.title,
              destination,
              activity.category || 'sightseeing',
              supabaseUrl,
              supabaseKey
            ).catch((e) => {
              console.log(`[Stage 4] Viator search timeout/error for "${activity.title}":`, e.message);
              return null;
            })
          : Promise.resolve(null),
      ]),
      timeoutPromise,
    ]);

    if (timeoutId !== undefined) clearTimeout(timeoutId);

    // Apply Viator booking data
    if (viatorMatch) {
      (enriched as any).viatorProductCode = viatorMatch.productCode;
      (enriched as any).bookingUrl = viatorMatch.bookingUrl;
      if (viatorMatch.quotePriceCents) {
        (enriched as any).quotePriceCents = viatorMatch.quotePriceCents;
      }
      enriched.bookingRequired = true;
    }

    // Apply venue verification data (with name mismatch guard)
    if (venueData) {
      // Protect the venue name from being overwritten by a mismatched Places result
      if (venueData.confidence !== undefined && venueData.confidence < 0.5) {
        // Low-confidence match — preserve original name, still use coords/address
        const originalName = activity.title || (activity as any).venue_name || '';
        console.log(`[Stage 4] [VENUE-MISMATCH] Preserving original name "${originalName}" (confidence=${venueData.confidence})`);
        // Ensure location.name stays as original
        if (enriched.location) {
          enriched.location.name = enriched.location.name || originalName;
        }
      }

      if (venueData.coordinates) {
        enriched.location = {
          ...enriched.location,
          coordinates: venueData.coordinates,
        };
        if (venueData.formattedAddress) {
          enriched.location.address = venueData.formattedAddress;
        }
      }
      if (venueData.rating) {
        enriched.rating = venueData.rating;
      }
      if (venueData.priceLevel !== undefined) {
        enriched.priceLevel = venueData.priceLevel;
      }
      if (venueData.openingHours) {
        enriched.openingHours = venueData.openingHours;
      }
      if (venueData.website) {
        enriched.website = venueData.website;
      }
      if (venueData.googleMapsUrl) {
        enriched.googleMapsUrl = venueData.googleMapsUrl;
      }
      enriched.verified = {
        isValid: venueData.isValid,
        confidence: venueData.confidence,
        placeId: venueData.placeId,
      };
    }

    // Apply photo data
    if (photoResult) {
      enriched.photos = [
        {
          url: photoResult.url,
          alt: `${activity.title} in ${destination}`,
          photographer: photoResult.attribution || `Source: ${photoResult.source}`,
        },
      ];
    }
  } catch (e) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    console.warn(`[Stage 4] Enrichment aborted for "${activity.title}" (${e instanceof Error ? e.message : e})`);
  }

  if (!enriched.verified) {
    const hasRealPhoto = enriched.photos?.length && !enriched.photos[0]?.photographer?.includes('AI Generated');
    enriched.verified = {
      isValid: true,
      confidence: hasRealPhoto ? 0.8 : enriched.photos?.length ? 0.7 : 0.6,
    };
  }

  return enriched;
}

// =============================================================================
// ENRICHMENT WITH RETRY
// =============================================================================

export async function enrichActivityWithRetry(
  activity: StrictActivity,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined,
  LOVABLE_API_KEY: string | undefined,
  maxRetries: number = 1,
  hotelCoordinates?: { lat: number; lng: number }
): Promise<{ activity: StrictActivity; success: boolean; retried: boolean }> {
  let retried = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const enriched = await enrichActivity(
        activity,
        destination,
        supabaseUrl,
        supabaseKey,
        GOOGLE_MAPS_API_KEY,
        LOVABLE_API_KEY,
        hotelCoordinates
      );
      return { activity: enriched, success: true, retried };
    } catch (error) {
      console.warn(`[Stage 4] Enrichment error for "${activity.title}" (attempt ${attempt + 1}):`, error);
      if (attempt < maxRetries) {
        retried = true;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  console.log(`[Stage 4] Enrichment failed for "${activity.title}" after ${maxRetries + 1} attempts, using original`);
  return {
    activity: { ...activity, verified: { isValid: false, confidence: 0.5 } },
    success: false,
    retried,
  };
}

// =============================================================================
// BULK ENRICHMENT (full itinerary)
// =============================================================================

export async function enrichItinerary(
  days: StrictDay[],
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined,
  LOVABLE_API_KEY: string | undefined,
  hotelCoordinates?: { lat: number; lng: number }
): Promise<{ days: StrictDay[]; stats: EnrichmentStats }> {
  console.log(`[Stage 4] Starting enrichment for ${days.length} days with real photos + dual-AI venue verification`);

  const enrichedDays: StrictDay[] = [];
  const stats: EnrichmentStats = {
    totalActivities: 0,
    photosAdded: 0,
    venuesVerified: 0,
    enrichmentFailures: 0,
    retriedSuccessfully: 0,
  };

  const STAGE4_TIME_BUDGET_MS = 45_000;
  const stage4StartedAt = Date.now();

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const enrichedActivities: StrictActivity[] = [];
    const BATCH_SIZE = 3;
    let budgetExceeded = false;

    for (let i = 0; i < day.activities.length; i += BATCH_SIZE) {
      const elapsedMs = Date.now() - stage4StartedAt;
      if (elapsedMs >= STAGE4_TIME_BUDGET_MS) {
        console.warn(
          `[Stage 4] Time budget reached at day ${day.dayNumber}. Returning remaining activities without enrichment.`
        );
        enrichedActivities.push(...day.activities.slice(i));
        budgetExceeded = true;
        break;
      }

      const batch = day.activities.slice(i, i + BATCH_SIZE);
      const enrichedBatch = await Promise.all(
        batch.map((act) =>
          enrichActivityWithRetry(act, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY, 1, hotelCoordinates)
        )
      );

      for (const result of enrichedBatch) {
        enrichedActivities.push(result.activity);
        stats.totalActivities++;
        if (result.activity.photos?.length) stats.photosAdded++;
        if (result.activity.verified?.placeId) stats.venuesVerified++;
        if (!result.success) stats.enrichmentFailures++;
        if (result.retried && result.success) stats.retriedSuccessfully++;
      }

      if (i + BATCH_SIZE < day.activities.length) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    const totalCost = enrichedActivities.reduce((sum, a) => sum + (a.cost?.amount || 0), 0);
    const mealsCount = enrichedActivities.filter((a) => a.category === 'dining').length;
    const activityCount = enrichedActivities.length;

    enrichedDays.push({
      ...day,
      activities: enrichedActivities,
      metadata: {
        theme: day.title,
        totalEstimatedCost: totalCost,
        mealsIncluded: mealsCount,
        pacingLevel: activityCount <= 3 ? 'relaxed' : activityCount <= 5 ? 'moderate' : 'packed',
      },
    });

    if (budgetExceeded) {
      const remainingDays = days.slice(dayIndex + 1);
      if (remainingDays.length > 0) {
        console.warn(
          `[Stage 4] Appending ${remainingDays.length} remaining day(s) without enrichment due to time budget.`
        );
        enrichedDays.push(...remainingDays);
      }
      break;
    }
  }

  console.log(
    `[Stage 4] Enrichment complete - ${stats.photosAdded} photos, ${stats.venuesVerified} venues verified, ${stats.enrichmentFailures} failures${stats.retriedSuccessfully > 0 ? `, ${stats.retriedSuccessfully} recovered via retry` : ''}`
  );
  return { days: enrichedDays, stats };
}
