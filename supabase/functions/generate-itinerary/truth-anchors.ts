/**
 * TRUTH ANCHORS - Prevent Hallucination with Verifiable Venue Data
 * 
 * Every activity recommendation must have verifiable data anchors:
 * - Provider ID (Google Places, Foursquare, Viator)
 * - Address/coordinates
 * - Hours/reservation requirements
 * - Price level
 * - Confidence score
 * 
 * If a place can't be verified, it shouldn't appear as a confident recommendation.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TruthAnchor {
  providerId?: string;         // External ID (e.g., Google Place ID, Viator product code)
  provider?: 'google_places' | 'foursquare' | 'viator' | 'tripadvisor' | 'internal_db' | 'ai_generated';
  address: string;
  coordinates?: { lat: number; lng: number };
  openingHours?: string[];     // Array of "Monday: 9:00 AM – 5:00 PM" style strings
  reservationRequired?: boolean;
  priceLevel?: 1 | 2 | 3 | 4;  // 1 = budget, 4 = luxury
  priceEstimate?: { min: number; max: number; currency: string };
  rating?: { value: number; totalReviews: number };
  confidence: number;          // 0-1, lower triggers safer picks
  verifiedAt?: string;         // ISO timestamp
  verificationMethod?: 'api_lookup' | 'database_cache' | 'ai_inference' | 'user_provided';
}

export interface AnchoredActivity {
  id: string;
  title: string;
  category: string;
  anchor: TruthAnchor;
  // Fallback indicators
  isUnverified?: boolean;
  fallbackReason?: string;
}

export interface VerificationResult {
  isVerified: boolean;
  confidence: number;
  anchor?: TruthAnchor;
  warnings: string[];
  shouldFallback: boolean;
  fallbackStrategy?: 'use_category' | 'use_neighborhood' | 'ask_clarification' | 'reduce_day';
}

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

/**
 * Calculate confidence score based on verification data quality
 */
export function calculateConfidence(anchor: Partial<TruthAnchor>): number {
  let score = 0;
  const weights = {
    hasProviderId: 25,
    hasCoordinates: 20,
    hasAddress: 15,
    hasHours: 15,
    hasRating: 10,
    hasPriceLevel: 10,
    recentVerification: 5
  };
  
  if (anchor.providerId) score += weights.hasProviderId;
  if (anchor.coordinates?.lat && anchor.coordinates?.lng) score += weights.hasCoordinates;
  if (anchor.address && anchor.address.length > 10) score += weights.hasAddress;
  if (anchor.openingHours && anchor.openingHours.length > 0) score += weights.hasHours;
  if (anchor.rating?.value && anchor.rating?.totalReviews > 10) score += weights.hasRating;
  if (anchor.priceLevel) score += weights.hasPriceLevel;
  
  // Recency bonus
  if (anchor.verifiedAt) {
    const daysSinceVerification = (Date.now() - new Date(anchor.verifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVerification < 7) score += weights.recentVerification;
    else if (daysSinceVerification < 30) score += weights.recentVerification * 0.5;
  }
  
  return Math.min(100, score) / 100; // Normalize to 0-1
}

/**
 * Determine if activity needs fallback based on confidence
 */
export function needsFallback(confidence: number, category: string): boolean {
  // Higher bar for dining (people really care about restaurant recommendations)
  const thresholds: Record<string, number> = {
    dining: 0.6,
    activity: 0.4,
    sightseeing: 0.3,
    transport: 0.2, // Low bar - just need basic info
    accommodation: 0.5,
    default: 0.4
  };
  
  const threshold = thresholds[category?.toLowerCase()] ?? thresholds.default;
  return confidence < threshold;
}

// =============================================================================
// VERIFICATION RESULT BUILDING
// =============================================================================

/**
 * Build verification result from Google Places data
 */
export function verifyFromGooglePlaces(
  placeData: {
    place_id?: string;
    formatted_address?: string;
    geometry?: { location: { lat: number; lng: number } };
    opening_hours?: { weekday_text?: string[] };
    price_level?: number;
    rating?: number;
    user_ratings_total?: number;
    business_status?: string;
  } | null
): VerificationResult {
  const warnings: string[] = [];
  
  if (!placeData) {
    return {
      isVerified: false,
      confidence: 0,
      warnings: ['No Google Places data found'],
      shouldFallback: true,
      fallbackStrategy: 'use_category'
    };
  }
  
  // Check if business is operational
  if (placeData.business_status && placeData.business_status !== 'OPERATIONAL') {
    warnings.push(`Business status: ${placeData.business_status}`);
  }
  
  // Low rating warning
  if (placeData.rating && placeData.rating < 4.0) {
    warnings.push(`Low rating: ${placeData.rating} stars`);
  }
  
  const anchor: TruthAnchor = {
    providerId: placeData.place_id,
    provider: 'google_places',
    address: placeData.formatted_address || '',
    coordinates: placeData.geometry?.location ? {
      lat: placeData.geometry.location.lat,
      lng: placeData.geometry.location.lng
    } : undefined,
    openingHours: placeData.opening_hours?.weekday_text,
    priceLevel: placeData.price_level as 1 | 2 | 3 | 4 | undefined,
    rating: placeData.rating && placeData.user_ratings_total ? {
      value: placeData.rating,
      totalReviews: placeData.user_ratings_total
    } : undefined,
    confidence: 0,
    verifiedAt: new Date().toISOString(),
    verificationMethod: 'api_lookup'
  };
  
  anchor.confidence = calculateConfidence(anchor);
  
  return {
    isVerified: anchor.confidence >= 0.4,
    confidence: anchor.confidence,
    anchor,
    warnings,
    shouldFallback: needsFallback(anchor.confidence, 'activity')
  };
}

/**
 * Build verification result from Viator product data
 */
export function verifyFromViator(
  productData: {
    productCode?: string;
    title?: string;
    pricing?: { summary?: { fromPrice?: number } };
    reviews?: { combinedAverageRating?: number; totalReviews?: number };
    logistics?: { meetingPoint?: { address?: string; coordinates?: { latitude: number; longitude: number } } };
    bookingRequirements?: { requiresReservation?: boolean };
  } | null
): VerificationResult {
  if (!productData) {
    return {
      isVerified: false,
      confidence: 0,
      warnings: ['No Viator product data found'],
      shouldFallback: true,
      fallbackStrategy: 'use_category'
    };
  }
  
  const warnings: string[] = [];
  
  if (productData.reviews?.combinedAverageRating && productData.reviews.combinedAverageRating < 4.0) {
    warnings.push(`Rating below 4 stars: ${productData.reviews.combinedAverageRating}`);
  }
  
  const anchor: TruthAnchor = {
    providerId: productData.productCode,
    provider: 'viator',
    address: productData.logistics?.meetingPoint?.address || '',
    coordinates: productData.logistics?.meetingPoint?.coordinates ? {
      lat: productData.logistics.meetingPoint.coordinates.latitude,
      lng: productData.logistics.meetingPoint.coordinates.longitude
    } : undefined,
    reservationRequired: productData.bookingRequirements?.requiresReservation ?? true,
    priceEstimate: productData.pricing?.summary?.fromPrice ? {
      min: productData.pricing.summary.fromPrice,
      max: productData.pricing.summary.fromPrice * 1.2,
      currency: 'USD'
    } : undefined,
    rating: productData.reviews ? {
      value: productData.reviews.combinedAverageRating || 0,
      totalReviews: productData.reviews.totalReviews || 0
    } : undefined,
    confidence: 0,
    verifiedAt: new Date().toISOString(),
    verificationMethod: 'api_lookup'
  };
  
  anchor.confidence = calculateConfidence(anchor);
  
  return {
    isVerified: anchor.confidence >= 0.4,
    confidence: anchor.confidence,
    anchor,
    warnings,
    shouldFallback: needsFallback(anchor.confidence, 'activity')
  };
}

/**
 * Build verification from internal database cache
 */
export function verifyFromCache(
  cachedVenue: {
    google_place_id?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string[];
    price_level?: number;
    rating?: number;
    review_count?: number;
    verified_at?: string;
    source?: string;
  } | null
): VerificationResult {
  if (!cachedVenue) {
    return {
      isVerified: false,
      confidence: 0,
      warnings: ['Not found in venue cache'],
      shouldFallback: true,
      fallbackStrategy: 'use_category'
    };
  }
  
  const warnings: string[] = [];
  
  // Check cache freshness
  if (cachedVenue.verified_at) {
    const daysSince = (Date.now() - new Date(cachedVenue.verified_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      warnings.push('Cache data is over 30 days old');
    }
  }
  
  const anchor: TruthAnchor = {
    providerId: cachedVenue.google_place_id,
    provider: cachedVenue.source as TruthAnchor['provider'] || 'internal_db',
    address: cachedVenue.address || '',
    coordinates: cachedVenue.latitude && cachedVenue.longitude ? {
      lat: cachedVenue.latitude,
      lng: cachedVenue.longitude
    } : undefined,
    openingHours: cachedVenue.opening_hours,
    priceLevel: cachedVenue.price_level as 1 | 2 | 3 | 4 | undefined,
    rating: cachedVenue.rating && cachedVenue.review_count ? {
      value: cachedVenue.rating,
      totalReviews: cachedVenue.review_count
    } : undefined,
    confidence: 0,
    verifiedAt: cachedVenue.verified_at || new Date().toISOString(),
    verificationMethod: 'database_cache'
  };
  
  anchor.confidence = calculateConfidence(anchor);
  
  return {
    isVerified: anchor.confidence >= 0.3, // Lower bar for cache
    confidence: anchor.confidence,
    anchor,
    warnings,
    shouldFallback: needsFallback(anchor.confidence, 'activity')
  };
}

// =============================================================================
// FALLBACK STRATEGIES
// =============================================================================

export interface FallbackRecommendation {
  strategy: 'use_category' | 'use_neighborhood' | 'ask_clarification' | 'reduce_day';
  suggestion: string;
  confidence: number;
}

/**
 * Generate fallback recommendation when verification fails
 */
export function generateFallback(
  category: string,
  neighborhood: string | null,
  verificationAttempts: number
): FallbackRecommendation {
  // After 2+ failed attempts, don't fake precision
  if (verificationAttempts >= 2) {
    if (neighborhood) {
      return {
        strategy: 'use_neighborhood',
        suggestion: `Explore ${category} options in ${neighborhood} (self-guided)`,
        confidence: 0.3
      };
    }
    return {
      strategy: 'use_category',
      suggestion: `Look for ${category} options in the area`,
      confidence: 0.2
    };
  }
  
  // First failure - suggest category with lower confidence
  return {
    strategy: 'use_category',
    suggestion: `${category} experience (specific venue to be confirmed)`,
    confidence: 0.4
  };
}

// =============================================================================
// PROMPT GENERATION
// =============================================================================

/**
 * Generate truth anchor requirements for AI prompt
 */
export function buildTruthAnchorPrompt(): string {
  return `
## TRUTH ANCHORS - VERIFIABLE VENUE DATA REQUIRED
Every activity MUST include verifiable data. Activities without truth anchors will be REJECTED.

For each activity, you MUST provide:
1. \`providerId\`: External ID if known (Google Place ID, Viator code) or null
2. \`address\`: Full street address (not just neighborhood)
3. \`priceLevel\`: 1-4 scale (1=budget, 4=luxury)
4. \`reservationRequired\`: true/false
5. \`confidence\`: 0-1 score of how certain you are this place exists and is as described

CONFIDENCE SCORING GUIDE:
- 0.9-1.0: You know this is a real, established venue with years of operation
- 0.7-0.8: Well-known venue, likely still operating
- 0.5-0.6: You believe this exists but aren't certain of current details
- 0.3-0.4: Uncertain - this might be a good option but needs verification
- Below 0.3: DON'T INCLUDE - use category/neighborhood suggestion instead

If you cannot confidently recommend a specific venue (confidence < 0.5):
- Suggest the CATEGORY + NEIGHBORHOOD instead (e.g., "Seafood restaurant in Trastevere")
- Mark as \`needsVerification: true\`
- Provide 2-3 alternative venue names to try

DO NOT hallucinate specific venues. Vague but honest > specific but wrong.`;
}

/**
 * Validate activity has sufficient truth anchors
 */
export function validateTruthAnchors(
  activity: {
    title: string;
    category: string;
    location?: { address?: string; coordinates?: { lat: number; lng: number } };
    providerId?: string;
    priceLevel?: number;
    confidence?: number;
    needsVerification?: boolean;
  }
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Skip validation for transport/logistics
  if (['transport', 'logistics', 'accommodation'].includes(activity.category?.toLowerCase() || '')) {
    return { valid: true, issues: [] };
  }
  
  // Check address
  if (!activity.location?.address || activity.location.address.length < 10) {
    issues.push('Missing or incomplete address');
  }
  
  // Check confidence
  const confidence = activity.confidence ?? 0.5;
  if (confidence < 0.3 && !activity.needsVerification) {
    issues.push(`Low confidence (${confidence}) without needsVerification flag`);
  }
  
  // Dining needs price level
  if (activity.category?.toLowerCase() === 'dining' && !activity.priceLevel) {
    issues.push('Dining activity missing priceLevel');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
