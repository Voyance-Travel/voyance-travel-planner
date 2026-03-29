import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost, CostTracker } from "../_shared/cost-tracker.ts";

// =============================================================================
// EXTRACTED ACTION HANDLERS — Each action in its own file with explicit params
// =============================================================================
import { handleGetTrip } from './action-get-trip.ts';
import { handleSaveItinerary } from './action-save-itinerary.ts';
import { handleGetItinerary } from './action-get-itinerary.ts';
import { handleToggleActivityLock } from './action-toggle-lock.ts';
import { handleSyncItineraryTables } from './action-sync-tables.ts';
import { handleRepairTripCosts } from './action-repair-costs.ts';
import { handleGenerateTrip } from './action-generate-trip.ts';
import { handleGenerateTripDay } from './action-generate-trip-day.ts';
import { handleGenerateDay } from './action-generate-day.ts';
import type { ActionContext } from './action-types.ts';
import { GenerationTimer } from './generation-timer.ts';

// =============================================================================
// SHARED TYPES — Imported from generation-types.ts (single source of truth)
// =============================================================================
import type {
  MultiCityDayInfo,
  GenerationContext,
  StrictActivity,
  StrictDay,
  TravelAdvisory,
  LocalEventInfo,
  TripOverview,
  EnrichedItinerary,
  EnrichmentStats,
  ValidationViolation,
  ValidationWarning,
  ValidationResult,
  ValidationContext,
  VenueVerification,
  CachedVenue,
  DirectTripData,
} from './generation-types.ts';

// =============================================================================
// SHARED UTILITIES — Imported from generation-utils.ts
// =============================================================================
import {
  calculateDays,
  formatDate,
  timeToMinutes,
  calculateDuration,
  getCategoryIcon,
  normalizeVenueName,
  haversineDistanceKm,
  getDestinationId,
  getAirportTransferMinutes,
  getAirportTransferFare,
} from './generation-utils.ts';

// =============================================================================
// VENUE ENRICHMENT PIPELINE — Imported from venue-enrichment.ts
// =============================================================================
import {
  checkVenueCache,
  cacheVerifiedVenue,
  getDestinationCenter,
  verifyVenueWithGooglePlaces,
  verifyVenueWithDualAI,
  fetchActivityImage,
  isBookableActivity,
  searchViatorForActivity,
  enrichActivity,
  enrichActivityWithRetry,
  enrichItinerary,
} from './venue-enrichment.ts';

// =============================================================================
// EXTRACTED MODULES — Reduce bundle size for deploy
// =============================================================================
import {
  sanitizeDateString,
  sanitizeOptionFields,
  sanitizeAITextField,
  sanitizeGeneratedDay,
  sanitizeDateFields,
  normalizeDurationString,
  stripPhantomHotelActivities,
} from './sanitization.ts';

import {
  EXCHANGE_RATES_TO_USD,
  convertToUSD,
  normalizeCostToUSD,
  deriveIntelligenceFields,
  isRecurringEvent,
} from './currency-utils.ts';

import {
  buildSkipListPrompt,
  BUDGET_TRAIT_POLARITY,
  COMFORT_TRAIT_POLARITY,
  deriveBudgetIntent,
  buildBudgetConstraintsBlock,
  buildArchetypeConstraintsBlock as buildArchetypeConstraintsBlockLocal,
  formatGenerationRules,
  type BudgetIntent,
  type BudgetTierLevel,
  type SpendStyle,
} from './budget-constraints.ts';

// =============================================================================
// NEW PERSONALIZATION MODULES (Phase 8 - Make Itineraries Impossible to be Generic)
// =============================================================================
import {
  deriveForcedSlots,
  deriveScheduleConstraints,
  reconcileGroupPreferences,
  validateDayPersonalization,
  buildForcedSlotsPrompt,
  buildScheduleConstraintsPrompt,
  buildGroupReconciliationPrompt,
  type TraitScores,
  type TravelerProfile,
  type ForcedSlot,
  type ScheduleConstraints,
  type DayValidation,
  type ReconciliationStrategy
} from './personalization-enforcer.ts';

import {
  calculateConfidence as calculateTruthAnchorConfidence,
  needsFallback,
  verifyFromGooglePlaces,
  verifyFromCache,
  generateFallback,
  buildTruthAnchorPrompt,
  validateTruthAnchors,
  validateOpeningHours,
  type TruthAnchor,
  type OpeningHoursViolation
} from './truth-anchors.ts';

import {
  generateExplanation,
  validateExplanation,
  buildExplainabilityPrompt,
  type ExplainabilityContext,
  type Explanation
} from './explainability.ts';

// NOTE: cold-start.ts and feedback-instrumentation.ts were removed in cleanup phase.
// Cold start detection is now handled by profile-loader.ts dataCompleteness field.
// Feedback instrumentation was unused (empty tables).

import {
  getCuratedZones,
  assignToZone,
  determineDayAnchor,
  deriveTravelTimeConstraints,
  validateDayGeography,
  reorderActivitiesOptimally,
  buildGeographicPrompt,
  buildDayZonePrompt,
  logGeographicQAMetrics,
  haversineDistance,
  estimateTravelMinutes,
  type ZoneDefinition,
  type DayAnchor,
  type TravelTimeConstraints,
  type GeographicValidation,
  type ActivityWithLocation
} from './geographic-coherence.ts';

// =============================================================================
// PHASE 9: MODULAR PROMPT LIBRARY - Full DNA-Driven Personalization
// =============================================================================
import {
  buildDayPrompt,
  buildPersonaManuscript,
  extractFlightData,
  extractHotelData,
  buildTravelerDNA,
  buildTransitionDayPrompt,
  buildFlightIntelligencePrompt,
  type FlightData as PromptFlightData,
  type HotelData as PromptHotelData,
  type TravelerDNA,
  type TripContext as PromptTripContext,
  type DayConstraints
} from './prompt-library.ts';

// =============================================================================
// MEAL POLICY — Dynamic meal requirements per day shape
// =============================================================================
import {
  deriveMealPolicy,
  buildMealRequirementsPrompt,
  type MealPolicy,
  type MealPolicyInput,
  type RequiredMeal,
} from './meal-policy.ts';

// =============================================================================
// PHASE 15: DYNAMIC DIETARY ENFORCEMENT ENGINE
// =============================================================================
import {
  buildDietaryEnforcementPrompt,
  expandDietaryAvoidList,
  checkDietaryViolations,
  getMaxDietarySeverity,
  type DietaryViolation
} from './dietary-rules.ts';

// =============================================================================
// PHASE 12: Trip Duration + Reservation Urgency + Children Ages
// =============================================================================
import {
  getTripDurationConfig,
  calculateDayEnergies,
  buildTripDurationPrompt,
  analyzeChildrenAges,
  buildChildrenAgesPrompt,
} from './trip-duration-rules.ts';

import {
  buildReservationUrgencyPrompt,
} from './reservation-urgency.ts';

// =============================================================================
// PHASE 2: Advanced Temporal & Environmental Intelligence
// =============================================================================
import {
  calculateJetLagImpact,
  buildJetLagPrompt,
  resolveTimezone,
} from './jet-lag-calculator.ts';

import {
  buildWeatherBackupPrompt,
  determineSeason,
} from './weather-backup.ts';

import {
  buildDailyEstimatesPrompt,
} from './daily-estimates.ts';

// =============================================================================
// PHASE 3: Premium Features - Group, Commitments, Must-Dos, Packing
// =============================================================================
import {
  blendGroupArchetypes,
  blendTraitScores,
  type TravelerArchetype,
} from './group-archetype-blending.ts';

import {
  analyzePreBookedCommitments,
  type PreBookedCommitment,
} from './pre-booked-commitments.ts';

import {
  parseMustDoInput,
  scheduleMustDos,
  buildMustHavesConstraintPrompt,
  getBlockedTimeRange,
  validateMustDosInItinerary,
  type MustDoPriority,
  type ScheduledMustDo,
  type ActivityType,
} from './must-do-priorities.ts';

import {
  generatePackingSuggestions,
} from './packing-suggestions.ts';

// =============================================================================
// PHASE 13: UNIFIED ARCHETYPE DATA - Single Source of Truth for All Archetype Info
// Merges: archetype-constraints.ts + experience-affinity.ts + destination-guides.ts
// =============================================================================
import {
  getFullArchetypeContext,
  buildFullPromptGuidance,
  buildFullPromptGuidanceAsync,
  getMaxActivities,
  isSpaOK,
  isMichelinOK,
  needsUnscheduledTime,
  // Re-exports for backward compatibility during migration
  buildAllConstraints,
  buildArchetypeConstraintsBlock as buildArchetypeConstraintsBlockNew,
  buildBudgetConstraints as buildBudgetConstraintsNew,
  buildTripWideVarietyRules,
  buildUnscheduledTimeRules,
  buildPacingRules,
  buildNamingRules,
  getArchetypeDefinition,
  buildExperienceGuidancePrompt,
  getExperienceAffinity,
  getTimePreferences,
  getEnvironmentPreferences,
  getPhysicalIntensity,
  buildDestinationGuidancePrompt,
  hasDestinationGuide,
  getArchetypeDestinationGuide,
  // New dynamic attraction matching (Phase 14)
  getMatchingAttractions,
  getOrGenerateArchetypeGuide,
  buildMatchedAttractionsPrompt,
  buildArchetypeGuidePrompt,
  EXPERIENCE_CATEGORIES,
} from './archetype-data.ts';

// =============================================================================
// PHASE 14: TRIP TYPE MODIFIERS - First-class input for celebration/group/purpose trips
// =============================================================================
import {
  buildTripTypePromptSection,
  getTripTypeModifier,
  getTripTypeInteraction,
} from './trip-type-modifiers.ts';

// =============================================================================
// PHASE 13B: UNIFIED PROFILE LOADER - Single Source of Truth for Traveler Data
// =============================================================================
import {
  loadTravelerProfile,
  type TravelerProfile as UnifiedTravelerProfile,
  type TraitScores as UnifiedTraitScores,
  type BudgetTier,
} from './profile-loader.ts';

// =============================================================================
// PHASE 10: DESTINATION ESSENTIALS - Non-Negotiable Landmarks & Hidden Gems
// Now with DB-driven data + freshness-based Perplexity enrichment
// =============================================================================
import {
  buildDestinationEssentialsPrompt,
  buildDestinationEssentialsPromptWithDB,
  getDestinationIntelligence,
  hasCuratedEssentials,
} from './destination-essentials.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// sanitization functions moved to ./sanitization.ts

// Types (MultiCityDayInfo, GenerationContext, StrictActivity, StrictDay, TravelAdvisory,
// LocalEventInfo, TripOverview, EnrichedItinerary) moved to ./generation-types.ts

// currency-utils, intelligence fields, and isRecurringEvent moved to ./currency-utils.ts


// validateItineraryPersonalization + buildValidationContext moved to ./generation-types.ts


// getDestinationId moved to ./generation-utils.ts


// =============================================================================
// TOURIST TRAP SKIP LIST
// Destination-specific activities we tell users to avoid - AI must not plan these
// =============================================================================
// Skip list, budget intent, budget constraints, archetype constraints, and generation rules
// moved to ./budget-constraints.ts


// User context normalization moved to ./user-context-normalization.ts
import {
  normalizeUserContext,
  buildNormalizedPromptContext,
  blendTraitWithOverride,
  calculateQuizCompleteness,
  deduplicatePreferences,
  inferArchetypesFromTraits,
  type NormalizedTraits,
  type NormalizedUserContext,
} from './user-context-normalization.ts';

// =============================================================================
// RATE LIMITING - Database-backed (survives cold starts)
// =============================================================================
import { checkDbRateLimit, type RateLimitRule } from "../_shared/db-rate-limiter.ts";

const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  'generate-full': { maxRequests: 3, windowMs: 300000 }, // 3 full generations per 5 min
  'generate-day': { maxRequests: 20, windowMs: 60000 },   // 20 day generations per min
  default: { maxRequests: 20, windowMs: 60000 }           // 20 requests per min for other actions
};

async function checkRateLimit(
  supabaseAdmin: any,
  userId: string,
  action: string
): Promise<{ allowed: boolean; remaining: number }> {
  const rule = RATE_LIMIT_RULES[action] || RATE_LIMIT_RULES.default;
  const result = await checkDbRateLimit(
    supabaseAdmin,
    userId,
    `generate-itinerary:${action}`,
    rule,
    userId,
  );
  return { allowed: result.allowed, remaining: result.remaining };
}


// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// =============================================================================
// GROUP PREFERENCE BLENDING - For multi-traveler trips with linked friends
// =============================================================================

// =============================================================================
// EXTRACTED MODULES — Preference context, flight/hotel, group blending
// =============================================================================
import {
  getFlightHotelContext,
  getDynamicTransferPricing,
  getAirportTransferTime,
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  normalizeTo24h,
  type FlightHotelContextResult,
  type AirportTransferFare,
  type DynamicTransferResult,
} from './flight-hotel-context.ts';

import {
  getTravelDNAV2,
  getTraitOverrides,
  getUserPreferences,
  getLearnedPreferences,
  getBehavioralEnrichment,
  getCollaboratorPreferences,
  blendGroupPreferences,
  buildTravelDNAContext,
  buildPreferenceContext,
  enrichPreferencesWithAI,
  type TravelDNAProfile,
  type PreferenceProfile,
} from './preference-context.ts';

// Types, group blending, and collaborator preferences moved to ./preference-context.ts

// FlightHotelContextResult, time helpers, and getDynamicTransferPricing moved to ./flight-hotel-context.ts

// getAirportTransferFare, getAirportTransferMinutes moved to ./generation-utils.ts


// getFlightHotelContext moved to ./flight-hotel-context.ts

// getLearnedPreferences and getBehavioralEnrichment moved to ./preference-context.ts

// getUserPreferences, getTravelDNAV2, getTraitOverrides moved to ./preference-context.ts

// calculateDays, formatDate, timeToMinutes, calculateDuration, getCategoryIcon moved to ./generation-utils.ts


// =============================================================================
// STAGE 1: CONTEXT PREPARATION
// =============================================================================

// DirectTripData moved to ./generation-types.ts


// eslint-disable-next-line @typescript-eslint/no-explicit-any

import { handleGenerateFull } from './action-generate-full.ts';
// generation-core.ts contains shared infrastructure (prepareContext, generateSingleDayWithRetry, etc.)
// imported by action-generate-full.ts and potentially action-generate-day.ts

// prepareContext, generateSingleDayWithRetry, generateItineraryAI,
// earlySaveItinerary, generateTripOverview, triggerNextJourneyLeg,
// finalSaveItinerary → moved to ./generation-core.ts


// =============================================================================
// AUTHENTICATION HELPER
// =============================================================================
async function validateAuth(req: Request, supabase: any): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

// =============================================================================
// TRIP ACCESS VERIFICATION HELPER
// Verifies user has access to trip (owner or accepted collaborator with edit permission)
// =============================================================================
interface TripAccessResult {
  allowed: boolean;
  isOwner: boolean;
  reason?: string;
}

async function verifyTripAccess(
  supabase: any,
  tripId: string,
  userId: string,
  requireEditPermission: boolean = false
): Promise<TripAccessResult> {
  if (!tripId || !userId) {
    return { allowed: false, isOwner: false, reason: "Missing tripId or userId" };
  }
  
  // Check if user is the trip owner
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();
  
  if (tripError || !trip) {
    return { allowed: false, isOwner: false, reason: "Trip not found" };
  }
  
  // Owner has full access
  if (trip.user_id === userId) {
    return { allowed: true, isOwner: true };
  }
  
  // Check collaborator access
  const { data: collab } = await supabase
    .from('trip_collaborators')
    .select('permission')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  
  if (!collab) {
    return { allowed: false, isOwner: false, reason: "Access denied - not a collaborator" };
  }
  
  // If we need edit permission, check the permission level
  if (requireEditPermission) {
    const hasEditPermission = collab.permission === 'edit' || 
                              collab.permission === 'admin' ||
                              collab.permission === 'editor' ||
                              collab.permission === 'contributor';
    if (!hasEditPermission) {
      return { allowed: false, isOwner: false, reason: "Viewer access only - cannot generate itinerary" };
    }
  }
  
  return { allowed: true, isOwner: false };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Service-role auth bypass for server-to-server self-chaining ──
    // When generate-trip-day calls itself via fetch() with the SERVICE_ROLE_KEY,
    // validateAuth() fails because a service role key is not a user JWT.
    // Detect this case and trust the userId from the request body instead.
    const bearerToken = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const isServiceRoleCall = bearerToken === supabaseKey;

    let authResult: { userId: string } | null = null;

    if (isServiceRoleCall) {
      // Parse body to peek at action + userId (we'll re-parse later via req.json() — 
      // but since we need to check before full routing, clone the request)
      const clonedReq = req.clone();
      const peekBody = await clonedReq.json();
      
      const allowedServiceRoleActions = ['generate-trip', 'generate-trip-day', 'generate-day', 'regenerate-day'];
      if (allowedServiceRoleActions.includes(peekBody.action) && peekBody.userId) {
        // Trusted internal call — skip user-auth, use provided userId
        authResult = { userId: peekBody.userId };
        console.log(`[generate-itinerary] Service-role bypass for ${peekBody.action}, userId: ${authResult.userId}`);
      } else {
        // Service role key used for a non-whitelisted action — reject
        console.error(`[generate-itinerary] Service-role call for non-whitelisted action: ${peekBody.action}`);
        return new Response(
          JSON.stringify({ error: "Unauthorized action for service role" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Normal user request — validate JWT as usual
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
      });

      authResult = await validateAuth(req, authClient);
      if (!authResult) {
        console.error("[generate-itinerary] Unauthorized request");
        return new Response(
          JSON.stringify({ error: "Unauthorized. Please sign in to generate itineraries." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    console.log(`[generate-itinerary] Authenticated user: ${authResult.userId}`);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[generate-itinerary] Action: ${action}`);

    // Rate limit check for expensive operations
    const rateCheck = await checkRateLimit(supabase, authResult.userId, action);
    if (!rateCheck.allowed) {
      console.log(`[generate-itinerary] Rate limit exceeded for ${authResult.userId} on ${action}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a few minutes before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": "0" } }
      );
    }

    // ==========================================================================
    // ACTION: generate-full - Complete 7-stage pipeline
    // ==========================================================================
    if (action === 'generate-full') {
      const authHeaderValue = req.headers.get('Authorization') || '';
      return handleGenerateFull(supabase, authResult.userId, params, authHeaderValue);
    }


    // ==========================================================================
    // ACTION: generate-day / regenerate-day - Single day generation with flight/hotel awareness
    // ==========================================================================
    if (action === 'generate-day' || action === 'regenerate-day') {
      return handleGenerateDay(supabase, authResult.userId, params);
    }


    // ==========================================================================
    // EXTRACTED ACTIONS — Delegated to separate files for maintainability
    // Each handler receives an explicit ActionContext (no implicit scope leaking)
    // ==========================================================================
    if (action === 'get-trip') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleGetTrip(actCtx);
    }

    if (action === 'save-itinerary') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleSaveItinerary(actCtx);
    }

    if (action === 'get-itinerary') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleGetItinerary(actCtx);
    }

    if (action === 'toggle-activity-lock') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleToggleActivityLock(actCtx);
    }

    if (action === 'sync-itinerary-tables') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleSyncItineraryTables(actCtx);
    }

    if (action === 'repair-trip-costs') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleRepairTripCosts(actCtx);
    }

    // ==========================================================================
    // ACTION: generate-trip — Delegated to extracted action handler
    // ==========================================================================
    if (action === 'generate-trip') {
      return handleGenerateTrip(supabase, authResult.userId, params);
    }

    // ==========================================================================
    // ACTION: generate-trip-day — Delegated to extracted action handler
    // ==========================================================================
    if (action === 'generate-trip-day') {
      return handleGenerateTripDay(supabase, authResult.userId, params);
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-itinerary] Error:", error);

    // Best-effort: mark trip as failed so the frontend stops showing infinite spinner
    try {
      const failTripId = typeof params === 'object' && params?.tripId;
      if (failTripId && typeof supabase !== 'undefined') {
        await supabase.from('trips').update({ itinerary_status: 'failed' }).eq('id', failTripId);
        console.log(`[generate-itinerary] Marked trip ${failTripId} as failed`);
      }
    } catch (statusErr) {
      console.error("[generate-itinerary] Failed to set itinerary_status=failed:", statusErr);
    }

    return new Response(
      JSON.stringify({ success: false, error: "Itinerary generation failed", code: "GENERATE_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
