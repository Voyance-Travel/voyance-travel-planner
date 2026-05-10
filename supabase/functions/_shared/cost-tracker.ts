/**
 * Cost Tracking Module for Edge Functions
 * 
 * Logs actual token usage and API calls per trip for accurate margin calculations.
 * Data is stored in trip_cost_tracking table for aggregation.
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.90.1";

 // =============================================================================
 // COST CATEGORIES - Maps to user-facing actions
 // =============================================================================
 
 export type CostCategory = 
   | 'home_browse'      // Home page, destination browsing, image loading
   | 'quiz'             // Travel DNA quiz analysis
   | 'explore'          // Destination exploration, intelligence lookups
   | 'itinerary_gen'    // Full/preview itinerary generation
   | 'itinerary_edit'   // Activity swaps, day regeneration, AI chat
   | 'booking_search'   // Hotel/flight searches, Amadeus calls
   | 'recommendations'  // Restaurant recs, nearby suggestions
   | 'enrichment'       // Activity enrichment, photo fetching
   | 'other';           // Uncategorized/system operations
 
 // Maps action_type to cost_category for automatic categorization
 const ACTION_TO_CATEGORY: Record<string, CostCategory> = {
   // Enrichment - destination photos for itinerary cards/heroes
   'destination_images': 'enrichment',
   'home_destinations': 'home_browse',
   
   // Quiz
   'travel_dna': 'quiz',
   'calculate_dna': 'quiz',
   'calculate-travel-dna': 'quiz',
   
   // Explore
   'destination_intelligence': 'explore',
   'get-destination-intelligence': 'explore',
   'lookup-destination-insights': 'explore',
   'lookup_travel_advisory': 'explore',
   'lookup-travel-advisory': 'explore',
   'local_events': 'explore',
   'lookup-local-events': 'explore',
   'parse_travel_story': 'explore',
   'parse-travel-story': 'explore',
   
   // Itinerary Generation
   'generate_itinerary': 'itinerary_gen',
   'generate-itinerary': 'itinerary_gen',
   'generate_preview': 'itinerary_gen',
   'generate-quick-preview': 'itinerary_gen',
   'generate-full-preview': 'itinerary_gen',
   'generate-trip-preview': 'itinerary_gen',
   'quick_preview': 'itinerary_gen',
   'full_preview': 'itinerary_gen',
   'trip_preview': 'itinerary_gen',
   
   // Itinerary Editing
   'swap_activity': 'itinerary_edit',
   'get-activity-alternatives': 'itinerary_edit',
   'regenerate_day': 'itinerary_edit',
   'itinerary_chat': 'itinerary_edit',
   'itinerary-chat': 'itinerary_edit',
   'optimize-itinerary': 'itinerary_edit',
   'analyze_itinerary': 'itinerary_edit',
    'analyze-itinerary': 'itinerary_edit',
    'dna_feedback_chat': 'dna_profile',
    'dna-feedback-chat': 'dna_profile',
   
   // Booking Search
   'hotels_search': 'booking_search',
   'hotels': 'booking_search',
   'flights': 'booking_search',
   'flight_search': 'booking_search',
   'amadeus_hotels': 'booking_search',
   'amadeus_flights': 'booking_search',
   
   // Recommendations
   'recommend_restaurants': 'recommendations',
   'recommend-restaurants': 'recommendations',
   'nearby_suggestions': 'recommendations',
   'nearby-suggestions': 'recommendations',
   
   // Enrichment
    'activity_images': 'enrichment',
   'fetch_reviews': 'enrichment',
   'fetch-reviews': 'enrichment',
   'lookup_activity_url': 'enrichment',
   'lookup-activity-url': 'enrichment',
   'lookup_restaurant_url': 'enrichment',
   'lookup-restaurant-url': 'enrichment',
 };
 
 function getCategoryForAction(actionType: string): CostCategory {
   return ACTION_TO_CATEGORY[actionType] || 'other';
 }
 
// =============================================================================
// PRICING DATA - Lovable AI Gateway (VERIFIED Feb 4, 2026)
// 
// ACTUAL PRODUCTION USAGE (303 calls, $3.93 total):
//   - gemini-3-flash-preview: 125 calls (41%)
//   - gemini-2.5-flash-image: 92 calls (30%)
//   - gemini-2.5-flash-lite: 75 calls (25%)
//   - gemini-2.5-flash: 11 calls (4%)
//
// REAL COST: $3.93 ÷ 60 trips = $0.065/trip (~5 AI calls per trip)
// 
// NOTE: GPT-5 models are NOT used in production despite earlier docs.
// Lovable pricing is transitional - may change after early 2026.
// =============================================================================

export const MODEL_PRICING = {
  // PRODUCTION MODELS (actually in use)
  'google/gemini-3-flash-preview': { input: 0.10, output: 0.40 },   // Primary - 41% of calls
  'google/gemini-2.5-flash-image': { input: 0.10, output: 0.40 },   // Image gen - 30% of calls
  'google/gemini-2.5-flash-lite': { input: 0.05, output: 0.20 },    // Light tasks - 25% of calls
  'google/gemini-2.5-flash': { input: 0.10, output: 0.40 },         // Fallback - 4% of calls
  
  // Available but NOT currently used in production
  'google/gemini-2.5-pro': { input: 5.00, output: 15.00 },
  'google/gemini-3-pro-preview': { input: 5.00, output: 15.00 },
  'openai/gpt-5': { input: 10.00, output: 30.00 },
  'openai/gpt-5-mini': { input: 0.40, output: 1.60 },
  'openai/gpt-5-nano': { input: 0.15, output: 0.60 },
} as const;

// Google API pricing (per call) - March 2025 per-SKU free tiers
// WARNING: At 60 trips × 40-60 calls/trip = 2,400-3,600 calls/period
// FREE TIER STATUS: UNKNOWN - must check Google Cloud Console billing
//
// DASHBOARD QUERY GUIDANCE:
//   Cost totals (exclude retries):     WHERE retry_of IS NULL
//   Reliability (count all attempts):  no filter
//   Cache ROI:                          WHERE is_cache_hit = true
//   Token quality:                      GROUP BY token_source ('api'|'estimate'|'unknown')
export const GOOGLE_API_PRICING = {
  places_text_search: { perCall: 0.032, freeTierMonthly: 5000 },  // Google Advanced SKU (was 0.017 — incorrect)
  places_details: { perCall: 0.017, freeTierMonthly: 5000 },      // Basic Place Details SKU
  geocoding: { perCall: 0.005, freeTierMonthly: 10000 },
  photos: { perCall: 0.007, freeTierMonthly: 10000 },
  routes: { perCall: 0.005, freeTierMonthly: 5000 },
} as const;

// Other API pricing
export const OTHER_API_PRICING = {
  perplexity: { perCall: 0.005 },
  // Amadeus removed Feb 2026 — hotel search is now credit-gated AI feature
} as const;

// =============================================================================
// COST CALCULATION
// =============================================================================

export function calculateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  if (!pricing) {
    console.warn(`[cost-tracker] Unknown model: ${model}, using gemini-flash pricing`);
    return (inputTokens * 0.10 + outputTokens * 0.40) / 1_000_000;
  }
  
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function calculateGoogleApiCost(callType: keyof typeof GOOGLE_API_PRICING, count: number): number {
  const pricing = GOOGLE_API_PRICING[callType];
  // Note: This doesn't account for free tier - that's calculated at aggregation time
  return pricing.perCall * count;
}

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate token count from string content.
 * Uses a rough heuristic: 1 token ≈ 4 characters for English text.
 * For JSON payloads, this tends to be conservative (overestimates slightly).
 */
export function estimateTokens(content: string): number {
  if (!content) return 0;
  // Average English: ~4 chars per token
  // JSON with whitespace: ~3.5 chars per token
  return Math.ceil(content.length / 3.8);
}

/**
 * Source of token counts:
 *   'api'      — provider returned precise usage (prompt_tokens / promptTokenCount)
 *   'estimate' — counts derived from content length heuristic
 *   'unknown'  — no AI usage recorded on this row
 */
export type TokenSource = 'api' | 'estimate' | 'unknown';

/**
 * Extract token counts from an AI response, tagging whether the count came
 * from the provider's API (`source: 'api'`) or was estimated (`source: 'estimate'`).
 *
 * Supports both OpenAI-style (`usage.prompt_tokens` / `usage.completion_tokens`)
 * and Gemini-style (`usageMetadata.promptTokenCount` / `candidatesTokenCount`).
 */
export function extractTokenUsage(aiResponse: any): {
  inputTokens: number;
  outputTokens: number;
  source: TokenSource;
} {
  const usage = aiResponse?.usage;
  const meta = aiResponse?.usageMetadata;

  const apiInput =
    usage?.prompt_tokens ?? usage?.input_tokens ?? meta?.promptTokenCount ?? null;
  const apiOutput =
    usage?.completion_tokens ?? usage?.output_tokens ?? meta?.candidatesTokenCount ?? null;

  if (apiInput !== null && apiOutput !== null) {
    return {
      inputTokens: apiInput || 0,
      outputTokens: apiOutput || 0,
      source: 'api',
    };
  }

  // Fallback: estimate from content if usage not provided
  const content = aiResponse?.choices?.[0]?.message?.content || '';
  return {
    inputTokens: 0, // Can't estimate input without original prompt
    outputTokens: estimateTokens(content),
    source: 'estimate',
  };
}

// =============================================================================
// TRACKING INTERFACE
// =============================================================================

export interface CostTrackingEntry {
  trip_id?: string;
  user_id?: string;
  action_type: string;
   cost_category?: CostCategory;
  model: string;
  input_tokens: number;
  output_tokens: number;
  google_places_calls?: number;
  google_place_details_calls?: number;
  google_geocoding_calls?: number;
  google_photos_calls?: number;
  google_routes_calls?: number;
  amadeus_calls?: number;
  perplexity_calls?: number;
  estimated_cost_usd?: number;
  duration_ms?: number;
  metadata?: Record<string, any>;
  // Accuracy fields (Fix 1-3)
  token_source?: TokenSource;
  is_cache_hit?: boolean;
  attempt_id?: string;
  retry_of?: string | null;
}

export interface TrackerOptions {
  /** If this attempt is a retry of a prior tracker, pass that tracker's attempt_id. */
  retryOf?: string;
}

// =============================================================================
// COST TRACKER CLASS
// =============================================================================

export class CostTracker {
  private supabase: SupabaseClient;
  private startTime: number;
  private entry: CostTrackingEntry;
   private category: CostCategory;
  
  constructor(
    actionType: string,
    model: string = 'google/gemini-3-flash-preview',
    opts: TrackerOptions = {},
  ) {
    this.supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    this.startTime = Date.now();
     this.category = getCategoryForAction(actionType);
    this.entry = {
      action_type: actionType,
       cost_category: this.category,
      model,
      input_tokens: 0,
      output_tokens: 0,
      google_places_calls: 0,
      google_place_details_calls: 0,
      google_geocoding_calls: 0,
      google_photos_calls: 0,
      google_routes_calls: 0,
      amadeus_calls: 0,
      perplexity_calls: 0,
      token_source: 'unknown',
      is_cache_hit: false,
      attempt_id: crypto.randomUUID(),
      retry_of: opts.retryOf ?? null,
    };
  }

  /** Returns this tracker's attempt_id so a retry can reference it via { retryOf }. */
  getAttemptId(): string {
    return this.entry.attempt_id!;
  }

  /** Explicitly mark this row as a cache hit (cost = $0, work served from cache). */
  markCacheHit(): this {
    this.entry.is_cache_hit = true;
    return this;
  }

   /**
    * Override the auto-detected category
    */
   setCategory(category: CostCategory) {
     this.category = category;
     this.entry.cost_category = category;
     return this;
   }
   
  setTripId(tripId: string) {
    this.entry.trip_id = tripId;
    return this;
  }
  
  setUserId(userId: string) {
    this.entry.user_id = userId;
    return this;
  }
  
  setModel(model: string) {
    this.entry.model = model;
    return this;
  }
  
  addMetadata(key: string, value: any) {
    if (!this.entry.metadata) {
      this.entry.metadata = {};
    }
    this.entry.metadata[key] = value;
    return this;
  }
  
  /**
   * Record token usage from an AI response. Tracks whether the counts came
   * from the provider's API (precise) or were estimated from content length.
   * If any call on this tracker was estimated, `token_source` downgrades to
   * 'estimate' for the row as a whole.
   */
  recordAiUsage(aiResponse: any, model?: string) {
    const usage = extractTokenUsage(aiResponse);
    this.entry.input_tokens += usage.inputTokens;
    this.entry.output_tokens += usage.outputTokens;
    if (model) {
      this.entry.model = model;
    }
    const prev = this.entry.token_source ?? 'unknown';
    if (prev === 'unknown') {
      this.entry.token_source = usage.source;
    } else if (prev === 'api' && usage.source === 'estimate') {
      this.entry.token_source = 'estimate';
    }
    return this;
  }
  
  /**
   * Manually record token counts (when usage not in response).
   * Manual counts are by definition not from the API → marks token_source as 'estimate'.
   */
  recordTokens(inputTokens: number, outputTokens: number) {
    this.entry.input_tokens += inputTokens;
    this.entry.output_tokens += outputTokens;
    const prev = this.entry.token_source ?? 'unknown';
    if (prev === 'unknown' || prev === 'api') {
      this.entry.token_source = 'estimate';
    }
    return this;
  }
  
  /**
   * Record Google API calls (Text Search — Advanced SKU).
   */
  recordGooglePlaces(count: number = 1) {
    this.entry.google_places_calls = (this.entry.google_places_calls || 0) + count;
    return this;
  }

  /** Place Details (Basic SKU) — cheaper than Text Search. */
  recordGooglePlaceDetails(count: number = 1) {
    this.entry.google_place_details_calls = (this.entry.google_place_details_calls || 0) + count;
    return this;
  }
  
  recordGoogleGeocoding(count: number = 1) {
    this.entry.google_geocoding_calls = (this.entry.google_geocoding_calls || 0) + count;
    return this;
  }
  
  recordGooglePhotos(count: number = 1) {
    this.entry.google_photos_calls = (this.entry.google_photos_calls || 0) + count;
    return this;
  }
  
  recordGoogleRoutes(count: number = 1) {
    this.entry.google_routes_calls = (this.entry.google_routes_calls || 0) + count;
    return this;
  }
  
  recordAmadeus(count: number = 1) {
    this.entry.amadeus_calls = (this.entry.amadeus_calls || 0) + count;
    return this;
  }
  
  recordPerplexity(count: number = 1) {
    this.entry.perplexity_calls = (this.entry.perplexity_calls || 0) + count;
    return this;
  }
  
  /**
   * Calculate estimated cost and save to database.
   *
   * Cache-hit rows ($0 cost, no billable units) ARE persisted with
   * `is_cache_hit = true` so the dashboard can compute cache ROI. Rows
   * with no work AND no cache-hit signal (i.e. an opened-but-unused
   * tracker) are still skipped to avoid noise.
   */
  async save(): Promise<void> {
    try {
      const durationMs = Date.now() - this.startTime;

      // Calculate estimated cost
      const tokenCost = calculateTokenCost(
        this.entry.model,
        this.entry.input_tokens,
        this.entry.output_tokens
      );

      const googleCost =
        (this.entry.google_places_calls         || 0) * GOOGLE_API_PRICING.places_text_search.perCall +
        (this.entry.google_place_details_calls  || 0) * GOOGLE_API_PRICING.places_details.perCall +
        (this.entry.google_geocoding_calls      || 0) * GOOGLE_API_PRICING.geocoding.perCall +
        (this.entry.google_photos_calls         || 0) * GOOGLE_API_PRICING.photos.perCall +
        (this.entry.google_routes_calls         || 0) * GOOGLE_API_PRICING.routes.perCall;

      const otherCost =
        (this.entry.perplexity_calls || 0) * OTHER_API_PRICING.perplexity.perCall;

      const estimatedCost = tokenCost + googleCost + otherCost;

      const billableUnits =
        (this.entry.input_tokens || 0) +
        (this.entry.output_tokens || 0) +
        (this.entry.google_places_calls || 0) +
        (this.entry.google_place_details_calls || 0) +
        (this.entry.google_photos_calls || 0) +
        (this.entry.google_geocoding_calls || 0) +
        (this.entry.google_routes_calls || 0) +
        (this.entry.amadeus_calls || 0) +
        (this.entry.perplexity_calls || 0);

      const isCacheHit = !!this.entry.is_cache_hit || (billableUnits === 0 && estimatedCost === 0);

      // Skip persistence only when nothing happened AND no cache-hit was claimed.
      // Cache-hit rows MUST be persisted so the dashboard can show caching ROI.
      if (billableUnits === 0 && estimatedCost === 0 && !this.entry.is_cache_hit) {
        return;
      }

      const { error } = await this.supabase
        .from('trip_cost_tracking')
        .insert({
          ...this.entry,
          is_cache_hit: isCacheHit,
          estimated_cost_usd: estimatedCost,
          duration_ms: durationMs,
        });

      if (error) {
        console.error('[cost-tracker] Failed to save:', error);
      } else {
        console.log(
          `[cost-tracker] Saved: ${this.entry.action_type} | ` +
          `tokens: ${this.entry.input_tokens}/${this.entry.output_tokens} (${this.entry.token_source}) | ` +
          `cost: $${estimatedCost.toFixed(6)}${isCacheHit ? ' (CACHE HIT)' : ''} | ` +
          `attempt: ${this.entry.attempt_id?.slice(0, 8)}${this.entry.retry_of ? ` (retry of ${this.entry.retry_of.slice(0, 8)})` : ''} | ` +
          `duration: ${durationMs}ms`
        );
      }
    } catch (err) {
      console.error('[cost-tracker] Error saving:', err);
    }
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Create a new cost tracker for an action.
 *
 * @param actionType - the action being tracked (e.g. 'generate-trip-day')
 * @param model      - AI model identifier (defaults to gemini-3-flash-preview)
 * @param opts.retryOf - if this attempt is a retry of a prior tracker, pass its `attempt_id`
 *                       (returned by `tracker.getAttemptId()`); the dashboard then uses
 *                       `WHERE retry_of IS NULL` to compute first-attempt cost totals.
 */
export function trackCost(
  actionType: string,
  model?: string,
  opts: TrackerOptions = {},
): CostTracker {
  return new CostTracker(actionType, model, opts);
}

/**
 * Quick log for simple AI calls without full tracking
 */
export async function logSimpleAiCall(
  actionType: string,
  model: string,
  aiResponse: any,
  tripId?: string,
  userId?: string
): Promise<void> {
  const tracker = new CostTracker(actionType, model);
  if (tripId) tracker.setTripId(tripId);
  if (userId) tracker.setUserId(userId);
  tracker.recordAiUsage(aiResponse, model);
  await tracker.save();
}
