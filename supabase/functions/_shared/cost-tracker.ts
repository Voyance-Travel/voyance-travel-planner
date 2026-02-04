/**
 * Cost Tracking Module for Edge Functions
 * 
 * Logs actual token usage and API calls per trip for accurate margin calculations.
 * Data is stored in trip_cost_tracking table for aggregation.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
export const GOOGLE_API_PRICING = {
  places_text_search: { perCall: 0.017, freeTierMonthly: 5000 },
  places_details: { perCall: 0.017, freeTierMonthly: 5000 },
  geocoding: { perCall: 0.005, freeTierMonthly: 10000 },
  photos: { perCall: 0.007, freeTierMonthly: 10000 },
  routes: { perCall: 0.005, freeTierMonthly: 5000 },
} as const;

// Other API pricing
export const OTHER_API_PRICING = {
  perplexity: { perCall: 0.005 },
  amadeus_flight_search: { perCall: 0, freeTierMonthly: 2000 },
  amadeus_hotel_search: { perCall: 0, freeTierMonthly: 2000 },
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
 * Extract token counts from Lovable AI Gateway response.
 * The gateway returns usage data in the response.
 */
export function extractTokenUsage(aiResponse: any): { inputTokens: number; outputTokens: number } {
  const usage = aiResponse?.usage;
  if (usage) {
    return {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
    };
  }
  
  // Fallback: estimate from content if usage not provided
  const content = aiResponse?.choices?.[0]?.message?.content || '';
  return {
    inputTokens: 0, // Can't estimate input without original prompt
    outputTokens: estimateTokens(content),
  };
}

// =============================================================================
// TRACKING INTERFACE
// =============================================================================

export interface CostTrackingEntry {
  trip_id?: string;
  user_id?: string;
  action_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  google_places_calls?: number;
  google_geocoding_calls?: number;
  google_photos_calls?: number;
  google_routes_calls?: number;
  amadeus_calls?: number;
  perplexity_calls?: number;
  estimated_cost_usd?: number;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

// =============================================================================
// COST TRACKER CLASS
// =============================================================================

export class CostTracker {
  private supabase: SupabaseClient;
  private startTime: number;
  private entry: CostTrackingEntry;
  
  constructor(actionType: string, model: string = 'google/gemini-3-flash-preview') {
    this.supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    this.startTime = Date.now();
    this.entry = {
      action_type: actionType,
      model,
      input_tokens: 0,
      output_tokens: 0,
      google_places_calls: 0,
      google_geocoding_calls: 0,
      google_photos_calls: 0,
      google_routes_calls: 0,
      amadeus_calls: 0,
      perplexity_calls: 0,
    };
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
   * Record token usage from an AI response
   */
  recordAiUsage(aiResponse: any, model?: string) {
    const usage = extractTokenUsage(aiResponse);
    this.entry.input_tokens += usage.inputTokens;
    this.entry.output_tokens += usage.outputTokens;
    if (model) {
      this.entry.model = model;
    }
    return this;
  }
  
  /**
   * Manually record token counts (when usage not in response)
   */
  recordTokens(inputTokens: number, outputTokens: number) {
    this.entry.input_tokens += inputTokens;
    this.entry.output_tokens += outputTokens;
    return this;
  }
  
  /**
   * Record Google API calls
   */
  recordGooglePlaces(count: number = 1) {
    this.entry.google_places_calls = (this.entry.google_places_calls || 0) + count;
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
   * Calculate estimated cost and save to database
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
        (this.entry.google_places_calls || 0) * 0.017 +
        (this.entry.google_geocoding_calls || 0) * 0.005 +
        (this.entry.google_photos_calls || 0) * 0.007 +
        (this.entry.google_routes_calls || 0) * 0.005;
      
      const otherCost = 
        (this.entry.perplexity_calls || 0) * 0.005;
      
      const estimatedCost = tokenCost + googleCost + otherCost;
      
      const { error } = await this.supabase
        .from('trip_cost_tracking')
        .insert({
          ...this.entry,
          estimated_cost_usd: estimatedCost,
          duration_ms: durationMs,
        });
      
      if (error) {
        console.error('[cost-tracker] Failed to save:', error);
      } else {
        console.log(`[cost-tracker] Saved: ${this.entry.action_type} | ` +
          `tokens: ${this.entry.input_tokens}/${this.entry.output_tokens} | ` +
          `cost: $${estimatedCost.toFixed(6)} | ` +
          `duration: ${durationMs}ms`);
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
 * Create a new cost tracker for an action
 */
export function trackCost(actionType: string, model?: string): CostTracker {
  return new CostTracker(actionType, model);
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
