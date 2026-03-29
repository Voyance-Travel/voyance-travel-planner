/**
 * Action handler for 'generate-full' — the complete 7-stage itinerary pipeline.
 * Extracted from index.ts (Phase 3).
 */

import { corsHeaders, verifyTripAccess, okJson, errorJson } from './action-types.ts';

import type {
  GenerationContext,
  StrictActivity,
  StrictDay,
  TravelAdvisory,
  LocalEventInfo,
  TripOverview,
  EnrichedItinerary,
  EnrichmentStats,
  ValidationContext,
} from './generation-types.ts';

import {
  validateItineraryPersonalization,
  buildValidationContext,
} from './generation-types.ts';

import {
  calculateDays,
  formatDate,
  getDestinationId,
  haversineDistanceKm,
} from './generation-utils.ts';

import {
  prepareContext,
  generateItineraryAI,
  earlySaveItinerary,
  generateTripOverview,
  finalSaveItinerary,
} from './generation-core.ts';

import {
  enrichItinerary,
} from './venue-enrichment.ts';

import {
  getFlightHotelContext,
  getDynamicTransferPricing,
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  normalizeTo24h,
  type FlightHotelContextResult,
  type DynamicTransferResult,
} from './flight-hotel-context.ts';

import {
  getUserPreferences,
  getLearnedPreferences,
  getCollaboratorPreferences,
  blendGroupPreferences,
  buildPreferenceContext,
  enrichPreferencesWithAI,
  type PreferenceProfile,
} from './preference-context.ts';

import {
  loadTravelerProfile,
} from './profile-loader.ts';

import {
  deriveBudgetIntent,
  buildSkipListPrompt,
  formatGenerationRules,
} from './budget-constraints.ts';

import {
  buildDayPrompt,
  extractFlightData,
  extractHotelData,
  buildTravelerDNA,
  buildFlightIntelligencePrompt,
  type FlightData as PromptFlightData,
  type HotelData as PromptHotelData,
} from './prompt-library.ts';

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
  validateMustDosInItinerary,
} from './must-do-priorities.ts';

import {
  deriveForcedSlots,
  deriveScheduleConstraints,
  reconcileGroupPreferences,
  buildForcedSlotsPrompt,
  buildScheduleConstraintsPrompt,
  buildGroupReconciliationPrompt,
  type TraitScores,
  type TravelerProfile,
  type ReconciliationStrategy,
} from './personalization-enforcer.ts';

import {
  buildExplainabilityPrompt,
  type ExplainabilityContext,
} from './explainability.ts';

import {
  buildTruthAnchorPrompt,
  validateOpeningHours,
} from './truth-anchors.ts';

import {
  getCuratedZones,
  determineDayAnchor,
  deriveTravelTimeConstraints,
  validateDayGeography,
  reorderActivitiesOptimally,
  buildGeographicPrompt,
  logGeographicQAMetrics,
  type ZoneDefinition,
  type TravelTimeConstraints,
  type GeographicValidation,
  type ActivityWithLocation,
} from './geographic-coherence.ts';

import {
  buildFullPromptGuidanceAsync,
} from './archetype-data.ts';

import {
  buildTripTypePromptSection,
} from './trip-type-modifiers.ts';

import {
  buildDietaryEnforcementPrompt,
  expandDietaryAvoidList,
  getMaxDietarySeverity,
} from './dietary-rules.ts';

import {
  normalizeDurationString,
} from './sanitization.ts';

import {
  normalizeCostToUSD,
  deriveIntelligenceFields,
} from './currency-utils.ts';

import {
  getAirportTransferFare,
} from './generation-utils.ts';


export async function handleGenerateFull(
  supabase: any,
  userId: string, 
  params: Record<string, any>,
  authHeader?: string,
): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (action === 'generate-full') {
      const { tripId, tripData, smartFinishMode: requestSmartFinishMode } = params;
      
      // PHASE 2 FIX: Use authenticated user ID as the canonical source of truth
      // This fixes missing personalization and hardens security (prevents userId spoofing)
      const userId = userId;
      
      // Security guard: if request body includes userId that differs from auth token, log and reject
      if (params.userId && params.userId !== userId) {
        console.warn(`[generate-full] userId mismatch! auth=${userId}, params=${params.userId} - rejecting`);
        return new Response(
          JSON.stringify({ error: "User ID mismatch. Please re-authenticate." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verify trip access: user must be owner or accepted collaborator with edit permission
      const tripAccessResult = await verifyTripAccess(supabase, tripId, userId, true);
      if (!tripAccessResult.allowed) {
        console.warn(`[generate-full] Access denied: user=${userId}, trip=${tripId}, reason=${tripAccessResult.reason}`);
        return new Response(
          JSON.stringify({ error: tripAccessResult.reason || "Trip not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[generate-full] ✓ Using authenticated userId: ${userId} (trip owner: ${tripAccessResult.isOwner})`);

      // =========================================================================
      // Credit authorization is handled by the client-side generation gate
      // (useGenerationGate.ts) BEFORE this function is called.
      // The gate charges credits at 60/day and only invokes this function
      // when authorized. No duplicate check needed here.
      // =========================================================================
      let originalTotalDays = 0; // Set after context prep

      // =======================================================================
      // STAGE 1.1: Prepare trip context (MUST happen before any context.* access)
      // =======================================================================
      const context = await prepareContext(supabase, tripId, userId, undefined, requestSmartFinishMode);
      if (!context) {
        console.error(`[generate-full] prepareContext returned null for trip ${tripId}`);
        return new Response(
          JSON.stringify({ error: "Trip not found or missing required data" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      originalTotalDays = context.totalDays;
      console.log(`[Stage 1.1] ✓ Context prepared: ${context.totalDays} days in ${context.destination}`);

      // Get user preferences for personalization
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      let prefs = userId ? await getUserPreferences(supabase, userId) : null;
      
      // =======================================================================
      // GROUP PREFERENCE BLENDING - For multi-traveler trips with linked friends
      // =======================================================================
      console.log("[Stage 1.2] Checking for trip collaborators...");
      const collaboratorPrefs = await getCollaboratorPreferences(supabase, tripId);
      let groupBlendingPromptSection = '';
      let blendedDnaSnapshot: Record<string, unknown> | null = null;
      
      if (collaboratorPrefs.length > 0) {
        console.log(`[Stage 1.2] Found ${collaboratorPrefs.length} collaborators - blending preferences`);
        
        // Include primary user's preferences in the blend
        const allProfiles: PreferenceProfile[] = prefs 
          ? [{ user_id: userId || 'primary', ...prefs }, ...collaboratorPrefs]
          : collaboratorPrefs;
        
        // Blend all preferences with organizer (primary user) having higher weight
        const blendedPrefs = blendGroupPreferences(allProfiles, userId);
        
        if (blendedPrefs) {
          console.log(`[Stage 1.2] Blended group preferences successfully`);
          prefs = blendedPrefs;
        }

        // Build collaborator traveler list for suggestedFor attribution
        // Query BOTH trip_collaborators AND trip_members
        const [{ data: collabRows }, { data: memberRows }] = await Promise.all([
          supabase
            .from('trip_collaborators')
            .select('user_id')
            .eq('trip_id', tripId)
            .eq('include_preferences', true),
          supabase
            .from('trip_members')
            .select('user_id')
            .eq('trip_id', tripId)
            .not('user_id', 'is', null),
        ]);

        // Merge unique participant IDs from both tables
        const participantIds = new Set<string>();
        (collabRows || []).forEach((c: any) => { if (c.user_id) participantIds.add(c.user_id); });
        (memberRows || []).forEach((m: any) => { if (m.user_id) participantIds.add(m.user_id); });
        participantIds.delete(userId || ''); // Remove owner, we'll prepend

        const allUserIds = [userId, ...Array.from(participantIds)].filter(Boolean);
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, display_name, handle')
          .in('id', allUserIds);

        const profileMap = new Map((profileRows || []).map((p: any) => [p.id, p.display_name || p.handle || 'Guest']));

        context.collaboratorTravelers = allUserIds.map(uid => ({
          userId: uid!,
          name: profileMap.get(uid!) || 'Traveler',
        }));
        console.log(`[Stage 1.2] Attribution travelers: ${context.collaboratorTravelers.map(t => `${t.name}(${t.userId.slice(0,8)})`).join(', ')} (collabs: ${(collabRows || []).length}, members: ${(memberRows || []).length})`);

        // =======================================================================
        // STAGE 1.2.1: ARCHETYPE-LEVEL GROUP BLENDING
        // Load each companion's Travel DNA, run blendGroupArchetypes(), inject prompt
        // =======================================================================
        console.log("[Stage 1.2.1] Loading companion archetypes for group blending...");
        try {
          // Load companion DNA profiles
          const companionUserIds = Array.from(participantIds).filter(Boolean);
          const { data: companionDnaRows } = await supabase
            .from('travel_dna_profiles')
            .select('user_id, primary_archetype_name, trait_scores, travel_dna_v2')
            .in('user_id', companionUserIds);

          // Build TravelerArchetype array for blendGroupArchetypes
          const travelers: TravelerArchetype[] = [];
          
          // Add owner
          const ownerDnaRow = await supabase
            .from('travel_dna_profiles')
            .select('primary_archetype_name, trait_scores')
            .eq('user_id', userId)
            .maybeSingle();
          
          const ownerArchetype = ownerDnaRow?.data?.primary_archetype_name || 'balanced_story_collector';
          travelers.push({
            travelerId: userId,
            name: profileMap.get(userId) || 'You',
            archetype: ownerArchetype,
            isPrimary: true,
          });

          // Add companions with DNA
          const companionTraitScoresMap = new Map<string, Record<string, number>>();
          for (const dna of (companionDnaRows || [])) {
            const archetype = dna.primary_archetype_name 
              || (dna.travel_dna_v2 as any)?.primary_archetype_name 
              || 'balanced_story_collector';
            travelers.push({
              travelerId: dna.user_id,
              name: profileMap.get(dna.user_id) || 'Guest',
              archetype,
              isPrimary: false,
            });
            // Store trait scores for blending
            const rawScores = dna.trait_scores || (dna.travel_dna_v2 as any)?.trait_scores || {};
            companionTraitScoresMap.set(dna.user_id, {
              pace: Number(rawScores.pace ?? rawScores.travel_pace ?? 0),
              budget: Number(rawScores.budget ?? rawScores.value_focus ?? 0),
              social: Number(rawScores.social ?? rawScores.social_battery ?? 0),
              planning: Number(rawScores.planning ?? rawScores.planning_preference ?? 0),
              comfort: Number(rawScores.comfort ?? rawScores.comfort_level ?? 0),
              authenticity: Number(rawScores.authenticity ?? rawScores.cultural_depth ?? 0),
              adventure: Number(rawScores.adventure ?? rawScores.risk_tolerance ?? 0),
              cultural: Number(rawScores.cultural ?? rawScores.cultural_interest ?? 0),
              transformation: Number(rawScores.transformation ?? rawScores.wellness ?? 0),
            });
          }

          if (travelers.length > 1) {
            // Run archetype-level blending (day assignments, conflicts, split activities)
            const blendResult = await blendGroupArchetypes(travelers, context.totalDays, context.destination);
            groupBlendingPromptSection = blendResult.promptSection;
            console.log(`[Stage 1.2.1] ✓ Group archetype blending complete: ${travelers.length} travelers, ${blendResult.conflicts.length} conflicts, ${blendResult.splitOpportunities.length} split opportunities`);

            // Build blended trait scores snapshot using shared helper
            const ownerTraits = ownerDnaRow?.data?.trait_scores || {};
            const ownerTraitsNormalized: Record<string, number> = {
              pace: Number(ownerTraits.pace ?? 0),
              budget: Number(ownerTraits.budget ?? 0),
              social: Number(ownerTraits.social ?? 0),
              planning: Number(ownerTraits.planning ?? 0),
              comfort: Number(ownerTraits.comfort ?? 0),
              authenticity: Number(ownerTraits.authenticity ?? 0),
              adventure: Number(ownerTraits.adventure ?? 0),
              cultural: Number(ownerTraits.cultural ?? 0),
              transformation: Number(ownerTraits.transformation ?? 0),
            };

            const companionTraitsList = companionUserIds
              .map((uid: string) => companionTraitScoresMap.get(uid))
              .filter(Boolean) as Record<string, number>[];

            const blendedTraits = blendTraitScores(ownerTraitsNormalized, companionTraitsList);
            const ownerWeight = 0.5;
            const companionWeight = companionTraitsList.length > 0 ? 0.5 / companionTraitsList.length : 0;

            blendedDnaSnapshot = {
              blendedTraits,
              travelers: travelers.map(t => ({
                userId: t.travelerId,
                name: t.name,
                archetype: t.archetype,
                weight: t.isPrimary ? ownerWeight : companionWeight,
                isPrimary: t.isPrimary,
              })),
              blendMethod: 'weighted_average',
              generatedAt: new Date().toISOString(),
              conflicts: blendResult.conflicts.length,
              dayAssignments: blendResult.dayAssignments,
            };

            // Store group archetypes and blended DNA on context for downstream modules
            context.groupArchetypes = travelers;
            context.blendedDnaSnapshot = blendedDnaSnapshot;
          }
        } catch (blendErr) {
          console.warn("[Stage 1.2.1] Archetype blending failed (non-blocking):", blendErr);
        }
      }
      
      // =======================================================================
      // UNIFIED PROFILE LOADER - Single Source of Truth (Phase 2 Fix)
      // =======================================================================
      console.log("[Stage 1.3] Loading unified traveler profile...");
      const unifiedProfile = await loadTravelerProfile(supabase, userId, tripId, context.destination);
      
      // =======================================================================
      // STAGE 1.3.1: Merge Blended DNA into Unified Profile (Group Trip Fix)
      // =======================================================================
      if (context.blendedDnaSnapshot?.blendedTraits) {
        const blended = context.blendedDnaSnapshot.blendedTraits;
        for (const [key, value] of Object.entries(blended)) {
          if (key in unifiedProfile.traitScores) {
            (unifiedProfile.traitScores as Record<string, number>)[key] = value as number;
          }
        }
        console.log("[Stage 1.3.1] ✓ Overrode trait scores with blended group DNA");
      }
      
      console.log(`[Stage 1.3] ✓ Profile loaded via unified loader:`);
      console.log(`[Stage 1.3]   archetype=${unifiedProfile.archetype} (source: ${unifiedProfile.archetypeSource})`);
      console.log(`[Stage 1.3]   completeness=${unifiedProfile.dataCompleteness}%, fallback=${unifiedProfile.isFallback}`);
      console.log(`[Stage 1.3]   traits: pace=${unifiedProfile.traitScores.pace}, budget=${unifiedProfile.traitScores.budget}`);
      console.log(`[Stage 1.3]   avoidList: ${unifiedProfile.avoidList.length} items`);
      if (unifiedProfile.warnings.length > 0) {
        console.warn(`[Stage 1.3]   warnings: ${unifiedProfile.warnings.join(', ')}`);
      }
      
      // =======================================================================
      // PHASE 2 FIX: Removed legacy getTravelDNAV2 + normalizeUserContext dual path
      // All traveler data now comes from unifiedProfile (single source of truth)
      // =======================================================================
      
      // Derive budget intent directly from unified profile (no redundant normalization)
      const budgetIntent = deriveBudgetIntent(
        context.budgetTier,
        unifiedProfile.traitScores.budget,
        unifiedProfile.traitScores.comfort
      );
      
      // Log budget conflict if detected
      if (budgetIntent?.conflict) {
        console.log(`[Stage 1.3] 🚨 BUDGET CONFLICT: ${budgetIntent.conflictDetails}`);
        console.log(`[Stage 1.3] Reconciled to: ${budgetIntent.notes}`);
      }
      
      // Log budget conflict if detected
      if (budgetIntent?.conflict) {
        console.log(`[Stage 1.3] 🚨 BUDGET CONFLICT: ${budgetIntent.conflictDetails}`);
        console.log(`[Stage 1.3] Reconciled to: ${budgetIntent.notes}`);
        
        // Log conflict event for analytics
        try {
          await supabase.from('voyance_events').insert({
            user_id: userId,
            event_type: 'budget_intent_conflict',
            properties: {
              budget_tier: context.budgetTier,
              budget_trait: unifiedProfile.traitScores.budget,
              comfort_trait: unifiedProfile.traitScores.comfort,
              resolved_tier: budgetIntent.tier,
              resolved_spend_style: budgetIntent.spendStyle,
              confidence: unifiedProfile.dataCompleteness,
            },
          });
        } catch (logErr) {
          console.warn('[Stage 1.3] Failed to log conflict event:', logErr);
        }
      }
      
      // =======================================================================
      // FLIGHT & HOTEL CONTEXT - Use booked flight/hotel in itinerary planning
      // =======================================================================
      console.log("[Stage 1.4] Fetching flight and hotel context...");
      let flightHotelResult = await getFlightHotelContext(supabase, tripId);
      
      // IMPORTANT: Use tripData.arrivalTime/departureTime as fallback when DB doesn't have flight data
      // This handles the case where user entered times in ItineraryContextForm but hasn't saved flight_selection
      if (tripData?.arrivalTime && !flightHotelResult.arrivalTime) {
        const arrival24 = normalizeTo24h(tripData.arrivalTime) || tripData.arrivalTime;
        const ARRIVAL_BUFFER_MINS = 4 * 60;
        const earliestActivity = minutesToHHMM((parseTimeToMinutes(arrival24) || 0) + ARRIVAL_BUFFER_MINS);
        
        flightHotelResult = {
          ...flightHotelResult,
          arrivalTime: tripData.arrivalTime,
          arrivalTime24: arrival24,
          earliestFirstActivityTime: earliestActivity,
          context: flightHotelResult.context || `Flight arrives at ${tripData.arrivalTime}. Plan Day 1 activities after ${earliestActivity}.`,
        };
        console.log(`[Stage 1.4] Using arrival time from tripData: ${tripData.arrivalTime}, earliest activity: ${earliestActivity}`);
      }
      
      if (tripData?.departureTime && !flightHotelResult.returnDepartureTime) {
        const departure24 = normalizeTo24h(tripData.departureTime) || tripData.departureTime;
        const latestActivity = addMinutesToHHMM(departure24, -180);
        
        flightHotelResult = {
          ...flightHotelResult,
          returnDepartureTime: tripData.departureTime,
          returnDepartureTime24: departure24,
          latestLastActivityTime: latestActivity,
          context: (flightHotelResult.context || '') + ` Return flight departs at ${tripData.departureTime}. Last activity must end by ${latestActivity}.`,
        };
        console.log(`[Stage 1.4] Using departure time from tripData: ${tripData.departureTime}, latest activity: ${latestActivity}`);
      }
      
      if (flightHotelResult.context) {
        console.log("[Stage 1.4] Flight/hotel context added to AI prompt");
        if (flightHotelResult.earliestFirstActivityTime) {
          console.log(`[Stage 1.4] Day 1 earliest activity: ${flightHotelResult.earliestFirstActivityTime}`);
        }
        if (flightHotelResult.latestLastActivityTime) {
          console.log(`[Stage 1.4] Last day latest activity: ${flightHotelResult.latestLastActivityTime}`);
        }
      }
      
      // =======================================================================
      // PHASE 9: Build TravelerDNA and Flight/Hotel data for prompt library
      // This enables the modular decision tree: Flight → Hotel → DNA
      // =======================================================================
      console.log("[Stage 1.4.5] Building DNA/Flight/Hotel data for prompt library...");
      
      // Extract flight data using prompt-library extractors
      const promptFlightData = extractFlightData(flightHotelResult.rawFlightSelection);
      const promptHotelData = extractHotelData(flightHotelResult.rawHotelSelection);
      
      // Build flight intelligence prompt if available
      const flightIntelligencePrompt = buildFlightIntelligencePrompt(flightHotelResult.rawFlightIntelligence);
      if (flightIntelligencePrompt) {
        console.log("[Stage 1.4.5] Flight intelligence prompt injected into context");
        context.flightIntelligencePrompt = flightIntelligencePrompt;
      }
      
      // Build TravelerDNA from unified profile (Phase 2 Fix: no legacy travelDNA/traitOverrides)
      const promptTravelerDNA = buildTravelerDNA(
        { 
          primary_archetype_name: unifiedProfile.archetype,
          trait_scores: unifiedProfile.traitScores,
          archetype_matches: [{ name: unifiedProfile.archetype }]
        } as Record<string, unknown>,
        prefs as Record<string, unknown> | null,
        unifiedProfile.traitScores as unknown as Record<string, number>
      );
      
      // Inject into context for use in generateSingleDayWithRetry
      context.travelerDNA = promptTravelerDNA;
      context.flightData = promptFlightData;
      context.hotelData = promptHotelData;
      
      // ─── Cross-day flight detection ───
      // If the outbound flight arrives on a date AFTER the trip start_date,
      // Day 1 is a departure/travel day. Log this for debugging.
      if (promptFlightData.arrivalDate && promptFlightData.departureDate
          && promptFlightData.arrivalDate > promptFlightData.departureDate) {
        console.log(`[Stage 1.4.5] ✈️ CROSS-DAY FLIGHT DETECTED: departs ${promptFlightData.departureDate}, arrives ${promptFlightData.arrivalDate}`);
        console.log(`[Stage 1.4.5] Day 1 will be a DEPARTURE TRAVEL DAY (no destination activities)`);
      }
      
      console.log(
        `[Stage 1.4.5] DNA injected: primary=${promptTravelerDNA.primaryArchetype || 'none'}, secondary=${promptTravelerDNA.secondaryArchetype || 'none'}, tripBudgetTier=${context.budgetTier || 'none'}, pace=${promptTravelerDNA.traits.pace}, flight=${promptFlightData.hasOutboundFlight}, hotel=${promptHotelData.hasHotel}, arrivalDate=${promptFlightData.arrivalDate || 'none'}, departureDate=${promptFlightData.departureDate || 'none'}`
      );
      
      // =======================================================================
      // AIRPORT TRANSFER FARE - Dynamic pricing with Viator + database + Google Maps
      // =======================================================================
      console.log("[Stage 1.5] Fetching dynamic transfer pricing...");
      
      // Get hotel address from flight/hotel context for accurate distance calculation
      const hotelDestination = flightHotelResult.hotelAddress || `${context.destination} city center`;
      const airportOrigin = `${context.destination} Airport`;
      
      // Try dynamic pricing first (Viator + Google Maps + database)
      let dynamicTransfer: DynamicTransferResult | null = null;
      try {
        dynamicTransfer = await getDynamicTransferPricing(
          supabaseUrl,
          airportOrigin,
          hotelDestination,
          context.destination,
          context.travelers || 2,
          context.startDate
        );
      } catch (e) {
        console.warn("[Stage 1.5] Dynamic pricing failed, falling back to database:", e);
      }
      
      // Fallback to database-only if dynamic pricing fails
      const airportFare = await getAirportTransferFare(supabase, context.destination);
      if (dynamicTransfer?.recommendedOption) {
        console.log(`[Stage 1.5] Dynamic pricing: ${dynamicTransfer.recommendedOption.priceFormatted} (${dynamicTransfer.source})`);
      } else if (airportFare) {
        console.log(`[Stage 1.5] Database fare: taxi ${airportFare.currencySymbol}${airportFare.taxiCostMin}-${airportFare.taxiCostMax}`);
      }
      
      // Build raw preference context (structured data)
      const rawPreferenceContext = buildPreferenceContext(insights, prefs);
      
      // STAGE 1.6: AI-Enrich preferences ("fluffing" layer)
      // Transform raw preferences into rich, detailed AI guidance
      console.log("[Stage 1.6] Enriching preferences with AI...");
      let enrichedPreferenceContext = "";
      if (prefs && Object.values(prefs).some(v => v !== null)) {
        try {
          enrichedPreferenceContext = await enrichPreferencesWithAI(prefs, context.destination, LOVABLE_API_KEY);
          console.log("[Stage 1.6] Preference enrichment complete");
        } catch (enrichError) {
          console.warn("[Stage 1.6] Preference enrichment failed, using raw context:", enrichError);
        }
      }
      
      // STAGE 1.7: Fetch past trip learnings for continuous improvement
      console.log("[Stage 1.7] Fetching past trip learnings...");
      let tripLearningsContext = "";
      try {
        const { data: learnings } = await supabase
          .from('trip_learnings')
          .select('*')
          .eq('user_id', userId)
          .not('lessons_summary', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(3);
        
        if (learnings && learnings.length > 0) {
          const sections: string[] = [];
          
          for (const l of learnings) {
            const tripSection: string[] = [];
            
            if (l.destination) {
              tripSection.push(`Past trip to ${l.destination}:`);
            }
            
            // Positive learnings
            const highlights = l.highlights as Array<{ activity?: string; why?: string }> | null;
            if (highlights && highlights.length > 0) {
              const highlightText = highlights
                .slice(0, 2)
                .map(h => `${h.activity || 'Unknown'} (${h.why || ''})`)
                .join(', ');
              tripSection.push(`  ✓ Loved: ${highlightText}`);
            }
            
            // What to avoid
            const painPoints = l.pain_points as Array<{ issue?: string; solution?: string }> | null;
            if (painPoints && painPoints.length > 0) {
              const issues = painPoints
                .slice(0, 2)
                .map(p => `${p.issue || 'Issue'}${p.solution ? ` → ${p.solution}` : ''}`)
                .join('; ');
              tripSection.push(`  ✗ Avoid: ${issues}`);
            }
            
            // Pacing insights
            if (l.pacing_feedback) {
              const pacingMap: Record<string, string> = {
                'too_rushed': 'prefers slower pace with fewer activities',
                'perfect': 'current pacing works well',
                'too_slow': 'enjoys action-packed days',
                'varied_needs': 'needs variety in daily intensity'
              };
              tripSection.push(`  📊 ${pacingMap[l.pacing_feedback] || l.pacing_feedback}`);
            }
            
            // Discovered preferences
            if (l.discovered_likes && l.discovered_likes.length > 0) {
              tripSection.push(`  💡 Discovered loves: ${l.discovered_likes.slice(0, 3).join(', ')}`);
            }
            if (l.discovered_dislikes && l.discovered_dislikes.length > 0) {
              tripSection.push(`  ⚠️ Discovered dislikes: ${l.discovered_dislikes.slice(0, 3).join(', ')}`);
            }
            
            // AI summary (most valuable)
            if (l.lessons_summary) {
              tripSection.push(`  📝 Key insight: ${l.lessons_summary}`);
            }
            
            if (tripSection.length > 1) {
              sections.push(tripSection.join('\n'));
            }
          }
          
          if (sections.length > 0) {
            tripLearningsContext = `\n## 🔄 LEARNINGS FROM PAST TRIPS\nApply these lessons to avoid repeating mistakes:\n${sections.join('\n\n')}\n`;
            console.log(`[Stage 1.7] Loaded ${learnings.length} past trip learnings`);
          }
        } else {
          console.log("[Stage 1.7] No past trip learnings found");
        }
      } catch (learningsError) {
        console.warn("[Stage 1.7] Failed to fetch trip learnings:", learningsError);
      }
      
      // STAGE 1.8: Fetch recently used activities for this destination to ensure variety
      console.log("[Stage 1.8] Fetching recently used activities for variety...");
      let recentlyUsedContext = "";
      try {
        // Get activities from recent trips to the same destination (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const destinationLower = context.destination.toLowerCase();
        
        const { data: recentTrips } = await supabase
          .from('trips')
          .select('id, destination, itinerary_data')
          .neq('id', tripId) // Exclude current trip
          .gte('created_at', thirtyDaysAgo)
          .not('itinerary_data', 'is', null)
          .limit(10);
        
        if (recentTrips && recentTrips.length > 0) {
          // Filter to same destination and extract activity titles
          const recentActivityNames: string[] = [];
          
          for (const trip of recentTrips) {
            const tripDest = (trip.destination || '').toLowerCase();
            // Match if destination contains our destination or vice versa
            if (tripDest.includes(destinationLower) || destinationLower.includes(tripDest)) {
              const itineraryData = trip.itinerary_data as { days?: Array<{ activities?: Array<{ title?: string; name?: string }> }> };
              if (itineraryData?.days) {
                for (const day of itineraryData.days) {
                  if (day.activities) {
                    for (const act of day.activities) {
                      const actName = act.title || act.name;
                      if (actName && !recentActivityNames.includes(actName)) {
                        recentActivityNames.push(actName);
                      }
                    }
                  }
                }
              }
            }
          }
          
          if (recentActivityNames.length > 0) {
            // Limit to 20 most recent to keep prompt size reasonable
            const topRecent = recentActivityNames.slice(0, 20);
            recentlyUsedContext = `\n## ⚠️ RECENTLY USED (avoid for variety):\nThese activities/restaurants were recently used in other ${context.destination} itineraries. AVOID suggesting them to ensure unique experiences:\n- ${topRecent.join('\n- ')}\n`;
            console.log(`[Stage 1.8] Found ${topRecent.length} recently used activities to avoid`);
          }
        } else {
          console.log("[Stage 1.8] No recent trips to this destination found");
        }
      } catch (recentError) {
        console.warn("[Stage 1.8] Failed to fetch recently used activities:", recentError);
      }
      
      // STAGE 1.9: Fetch local events and travel advisory (AI-powered via Perplexity)
      console.log("[Stage 1.9] Fetching local events and travel advisory...");
      let localEventsContext = "";
      let fetchedLocalEvents: LocalEventInfo[] = [];
      let fetchedTravelAdvisory: TravelAdvisory | undefined;
      
      try {
        const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
        
        if (PERPLEXITY_API_KEY && context.startDate && context.endDate) {
          // Fetch local events and travel advisory in parallel
          const [eventsResponse, advisoryResponse] = await Promise.all([
            // Local events lookup
            fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar',
                messages: [
                  {
                    role: 'system',
                    content: `You are a local events researcher. Find festivals, concerts, exhibitions, sports events, cultural events, and special happenings.

Return a JSON array of events:
[
  {
    "name": "Event name",
    "type": "festival|concert|exhibition|sports|cultural|market|other",
    "dates": "Date range or specific date",
    "location": "Venue or area",
    "description": "Brief 1-2 sentence description",
    "isFree": boolean,
    "bestFor": "who this appeals to (e.g., 'art lovers', 'families', 'foodies')"
  }
]

RULES:
- Include ONLY events happening during the specified dates
- Maximum 8 events, prioritize by significance
- Return empty array [] if no events found
- ONLY return valid JSON. No markdown.`
                  },
                  {
                    role: 'user',
                    content: `Find events and happenings in ${context.destination}${context.destinationCountry ? `, ${context.destinationCountry}` : ''} between ${context.startDate} and ${context.endDate}.`
                  }
                ],
              }),
            }),
            // Travel advisory lookup
            fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar',
                messages: [
                  {
                    role: 'system',
                    content: `You are a travel advisory specialist. Provide current, accurate information about entry requirements, safety, and health.

Return a JSON object:
{
  "visaRequired": boolean,
  "visaType": string or null,
  "passportValidity": string or null,
  "entryRequirements": [string],
  "safetyLevel": "low-risk" | "moderate" | "elevated" | "high-risk",
  "safetyAdvisory": string or null,
  "healthRequirements": [string],
  "currencyTips": string or null,
  "importantNotes": [string],
  "lastUpdated": "YYYY-MM-DD"
}

ONLY return valid JSON. No markdown.`
                  },
                  {
                    role: 'user',
                    content: `Get travel advisory for US citizens traveling to ${context.destination}${context.destinationCountry ? `, ${context.destinationCountry}` : ''}.`
                  }
                ],
              }),
            }),
          ]);

          // Process local events
          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            const content = eventsData.choices?.[0]?.message?.content?.trim() || '';
            
            try {
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const events = JSON.parse(jsonMatch[0]);
                
                if (events && events.length > 0) {
                  // Store for overview
                  fetchedLocalEvents = events.map((e: any) => ({
                    name: e.name,
                    type: e.type,
                    dates: e.dates,
                    location: e.location,
                    description: e.description,
                    isFree: e.isFree || false,
                  }));
                  
                  // Build context for AI prompt
                  const eventLines = events.map((e: any) => 
                    `- ${e.name} (${e.type}): ${e.dates} at ${e.location}. ${e.description}${e.isFree ? ' [FREE]' : ''} Best for: ${e.bestFor || 'general interest'}`
                  ).join('\n');
                  
                  localEventsContext = `\n## 🎉 LOCAL EVENTS DURING TRIP
The following events are happening during the traveler's visit. INCORPORATE relevant ones into the itinerary based on the traveler's interests:
${eventLines}

INSTRUCTIONS: If any event matches the traveler's interests or travel style, WEAVE it into the appropriate day. For festivals/markets, schedule as a morning or afternoon activity. For concerts/evening events, replace a dinner or evening activity. Always mention the event is happening if you include it.
`;
                  console.log(`[Stage 1.9] Found ${events.length} local events to potentially include`);
                }
              }
            } catch (parseErr) {
              console.warn("[Stage 1.9] Failed to parse events:", parseErr);
            }
          } else {
            console.warn(`[Stage 1.9] Events API error: ${eventsResponse.status}`);
          }
          
          // Process travel advisory
          if (advisoryResponse.ok) {
            const advisoryData = await advisoryResponse.json();
            const content = advisoryData.choices?.[0]?.message?.content?.trim() || '';
            
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const advisory = JSON.parse(jsonMatch[0]);
                fetchedTravelAdvisory = {
                  visaRequired: advisory.visaRequired,
                  visaType: advisory.visaType,
                  passportValidity: advisory.passportValidity,
                  entryRequirements: advisory.entryRequirements || [],
                  safetyLevel: advisory.safetyLevel,
                  safetyAdvisory: advisory.safetyAdvisory,
                  healthRequirements: advisory.healthRequirements || [],
                  currencyTips: advisory.currencyTips,
                  importantNotes: advisory.importantNotes || [],
                  lastUpdated: advisory.lastUpdated || new Date().toISOString().split('T')[0],
                };
                console.log(`[Stage 1.9] Travel advisory: safetyLevel=${fetchedTravelAdvisory.safetyLevel}, visaRequired=${fetchedTravelAdvisory.visaRequired}`);
              }
            } catch (parseErr) {
              console.warn("[Stage 1.9] Failed to parse travel advisory:", parseErr);
            }
          } else {
            console.warn(`[Stage 1.9] Advisory API error: ${advisoryResponse.status}`);
          }
        } else {
          console.log("[Stage 1.9] Skipping - Perplexity not configured or missing dates");
        }
      } catch (eventsError) {
        console.warn("[Stage 1.9] Failed to fetch enrichment data:", eventsError);
      }
      
      // =======================================================================
      // STAGE 1.92: Hidden Gems Discovery (5-layer Perplexity engine)
      // Runs in parallel via dedicated edge function, results injected into AI prompt
      // =======================================================================
      console.log("[Stage 1.92] Discovering hidden gems...");
      let hiddenGemsContext = "";
      let discoveredGems: any[] = [];
      
      try {
        const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
        
        if (PERPLEXITY_API_KEY) {
          const gemsResponse = await fetch(`${supabaseUrl}/functions/v1/discover-hidden-gems`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              destination: context.destination,
              country: context.destinationCountry || '',
              archetypeName: unifiedProfile.primaryArchetype || 'Explorer',
              secondaryArchetype: unifiedProfile.secondaryArchetype || undefined,
              interests: unifiedProfile.interests || [],
              diningStyle: prefs?.dining_style || undefined,
              budgetTier: unifiedProfile.budgetTier || undefined,
              travelPace: prefs?.travel_pace || undefined,
              tripDuration: context.totalDays,
              isFirstVisit: context.isFirstTimeVisitor,
            }),
          });

          if (gemsResponse.ok) {
            const gemsData = await gemsResponse.json();
            discoveredGems = gemsData.gems || [];
            
            if (discoveredGems.length > 0) {
              // Build context for AI prompt - inject gems as strong candidates
              const gemLines = discoveredGems.slice(0, 8).map((g: any, i: number) => 
                `${i + 1}. ${g.name} (${g.category}) in ${g.neighborhood} — ${g.whyFitsYou} [Source: ${g.discoveryLayer}]${g.tip ? ` TIP: ${g.tip}` : ''}`
              ).join('\n');
              
              hiddenGemsContext = `\n## 💎 HIDDEN GEMS DISCOVERED (HIGH PRIORITY — INCLUDE 2-3 PER DAY)
The following spots were discovered through deep research (Reddit mining, local-language sources, new openings, neighborhood clusters) and are specifically matched to this traveler's ${unifiedProfile.primaryArchetype || 'Explorer'} archetype.

THESE ARE YOUR SECRET WEAPON — most travel apps cannot find these. Include at least 2-3 of these per day, mixed naturally into the schedule:
${gemLines}

RULES FOR HIDDEN GEMS:
- Mark each included gem with "isHiddenGem": true in the activity intelligence object
- In the "whyThisFits" field, reference why this specific gem matches the traveler
- Include the "discoverySource" field with the layer that found it (e.g., "Reddit Mining", "Local Language Sources")
- Prioritize gems over generic tourist attractions
- Space them throughout the trip (don't cluster all gems on one day)
`;
              console.log(`[Stage 1.92] Discovered ${discoveredGems.length} hidden gems, injecting ${Math.min(discoveredGems.length, 8)} into prompt`);
            } else {
              console.log("[Stage 1.92] No hidden gems found");
            }
          } else {
            console.warn(`[Stage 1.92] Hidden gems API error: ${gemsResponse.status}`);
            await gemsResponse.text(); // consume body
          }
        } else {
          console.log("[Stage 1.92] Skipping - Perplexity not configured");
        }
      } catch (gemsError) {
        console.warn("[Stage 1.92] Failed to discover hidden gems:", gemsError);
      }
      
      // =======================================================================
      // STAGE 1.93: Voyance Picks — Founder-curated must-include experiences
      // These are non-negotiable recommendations from the Voyance team
      // =======================================================================
      let voyancePicksContext = '';
      try {
        console.log("[Stage 1.93] Fetching Voyance Picks for", context.destination);
        const { data: voyancePicks, error: vpError } = await supabase
          .from('voyance_picks')
          .select('*')
          .eq('is_active', true)
          .ilike('destination', `%${context.destination.split(',')[0].trim()}%`);
        
        if (vpError) {
          console.warn("[Stage 1.93] DB error:", vpError.message);
        } else if (voyancePicks && voyancePicks.length > 0) {
          const pickLines = voyancePicks.map((p: any, i: number) => 
            `${i + 1}. **${p.name}** (${p.category}) in ${p.neighborhood || context.destination}
   WHY: ${p.why_essential}
   TIP: ${p.insider_tip || 'No specific tip'}
   BEST TIME: ${p.best_time || 'Any time'}
   PRICE: ${p.price_range || 'Varies'}`
          ).join('\n');
          
          voyancePicksContext = `
${'='.repeat(70)}
⭐ VOYANCE PICKS — FOUNDER-CURATED MUST-INCLUDES (HIGHEST PRIORITY)
${'='.repeat(70)}
These are hand-picked by the Voyance founders as ESSENTIAL experiences for ${context.destination}. 
They MUST be included in the itinerary regardless of traveler archetype or budget tier.
DO NOT SKIP THESE. Schedule them at their optimal time.

${pickLines}

RULES FOR VOYANCE PICKS:
- MUST appear in the itinerary — this is non-negotiable
- Mark with "isHiddenGem": true (these are curated discoveries)
- Set "isVoyancePick": true (this flags it as a founder-vetted pick in the UI)
- Set "voyanceInsight" to the WHY text above
- Use the TIP as the "tips" field
- In "personalization.whyThisFits", write "Voyance Founder Pick — [reason it fits this specific traveler]"
`;
          console.log(`[Stage 1.93] Injecting ${voyancePicks.length} Voyance Picks into prompt`);
        } else {
          console.log("[Stage 1.93] No Voyance Picks found for this destination");
        }
      } catch (vpErr) {
        console.warn("[Stage 1.93] Failed to fetch Voyance Picks:", vpErr);
      }
      
      // =======================================================================
      // STAGE 1.95: Cold Start Detection (simplified - using profile-loader)
      // Cold start handling is now integrated into loadTravelerProfile() which
      // provides dataCompleteness and isFallback flags. No separate module needed.
      // =======================================================================
      const coldStartContext = ''; // Removed: now handled by profile-loader
      
      // =======================================================================
      // STAGE 1.96: Build Forced Differentiators & Schedule Constraints
      // Phase 2 Fix: Use unified profile instead of manual extraction
      // =======================================================================
      console.log("[Stage 1.96] Building personalization enforcement rules...");
      
      // Use unified profile trait scores (fixes || vs ?? bug and ensures consistency)
      const traitScores: Partial<TraitScores> = {
        planning: unifiedProfile.traitScores.planning ?? 0,
        social: unifiedProfile.traitScores.social ?? 0,
        comfort: unifiedProfile.traitScores.comfort ?? 0,
        pace: unifiedProfile.traitScores.pace ?? 0,
        authenticity: unifiedProfile.traitScores.authenticity ?? 0,
        adventure: unifiedProfile.traitScores.adventure ?? 0,
        budget: unifiedProfile.traitScores.budget ?? 0,
        transformation: unifiedProfile.traitScores.transformation ?? 0
      };
      
      // Get interests from unified profile (Phase 2 Fix: removed normalizedContext reference)
      const userInterests = unifiedProfile.interests.length > 0 
        ? unifiedProfile.interests 
        : (prefs?.interests || []);
      
      // Derive forced slots (trait-based required activities per day)
      // Build slot derivation context for archetype-specific slots
      const travelCompanions = prefs?.travel_companions || [];
      const hasChildrenFromCompanions = travelCompanions.some((c: string) => 
        c.toLowerCase().includes('family') || 
        c.toLowerCase().includes('kid') || 
        c.toLowerCase().includes('child')
      );
      // Use explicit childrenCount from trip metadata, or fall back to companion/tripType indicators
      const hasChildren = (context.childrenCount && context.childrenCount > 0) || 
        hasChildrenFromCompanions || 
        context.tripType === 'family';
      
      // Phase 2 Fix: Use archetype from unified profile (single source of truth)
      const primaryArchetypeId = unifiedProfile.archetype;
      const secondaryArchetypeId: string | undefined = undefined; // Secondary archetype not in unified profile
      
      const slotContext = {
        tripType: context.tripType,
        travelCompanions,
        hasChildren,
        primaryArchetype: primaryArchetypeId,
        secondaryArchetype: secondaryArchetypeId,
        celebrationDay: context.celebrationDay,
        travelerCount: context.travelers || 1,
      };
      const forcedSlots = deriveForcedSlots(traitScores, userInterests, 1, context.totalDays, slotContext);
      const forcedSlotsPrompt = buildForcedSlotsPrompt(forcedSlots);
      console.log(`[Stage 1.96] ${forcedSlots.length} forced differentiator slots required per day (context: tripType=${slotContext.tripType}, hasChildren=${slotContext.hasChildren}, archetype=${slotContext.primaryArchetype})`);
      
      // Derive schedule constraints (pace, walking, buffer times) - Phase 2 Fix: use unified profile
      // Phase 16: Pass recovery style and active hours for proper enforcement
      const scheduleConstraints = deriveScheduleConstraints(
        traitScores,
        unifiedProfile.mobilityNeeds || prefs?.mobility_needs,
        {
          recoveryStyle: (prefs as any)?.recovery_style as string[] | undefined,
          activeHoursPerDay: prefs?.active_hours_per_day as 'light' | 'moderate' | 'full' | undefined,
        }
      );
      const scheduleConstraintsPrompt = buildScheduleConstraintsPrompt(scheduleConstraints);
      console.log(`[Stage 1.96] Schedule constraints: ${scheduleConstraints.minActivitiesPerDay}-${scheduleConstraints.maxActivitiesPerDay} activities/day, ${scheduleConstraints.bufferMinutesBetweenActivities}min buffers`);
      
      // Build explainability prompt (Phase 2 Fix: Use unified profile archetype)
      const explainabilityContext: ExplainabilityContext = {
        interests: userInterests,
        foodLikes: prefs?.food_likes || [],
        foodDislikes: prefs?.food_dislikes || [],
        dietaryRestrictions: unifiedProfile.dietaryRestrictions.length > 0 
          ? unifiedProfile.dietaryRestrictions 
          : (prefs?.dietary_restrictions || []),
        travelCompanions: prefs?.travel_companions || [],
        accommodationStyle: prefs?.accommodation_style,
        traits: {
          planning: traitScores.planning !== undefined ? { value: traitScores.planning, label: 'Planning' } : undefined,
          social: traitScores.social !== undefined ? { value: traitScores.social, label: 'Social' } : undefined,
          comfort: traitScores.comfort !== undefined ? { value: traitScores.comfort, label: 'Comfort' } : undefined,
          pace: traitScores.pace !== undefined ? { value: traitScores.pace, label: 'Pace' } : undefined,
          authenticity: traitScores.authenticity !== undefined ? { value: traitScores.authenticity, label: 'Authenticity' } : undefined,
          adventure: traitScores.adventure !== undefined ? { value: traitScores.adventure, label: 'Adventure' } : undefined,
          budget: traitScores.budget !== undefined ? { value: traitScores.budget, label: 'Budget' } : undefined,
          transformation: traitScores.transformation !== undefined ? { value: traitScores.transformation, label: 'Transformation' } : undefined,
        },
        tripIntents: unifiedProfile.tripIntents.length > 0 
          ? unifiedProfile.tripIntents 
          : (context.tripType ? [context.tripType] : []),
        budgetTier: unifiedProfile.budgetTier || context.budgetTier,
        archetype: unifiedProfile.archetype  // Phase 2 Fix: Use unified profile archetype
      };
      const explainabilityPrompt = buildExplainabilityPrompt(explainabilityContext);
      
      // Build truth anchor prompt
      const truthAnchorPrompt = buildTruthAnchorPrompt();
      
      // =======================================================================
      // STAGE 1.97: Group Reconciliation (for multi-traveler trips)
      // =======================================================================
      let groupReconciliationPrompt = '';
      if (context.travelers > 1 && collaboratorPrefs.length > 0) {
        console.log("[Stage 1.97] Building group reconciliation rules...");
        
        // Build traveler profiles for reconciliation
        const travelerProfiles: TravelerProfile[] = [
          {
            id: userId || 'primary',
            name: 'Primary Traveler',
            traits: traitScores,
            interests: userInterests,
            dietaryRestrictions: prefs?.dietary_restrictions || [],
            mobilityNeeds: prefs?.mobility_needs,
            allergies: prefs?.allergies || [],
            isPrimary: true
          },
          ...collaboratorPrefs.map((cp: any, idx: number) => ({
            id: cp.user_id || `collab-${idx}`,
            name: `Traveler ${idx + 2}`,
            traits: cp.travel_dna?.trait_scores || {},
            interests: cp.interests || [],
            dietaryRestrictions: cp.dietary_restrictions || [],
            allergies: (cp as any).allergies || [],
            isPrimary: false
          }))
        ];
        
        const reconciliation = reconcileGroupPreferences(travelerProfiles);
        groupReconciliationPrompt = buildGroupReconciliationPrompt(travelerProfiles, reconciliation, 1);
        console.log(`[Stage 1.97] Group: ${reconciliation.hardConstraints.length} hard constraints, ${reconciliation.sharedOverlaps.length} shared interests`);
      }
      
      // =======================================================================
      // STAGE 1.98: Geographic Coherence - Zone clustering & travel constraints
      // =======================================================================
      console.log("[Stage 1.98] Building geographic coherence rules...");
      
      // Get curated zones for destination
      const cityZones = getCuratedZones(context.destination);
      if (cityZones) {
        console.log(`[Stage 1.98] Found ${cityZones.length} curated zones for ${context.destination}`);
      } else {
        console.log(`[Stage 1.98] No curated zones for ${context.destination}, will use geohash fallback`);
      }
      
      // Derive pace level from trait scores
      const paceScore = traitScores.pace || 0;
      const geoGraphicPaceLevel: 'relaxed' | 'balanced' | 'fast-paced' = 
        paceScore <= -2 ? 'relaxed' : paceScore >= 5 ? 'fast-paced' : 'balanced';
      
      // Get travel time constraints
      const travelConstraints = deriveTravelTimeConstraints(geoGraphicPaceLevel);
      console.log(`[Stage 1.98] Travel constraints (${geoGraphicPaceLevel}): max hop ${travelConstraints.maxHopMinutes}min, daily budget ${travelConstraints.maxDailyTransitMinutes}min`);
      
      // Get hotel neighborhood if available
      const hotelNeighborhood = flightHotelResult.context?.includes('Hotel:') 
        ? flightHotelResult.context.match(/Hotel:.*?in\s+([^,\n]+)/)?.[1]?.trim()
        : undefined;
      
      // Build geographic prompt
      const geographicPrompt = buildGeographicPrompt(
        context.destination,
        cityZones,
        hotelNeighborhood,
        travelConstraints
      );
      
      // =======================================================================
      // STAGE 1.99: Build Unified Archetype Constraints (Phase 2 Fix)
      // Now with DYNAMIC features: attraction matching + AI-generated city guides
      // =======================================================================
      const effectiveBudgetTier = unifiedProfile.budgetTier || context.budgetTier || 'moderate';
      
      // Resolve destination ID for dynamic features (graceful fallback if not found)
      const destinationId = await getDestinationId(supabase, context.destination);
      
      // Use async builder for dynamic attraction matching + AI city guides
      const generationHierarchy = await buildFullPromptGuidanceAsync(
        supabase,
        unifiedProfile.archetype,
        context.destination,
        destinationId,
        effectiveBudgetTier,
        { pace: unifiedProfile.traitScores.pace, budget: unifiedProfile.traitScores.budget },
        LOVABLE_API_KEY
      );
      console.log(`[Stage 1.99] ✓ Generated unified archetype constraints for ${unifiedProfile.archetype} (${generationHierarchy.length} chars, dynamic=${!!destinationId})`);
      
      // =======================================================================
      // STAGE 1.991: Interest Override — User's explicit interests OUTRANK archetype
      // The archetype determines TONE/NARRATIVE, user interests determine ACTIVITY MIX
      // =======================================================================
      let interestOverridePrompt = "";
      const userInterestsForOverride = unifiedProfile.interests || context.interests || [];
      if (userInterestsForOverride.length > 0) {
        const interestActivityMap: Record<string, string> = {
          'food': 'At least 2-3 noteworthy dining experiences per day (food carts, local restaurants, markets, breweries)',
          'cuisine': 'At least 2-3 noteworthy dining experiences per day (food carts, local restaurants, markets, breweries)',
          'culinary': 'At least 2-3 noteworthy dining experiences per day (food carts, local restaurants, markets, breweries)',
          'food & cuisine': 'At least 2-3 noteworthy dining experiences per day (food carts, local restaurants, markets, breweries)',
          'adventure': 'At least 1 adventure/active/outdoor activity per day (hiking, water sports, zip-lining, climbing)',
          'adventure & thrills': 'At least 1 adventure/active/outdoor activity per day (hiking, water sports, zip-lining, climbing)',
          'nightlife': 'Evening entertainment on at least half the nights (bars, live music, clubs, night markets)',
          'nightlife & entertainment': 'Evening entertainment on at least half the nights (bars, live music, clubs, night markets)',
          'culture': 'At least 1 cultural experience per day (museums, galleries, historic sites, local traditions)',
          'culture & history': 'At least 1 cultural experience per day (museums, galleries, historic sites, local traditions)',
          'nature': 'At least 1 nature/outdoor experience per day (parks, gardens, scenic viewpoints, nature reserves)',
          'nature & outdoors': 'At least 1 nature/outdoor experience per day (parks, gardens, scenic viewpoints, nature reserves)',
          'shopping': 'Include shopping opportunities (local markets, boutiques, artisan shops)',
          'wellness': 'Include wellness activities (yoga, spa, meditation, hot springs)',
          'art': 'Include art experiences (galleries, street art, studios, art districts)',
          'wine': 'At least 1 wine experience per city (vineyard tour, wine tasting, wine bar, sommelier-led experience). In wine regions (Tuscany, Sicily/Etna, Bordeaux, Napa, Mendoza, etc.) this should be a HIGHLIGHT activity, not a footnote.',
          'wine & spirits': 'At least 1 wine/spirits experience per city (vineyard, distillery, tasting room, cocktail masterclass)',
        };
        
        const matchedInterests: string[] = [];
        for (const interest of userInterestsForOverride) {
          const lower = interest.toLowerCase();
          for (const [key, instruction] of Object.entries(interestActivityMap)) {
            if (lower.includes(key) || key.includes(lower)) {
              matchedInterests.push(`- ${interest}: ${instruction}`);
              break;
            }
          }
        }
        
        if (matchedInterests.length > 0) {
          interestOverridePrompt = `
${'='.repeat(60)}
🎯 USER'S EXPLICIT INTERESTS — ACTIVITY MIX REQUIREMENTS
${'='.repeat(60)}

The user has EXPLICITLY selected these interests in their profile. These determine WHAT TYPES of activities to include:

${matchedInterests.join('\n')}

⚠️ CRITICAL RULE: The user's archetype (${unifiedProfile.archetype || 'none'}) determines the NARRATIVE TONE and DESCRIPTIONS of activities, but does NOT override which TYPES of activities to include.

Example: A "Beach Therapist" who selected "Food & Cuisine" and "Nightlife" should get:
- Food-focused days with great restaurants, food carts, and culinary experiences
- Evening entertainment and bar recommendations
- Written with a relaxed, restorative tone: "unwind over world-class ramen" not "rush to the ramen shop"

The archetype is FLAVOR, not the MENU. User interests ARE the menu.

DO NOT replace the user's selected interests with archetype-default activities.
If the archetype says "beach time 3-4 hours" but the user selected "Food & Cuisine" and the destination has no beaches, prioritize food experiences with the archetype's relaxed narrative tone instead.
${'='.repeat(60)}
`;
          console.log(`[Stage 1.991] ✓ Interest override prompt built for ${matchedInterests.length} interests: ${userInterestsForOverride.join(', ')}`);
        }
      }
      
      // =======================================================================
      // STAGE 1.995: Trip Type Modifiers - First-class input for celebrations/groups/purpose
      // =======================================================================
      const tripTypePrompt = buildTripTypePromptSection(
        context.tripType,
        unifiedProfile.archetype,
        context.totalDays,
        context.celebrationDay
      );
      if (tripTypePrompt) {
        console.log(`[Stage 1.995] ✓ Trip type "${context.tripType}" prompt built (${tripTypePrompt.length} chars)`);
      } else {
        console.log(`[Stage 1.995] No special trip type - using standard generation`);
      }
      
      // =======================================================================
      // STAGE 1.997: Tourist Trap Skip List (Visible Intelligence)
      // Prevent AI from recommending activities we explicitly tell users to avoid
      // =======================================================================
      const skipListPrompt = buildSkipListPrompt(context.destination);
      if (skipListPrompt) {
        console.log(`[Stage 1.997] ✓ Skip list built for ${context.destination}`);
      }
      
      // =======================================================================
      // STAGE 1.998: Dynamic Dietary Enforcement (Phase 15)
      // Builds cuisine/ingredient avoidance rules based on user dietary restrictions
      // =======================================================================
      const dietaryRestrictions = unifiedProfile.dietaryRestrictions.length > 0 
        ? unifiedProfile.dietaryRestrictions 
        : (prefs?.dietary_restrictions || []);
      const dietaryEnforcementPrompt = buildDietaryEnforcementPrompt(dietaryRestrictions);
      if (dietaryEnforcementPrompt) {
        const maxSeverity = getMaxDietarySeverity(dietaryRestrictions);
        console.log(`[Stage 1.998] ✓ Dietary enforcement built for ${dietaryRestrictions.length} restrictions (max severity: ${maxSeverity})`);
        console.log(`[Stage 1.998]   restrictions: ${dietaryRestrictions.join(', ')}`);
        
        // Also expand the avoid list with dietary-based cuisine/ingredient avoids
        const dietaryAvoids = expandDietaryAvoidList(dietaryRestrictions);
        if (dietaryAvoids.length > 0) {
          console.log(`[Stage 1.998]   auto-avoided: ${dietaryAvoids.slice(0, 10).join(', ')}${dietaryAvoids.length > 10 ? ` + ${dietaryAvoids.length - 10} more` : ''}`);
        }
      }
      
      // =======================================================================
      // STAGE 1.999: User Research Notes / Must-Do Activities
      // Inject user-provided must-sees, skip requests, and research notes
      // =======================================================================
      let userResearchPrompt = "";
      if (context.mustDoActivities && context.mustDoActivities.trim()) {
        // Keep all user itinerary anchors as must-have when Smart Finish was requested.
        const forceAllMust = !!context.isSmartFinish || !!context.smartFinishRequested;
        const mustDoAnalysis = parseMustDoInput(context.mustDoActivities, context.destination, forceAllMust, context.startDate, context.totalDays);
        
        // ═══════════════════════════════════════════════════════════════════════
        // CROSS-REFERENCE: Match must-do items against discovered local events
        // If a user says "U.S. Open" and Perplexity found the U.S. Open event,
        // inherit the event's dates/location and promote to all-day event.
        // ═══════════════════════════════════════════════════════════════════════
        if (mustDoAnalysis.length > 0 && fetchedLocalEvents.length > 0) {
          console.log(`[Stage 1.999] Cross-referencing ${mustDoAnalysis.length} must-dos against ${fetchedLocalEvents.length} local events...`);
          for (const mustDo of mustDoAnalysis) {
            const mustDoLower = mustDo.activityName.toLowerCase();
            const mustDoWords = mustDoLower.split(/\s+/).filter(w => w.length > 2);
            
            // Fuzzy match: check if any local event name shares 2+ significant words with the must-do
            for (const event of fetchedLocalEvents) {
              const eventLower = (event.name || '').toLowerCase();
              const matchingWords = mustDoWords.filter(w => eventLower.includes(w));
              
              // Match if 2+ words match, or if must-do name is contained in event name (or vice versa)
              if (matchingWords.length >= 2 || eventLower.includes(mustDoLower) || mustDoLower.includes(eventLower)) {
                // Promote to must priority with event data
                mustDo.priority = 'must';
                mustDo.venueName = event.location || undefined;
                mustDo.eventDates = event.dates || undefined;
                
                // If not already classified as an event, promote to at least half-day
                if (!mustDo.activityType || mustDo.activityType === 'standard') {
                  const eventType = (event.type || '').toLowerCase();
                  if (['sports', 'festival', 'convention'].includes(eventType)) {
                    mustDo.activityType = 'all_day_event';
                    mustDo.estimatedDuration = 420;
                  } else {
                    mustDo.activityType = 'half_day_event';
                    mustDo.estimatedDuration = Math.max(mustDo.estimatedDuration || 120, 210);
                  }
                }
                
                mustDo.requiresBooking = true;
                console.log(`[Stage 1.999] ✓ Cross-ref match: "${mustDo.activityName}" ↔ event "${event.name}" → ${mustDo.activityType} at ${mustDo.venueName || 'TBD'}`);
                break;
              }
            }
          }
        }
        
        if (mustDoAnalysis.length > 0) {
          const scheduled = scheduleMustDos(mustDoAnalysis, context.totalDays);
          userResearchPrompt = scheduled.promptSection;
          const eventCount = mustDoAnalysis.filter(m => m.activityType === 'all_day_event' || m.activityType === 'half_day_event').length;
          console.log(`[Stage 1.999] ✓ User research notes parsed: ${mustDoAnalysis.length} items (forceAllMust=${forceAllMust}), ${scheduled.scheduled.length} scheduled, ${eventCount} classified as events`);
        } else {
          // Raw text fallback — inject as-is with MANDATORY + ENRICHMENT language
          userResearchPrompt = `\n## 🚨 USER'S RESEARCHED RESTAURANTS & VENUES (MANDATORY)\n\nThe traveler has PERSONALLY RESEARCHED and CHOSEN these specific venues. You MUST include ALL of them in the itinerary. These are NON-NEGOTIABLE. Do NOT substitute your own recommendations for these.\n\n"${context.mustDoActivities.trim()}"\n\nRULES:\n- EVERY venue/restaurant listed above MUST appear by name in the final itinerary\n- Only add AI recommendations to fill REMAINING empty meal/activity slots\n- If a user-specified venue conflicts with another, keep the user's venue and move the other\n- Respect any "skip" or "avoid" requests\n- If the user mentions a FULL-DAY EVENT (e.g., "whole day at the U.S. Open"), do NOT plan other activities around it. That day has ONE purpose.\n- If the user mentions FLIGHT DETAILS, account for arrival/departure times on first/last days\n- If the user mentions SPECIFIC TIMES (e.g., "dinner at 7:30"), those times are LOCKED\n- User preferences like "authentic sushi" or "no tourist traps" apply to ALL venue selections\n\n## 🧭 SMART FINISH ENRICHMENT — ADD VALUE\nThe user's list is a STARTING POINT. You MUST add significant value:\n- Add exact street addresses, opening hours, booking URLs for every venue\n- Add transit directions between activities (walk/metro/taxi with duration & cost)\n- Fill ALL meal gaps (breakfast, lunch, dinner, coffee stops)\n- Add 2-4 DNA-matched activities per day between user venues\n- Add insider tips for each user-specified venue\n- Flag any activity that doesn't match the traveler's DNA with a "dnaFlag" field\n`;
          console.log(`[Stage 1.999] ✓ User research notes injected as raw text with MANDATORY enforcement (${context.mustDoActivities.length} chars)`);
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 1.999a: Inject "Anything Else" / Additional Notes as trip anchors
      // Users type trip purpose here (e.g., "this trip is for the U.S. Open")
      // ═══════════════════════════════════════════════════════════════════════
      if (context.additionalNotes && context.additionalNotes.trim()) {
        const notes = context.additionalNotes.trim();
        userResearchPrompt += `\n## 🎯 TRAVELER'S TRIP PURPOSE / ADDITIONAL NOTES
The traveler provided these additional notes about their trip. These describe the PRIMARY PURPOSE or special requirements:

"${notes}"

CRITICAL: If these notes describe a specific event, activity, or purpose (e.g., "going for the U.S. Open", "attending a wedding", "here for a conference"), this MUST be treated as a NON-NEGOTIABLE anchor for the trip. Dedicate appropriate days to it.
If the purpose is a specific event, plan at least ONE full day around that event. The rest of the trip should complement this primary purpose.
`;
        console.log(`[Stage 1.999a] ✓ Additional notes / trip purpose injected (${notes.length} chars)`);
      }
      // Inject interest categories
      if ((context as any).interestCategories && (context as any).interestCategories.length > 0) {
        const categoryLabels: Record<string, string> = {
          history: 'History & Museums', food: 'Food & Dining', shopping: 'Shopping',
          nature: 'Parks & Nature', culture: 'Arts & Culture', nightlife: 'Nightlife',
        };
        const cats = (context as any).interestCategories as string[];
        const labels = cats.map(c => categoryLabels[c] || c).join(', ');
        userResearchPrompt += `\n## USER INTERESTS\nPrioritize activities in these categories: ${labels}. Lean heavily toward these when choosing between options.\n`;
        console.log(`[Stage 1.999b] ✓ Interest categories injected: ${labels}`);
      }

      // =======================================================================
      // STAGE 1.9993: User Constraints from Chat Planner
      // Convert structured user constraints into generation rules
      // =======================================================================
      let userConstraintPrompt = "";
      if (context.userConstraints && context.userConstraints.length > 0) {
        const constraintLines: string[] = [];
        constraintLines.push(`\n${'='.repeat(60)}`);
        constraintLines.push(`🚨 USER'S EXPLICIT CONSTRAINTS — THESE OVERRIDE ALL OTHER RULES`);
        constraintLines.push(`${'='.repeat(60)}`);
        constraintLines.push(`The traveler specifically stated these requirements. They OVERRIDE pacing rules, activity count targets, and all other system defaults.\n`);

        for (const constraint of context.userConstraints) {
          switch (constraint.type) {
            case 'full_day_event':
              constraintLines.push(`⭐ FULL-DAY EVENT${constraint.day ? ` (Day ${constraint.day})` : ''}: "${constraint.description}"`);
              constraintLines.push(`   → This event consumes the ENTIRE day. Do NOT add other activities, meals, or experiences to this day.`);
              constraintLines.push(`   → The only additions allowed: transit to/from the event, and possibly a late dinner AFTER if appropriate.`);
              constraintLines.push(`   → Do NOT apply normal pacing rules to this day. The user explicitly chose to spend it on this one thing.\n`);
              break;
            case 'time_block':
              constraintLines.push(`⏰ TIME-LOCKED${constraint.day ? ` (Day ${constraint.day})` : ''}: "${constraint.description}"${constraint.time ? ` at ${constraint.time}` : ''}`);
              constraintLines.push(`   → This activity is locked to this exact time. Build the rest of the day AROUND it.\n`);
              break;
            case 'avoid':
              constraintLines.push(`🚫 AVOID: "${constraint.description}"`);
              constraintLines.push(`   → Do NOT include anything matching this preference in any day.\n`);
              break;
            case 'preference':
              constraintLines.push(`💎 PREFERENCE: "${constraint.description}"`);
              constraintLines.push(`   → This should influence venue/activity selection across ALL days.\n`);
              break;
            case 'flight':
              constraintLines.push(`✈️ FLIGHT${constraint.day ? ` (Day ${constraint.day})` : ''}: "${constraint.description}"${constraint.time ? ` at ${constraint.time}` : ''}`);
              constraintLines.push(`   → Account for this flight in the day's schedule. Include airport transit time.\n`);
              break;
          }
        }

        constraintLines.push(`\n⚠️ HIERARCHY: User constraints > Trip vibe > DNA archetype > System pacing rules`);
        constraintLines.push(`If a user constraint conflicts with a pacing rule, the user constraint ALWAYS wins.`);
        constraintLines.push(`${'='.repeat(60)}\n`);
        userConstraintPrompt = constraintLines.join('\n');
        console.log(`[Stage 1.9993] ✓ User constraints injected: ${context.userConstraints.length} constraints`);
      }

      // Inject flight details into context
      let flightDetailsPrompt = "";
      if (context.flightDetails) {
        flightDetailsPrompt = `\n## ✈️ USER'S FLIGHT INFORMATION\n${context.flightDetails}\n\nAccount for arrival/departure times when planning the first and last days. Include airport transit.\n`;
        console.log(`[Stage 1.9993b] ✓ Flight details injected: ${context.flightDetails.length} chars`);
      }

      // Inject structured generation rules
      if (context.generationRules && context.generationRules.length > 0) {
        userResearchPrompt += formatGenerationRules(context.generationRules);
        console.log(`[Stage 1.999c] ✓ Generation rules injected: ${context.generationRules.length} rules`);
      }

      // =======================================================================
      let mustHavesPrompt = "";
      if (context.mustHaves && context.mustHaves.length > 0) {
        mustHavesPrompt = buildMustHavesConstraintPrompt(context.mustHaves, context.totalDays);
        console.log(`[Stage 1.9991] ✓ Must-haves checklist injected: ${context.mustHaves.length} items`);
      }

      // =======================================================================
      // STAGE 1.9992: Pre-Booked Commitments (fixed calendar events)
      // =======================================================================
      let preBookedPrompt = "";
      if (context.preBookedCommitments && context.preBookedCommitments.length > 0) {
        const commitmentAnalysis = analyzePreBookedCommitments(
          context.preBookedCommitments,
          context.startDate,
          context.endDate
        );
        preBookedPrompt = commitmentAnalysis.promptSection;
        console.log(`[Stage 1.9992] ✓ Pre-booked commitments injected: ${context.preBookedCommitments.length} items, ${commitmentAnalysis.tightDays.length} tight days`);
      }

      // =======================================================================
      // STAGE 1.9995: Trip Vibe Override — user's trip-specific intent
      // =======================================================================
      let tripVibePrompt = "";
      if (context.tripVibe || (context.tripPriorities && context.tripPriorities.length > 0)) {
        const vibeParts: string[] = [];
        vibeParts.push(`\n${'='.repeat(60)}`);
        vibeParts.push(`🎯 THIS TRIP'S SPECIFIC VIBE & INTENT`);
        vibeParts.push(`${'='.repeat(60)}`);
        if (context.tripVibe) {
          vibeParts.push(`\nTrip Vibe: "${context.tripVibe}"`);
          vibeParts.push(`This is what the traveler WANTS from THIS specific trip. It overrides the archetype's default activity mix.`);
        }
        if (context.tripPriorities && context.tripPriorities.length > 0) {
          vibeParts.push(`\nTrip Priorities (MUST be reflected in activity selection):`);
          for (const p of context.tripPriorities) {
            vibeParts.push(`  - ${p}`);
          }
        }
        vibeParts.push(`\n⚠️ The trip vibe is MORE SPECIFIC than the archetype. If the vibe says "foodie adventure" but the archetype says "beach therapy", prioritize food experiences with a relaxed descriptive tone.`);
        vibeParts.push(`${'='.repeat(60)}\n`);
        tripVibePrompt = vibeParts.join('\n');
        console.log(`[Stage 1.9995] ✓ Trip vibe prompt: "${context.tripVibe}", ${context.tripPriorities?.length || 0} priorities`);
      }

      // Combine all context for maximum personalization
      // Order: USER CONSTRAINTS (highest priority) → FLIGHT DETAILS → ARCHETYPE CONSTRAINTS → INTEREST OVERRIDE → TRIP VIBE → TRIP TYPE → SKIP LIST → DIETARY ENFORCEMENT → raw prefs → enriched prefs → flight/hotel → LEARNINGS → RECENTLY USED → LOCAL EVENTS → HIDDEN GEMS → NEW PERSONALIZATION MODULES → GEOGRAPHIC COHERENCE → USER RESEARCH
      // PRIORITY ORDER: System defaults first, then user constraints LAST (most recent = highest priority for AI)
      // Phase 2 Fix: Removed unifiedDNAContext - all traveler data now comes from generationHierarchy via unified profile
      const preferenceContext =
        // --- SYSTEM DEFAULTS (lowest priority — can be overridden by user) ---
        generationHierarchy + '\n\n' +
        interestOverridePrompt + '\n\n' +
        tripVibePrompt + '\n\n' +
        tripTypePrompt + '\n\n' +
        skipListPrompt + '\n\n' +
        dietaryEnforcementPrompt + '\n\n' +
        rawPreferenceContext +
        enrichedPreferenceContext +
        tripLearningsContext +
        recentlyUsedContext +
        localEventsContext +
        hiddenGemsContext +
        voyancePicksContext +
        coldStartContext +
        forcedSlotsPrompt +
        scheduleConstraintsPrompt +
        explainabilityPrompt +
        truthAnchorPrompt +
        groupReconciliationPrompt +
        groupBlendingPromptSection +
        geographicPrompt +
        // --- LOGISTICS (medium priority) ---
        flightHotelResult.context +
        (context.flightIntelligencePrompt ? '\n\n' + context.flightIntelligencePrompt : '') +
        flightDetailsPrompt + '\n\n' +
        // --- USER REQUIREMENTS (highest priority — OVERRIDE everything above) ---
        '\n\n⚠️ FINAL AUTHORITY — USER REQUIREMENTS BELOW OVERRIDE ALL RULES ABOVE ⚠️\n' +
        'If ANY rule above conflicts with a user requirement below, the user requirement WINS. ' +
        'This includes pacing rules, activity counts, archetype density targets, and trip vibe suggestions. ' +
        'The user\'s explicit requests are the single source of truth for this itinerary.\n\n' +
        userConstraintPrompt + '\n\n' +
        userResearchPrompt + '\n\n' +
        mustHavesPrompt + '\n\n' +
        preBookedPrompt;

      // STAGE 1.9999: Pre-fetch known venue hours from verified_venues cache
      try {
        const destForCache = context.destination.toLowerCase().trim();
        const cacheResp = await fetch(
          `${supabaseUrl}/rest/v1/verified_venues?destination=ilike.%25${encodeURIComponent(destForCache)}%25&opening_hours=not.is.null&select=name,opening_hours&limit=60`,
          {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            }
          }
        );
        if (cacheResp.ok) {
          const venueRows = await cacheResp.json();
          if (venueRows && venueRows.length > 0) {
            context.venueHoursCache = venueRows.map((v: any) => ({
              name: v.name,
              opening_hours: v.opening_hours,
            }));
            console.log(`[Stage 1.9999] ✓ Pre-fetched ${context.venueHoursCache!.length} venue hours for "${context.destination}"`);
          } else {
            console.log(`[Stage 1.9999] No cached venue hours found for "${context.destination}"`);
          }
        }
      } catch (e) {
        console.warn('[Stage 1.9999] Venue hours pre-fetch failed (non-blocking):', e);
      }

      // STAGE 2: AI Generation (batch with validation and retry)
      let aiResult;
      try {
        const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
        aiResult = await generateItineraryAI(context, preferenceContext, LOVABLE_API_KEY, flightHotelResult.context, supabase, perplexityApiKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        const status = message.includes('Rate limit') ? 429 : message.includes('Credits') ? 402 : 500;
        return new Response(
          JSON.stringify({ error: message }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!aiResult?.days?.length) {
        return new Response(
          JSON.stringify({ error: "No itinerary generated" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // =======================================================================
      // STAGE 2.5: Apply dynamic transfer pricing to airport transfers
      // Priority: Viator bookable > database verified > estimated
      // =======================================================================
      if (aiResult.days.length > 0) {
        console.log("[Stage 2.5] Applying dynamic transfer costs...");
        
        // Helper to apply transfer pricing to an activity
        const applyTransferPricing = (act: StrictActivity, isReturn: boolean = false): StrictActivity => {
          const titleLower = act.title.toLowerCase();
          const isAirportTransfer = 
            titleLower.includes('airport transfer') ||
            titleLower.includes('transfer to hotel') ||
            titleLower.includes('transfer from airport') ||
            titleLower.includes('transfer to airport') ||
            (act.category === 'transport' && titleLower.includes('airport'));
          
          if (!isAirportTransfer) return act;
          
          // Use dynamic pricing if available (includes Viator bookable options)
          if (dynamicTransfer?.recommendedOption) {
            const opt = dynamicTransfer.recommendedOption;
            console.log(`[Stage 2.5] Setting "${act.title}" to ${opt.priceFormatted} (${opt.source}${opt.isBookable ? ', bookable' : ''})`);
            
            const updatedAct: StrictActivity = {
              ...act,
              cost: {
                amount: opt.priceTotal,
                currency: opt.currency,
                formatted: opt.priceFormatted,
                source: opt.source as any,
              },
              // Add booking info if Viator product available
              ...(opt.isBookable && opt.bookingUrl && {
                bookingRequired: true,
                tips: act.tips 
                  ? `${act.tips} • Book your transfer in advance for best rates.`
                  : 'Book your transfer in advance for best rates.',
              }),
            };
            
            // Store booking URL in a way the frontend can access
            if (opt.isBookable && opt.productCode) {
              (updatedAct as any).viatorProductCode = opt.productCode;
              (updatedAct as any).bookingUrl = opt.bookingUrl;
            }
            
            return updatedAct;
          }
          
          // Fallback to database fare
          if (airportFare) {
            const transferCost = airportFare.taxiCostMax ?? airportFare.taxiCostMin ?? 50;
            console.log(`[Stage 2.5] Setting "${act.title}" to ${airportFare.currencySymbol}${transferCost} (database)`);
            return {
              ...act,
              cost: {
                amount: transferCost,
                currency: airportFare.currency,
                formatted: `${airportFare.currencySymbol}${transferCost} ${airportFare.currency}`,
                source: 'database' as any,
              }
            };
          }
          
          return act;
        };
        
        // Apply to Day 1 (arrival transfer)
        const day1 = aiResult.days[0];
        day1.activities = day1.activities.map((act: StrictActivity) => applyTransferPricing(act, false));
        aiResult.days[0] = day1;
        
        // Apply to last day (departure transfer)
        if (aiResult.days.length > 1) {
          const lastDay = aiResult.days[aiResult.days.length - 1];
          lastDay.activities = lastDay.activities.map((act: StrictActivity) => applyTransferPricing(act, true));
          aiResult.days[aiResult.days.length - 1] = lastDay;
        }
        
        // Log summary
        if (dynamicTransfer) {
          const bookableCount = dynamicTransfer.options.filter(o => o.isBookable).length;
        console.log(`[Stage 2.5] Transfer pricing complete: ${dynamicTransfer.options.length} options, ${bookableCount} bookable via Viator`);
        }
      }

      // =======================================================================
      // STAGE 2.55: Split Combined Arrival Blocks
      // If the AI returned a single "Arrive and check in" block for Day 1,
      // split it into 3 separate activities: arrival, transfer, check-in
      // =======================================================================
      if (aiResult.days.length > 0) {
        const day1 = aiResult.days[0];
        if (day1.activities && day1.activities.length > 0) {
          const combinedIdx = day1.activities.findIndex((a: any) => {
            const t = (a.title || '').toLowerCase();
            return (
              (t.includes('arrive') && t.includes('check')) ||
              (t.includes('arrival') && t.includes('check-in')) ||
              (t.includes('arrive') && t.includes('hotel') && !t.includes('transfer')) ||
              t === 'arrive and check in' ||
              t === 'arrive and check-in' ||
              t === 'arrival and check-in'
            );
          });
          
          if (combinedIdx !== -1) {
            const combined = day1.activities[combinedIdx];
            const startMin = parseTimeToMinutes(combined.startTime) || 0;
            const checkInStart = minutesToHHMM(startMin);
            const checkInEnd = minutesToHHMM(startMin + 30);
            
            // Prefer multi-city hotel data, fall back to single-city flightHotelResult
            const day1City = context.multiCityDayMap?.[0];
            const hotelN = day1City?.hotelName || flightHotelResult?.hotelName || 'Hotel';
            const hotelA = day1City?.hotelAddress || flightHotelResult?.hotelAddress || '';
            
            console.log(`[Stage 2.55] Replacing combined arrival block: "${combined.title}" with Hotel Check-in only (arrival handled by UI)`);
            
            const checkinActivity = {
              ...combined,
              title: 'Hotel Check-in & Refresh',
              description: 'Check in, freshen up, and get oriented to the area',
              startTime: checkInStart,
              endTime: checkInEnd,
              category: 'accommodation',
              type: 'accommodation',
              location: { name: hotelN, address: hotelA },
            };
            
            day1.activities.splice(combinedIdx, 1, checkinActivity);
            aiResult.days[0] = day1;
            console.log(`[Stage 2.55] ✓ Replaced with: Check-in (${checkInStart}-${checkInEnd})`);
          }
        }
      }

      // =======================================================================
      // STAGE 2.56: Guarantee Day 1 Hotel Check-in
      // If Day 1 doesn't have a check-in activity, inject one.
      // The AI sometimes omits it despite prompt instructions.
      // =======================================================================
      if (aiResult.days.length > 0) {
        const day1_56 = aiResult.days[0];
        if (day1_56.activities && day1_56.activities.length > 0) {
          const hasCheckIn = day1_56.activities.some((a: any) => {
            const t = (a.title || '').toLowerCase();
            const cat = (a.category || '').toLowerCase();
            return (
              cat === 'accommodation' && (
                t.includes('check-in') || t.includes('check in') ||
                t.includes('checkin') || t.includes('settle in') ||
                t.includes('refresh') || t.includes('hotel')
              )
            );
          });

          if (!hasCheckIn) {
            const day1City_56 = context.multiCityDayMap?.[0];
            const hotelName_56 = day1City_56?.hotelName || flightHotelResult?.hotelName || 'Hotel';
            const hotelAddress_56 = day1City_56?.hotelAddress || flightHotelResult?.hotelAddress || '';

            const firstActivity_56 = day1_56.activities[0];
            const firstStartMin_56 = parseTimeToMinutes(firstActivity_56?.startTime || '10:00') || (10 * 60);
            const checkInStartMin_56 = Math.max(9 * 60, firstStartMin_56 - 45);
            const checkInEndMin_56 = checkInStartMin_56 + 30;
            const checkInStart_56 = minutesToHHMM(checkInStartMin_56);
            const checkInEnd_56 = minutesToHHMM(checkInEndMin_56);

            const checkInActivity_56 = {
              id: `day1-checkin-${Date.now()}`,
              title: 'Hotel Check-in & Refresh',
              name: 'Hotel Check-in & Refresh',
              description: 'Check in, freshen up, and get oriented to the area',
              startTime: checkInStart_56,
              endTime: checkInEnd_56,
              category: 'accommodation',
              type: 'accommodation',
              location: { name: hotelName_56, address: hotelAddress_56 },
              cost: { amount: 0, currency: 'USD' },
              bookingRequired: false,
              isLocked: false,
              durationMinutes: 30,
            };

            day1_56.activities.unshift(checkInActivity_56);
            aiResult.days[0] = day1_56;
            console.log(`[Stage 2.56] ✓ Injected missing Hotel Check-in at ${checkInStart_56}-${checkInEnd_56} (hotel: ${hotelName_56})`);
          } else {
            console.log(`[Stage 2.56] Day 1 already has check-in activity — no injection needed`);
          }
        }

        // Also check multi-city transition days (first day in each new city)
        if (context.multiCityDayMap && aiResult.days.length > 1) {
          let prevDestination_56 = '';
          for (let dIdx = 1; dIdx < aiResult.days.length; dIdx++) {
            const dayCity_56 = context.multiCityDayMap[dIdx];
            const currentDest_56 = dayCity_56?.cityName || '';

            if (currentDest_56 && currentDest_56 !== prevDestination_56 && prevDestination_56 !== '') {
              const transDay_56 = aiResult.days[dIdx];
              if (!transDay_56.activities || transDay_56.activities.length === 0) {
                prevDestination_56 = currentDest_56;
                continue;
              }

              const hasTransCheckIn = transDay_56.activities.some((a: any) => {
                const t = (a.title || '').toLowerCase();
                const cat = (a.category || '').toLowerCase();
                return cat === 'accommodation' && (
                  t.includes('check-in') || t.includes('check in') ||
                  t.includes('checkin') || t.includes('settle in') ||
                  t.includes('hotel')
                );
              });

              if (!hasTransCheckIn) {
                const transHotelName = dayCity_56?.hotelName || 'Hotel';
                const transHotelAddress = dayCity_56?.hotelAddress || '';
                const firstAct_56 = transDay_56.activities[0];
                const firstMin_56 = parseTimeToMinutes(firstAct_56?.startTime || '15:00') || (15 * 60);
                const ciStartMin_56 = Math.max(12 * 60, firstMin_56 - 45);
                const ciStart_56 = minutesToHHMM(ciStartMin_56);
                const ciEnd_56 = minutesToHHMM(ciStartMin_56 + 30);

                const ciActivity_56 = {
                  id: `day${dIdx + 1}-checkin-${Date.now()}`,
                  title: `Hotel Check-in – ${currentDest_56}`,
                  name: `Hotel Check-in – ${currentDest_56}`,
                  description: `Check in to hotel in ${currentDest_56}, freshen up after travel`,
                  startTime: ciStart_56,
                  endTime: ciEnd_56,
                  category: 'accommodation',
                  type: 'accommodation',
                  location: { name: transHotelName, address: transHotelAddress },
                  cost: { amount: 0, currency: 'USD' },
                  bookingRequired: false,
                  isLocked: false,
                  durationMinutes: 30,
                };

                transDay_56.activities.unshift(ciActivity_56);
                aiResult.days[dIdx] = transDay_56;
                console.log(`[Stage 2.56] ✓ Injected missing Hotel Check-in for ${currentDest_56} on Day ${dIdx + 1} at ${ciStart_56}-${ciEnd_56}`);
              }
            }
            prevDestination_56 = currentDest_56;
          }
        }
      }

      // =======================================================================
      // STAGE 2.57: Enforce check-in-first ordering on arrival days
      // If check-in exists but isn't the earliest activity, shift pre-check-in
      // activities to after check-in ends.
      // =======================================================================
      if (aiResult.days.length > 0) {
        const isCheckInActivity = (a: any) => {
          const t = (a.title || '').toLowerCase();
          const cat = (a.category || '').toLowerCase();
          return cat === 'accommodation' && (
            t.includes('check-in') || t.includes('check in') ||
            t.includes('checkin') || t.includes('settle in') ||
            t.includes('refresh') || t.includes('hotel')
          );
        };

        // Determine which day indices are arrival days (Day 1 + first day in each new city)
        const arrivalDayIndices = new Set<number>([0]);
        if (context.multiCityDayMap && aiResult.days.length > 1) {
          let prevDest = '';
          for (let dIdx = 0; dIdx < aiResult.days.length; dIdx++) {
            const dest = context.multiCityDayMap[dIdx]?.destination || '';
            if (dest && dest !== prevDest && prevDest !== '') {
              arrivalDayIndices.add(dIdx);
            }
            prevDest = dest;
          }
        }

        for (const dIdx of arrivalDayIndices) {
          const day = aiResult.days[dIdx];
          if (!day?.activities || day.activities.length < 2) continue;

          const checkInIdx = day.activities.findIndex((a: any) => isCheckInActivity(a));
          if (checkInIdx < 0) continue; // no check-in to enforce

          const checkIn = day.activities[checkInIdx];
          const checkInStartMin = parseTimeToMinutes(checkIn.startTime);
          const checkInEndMin = parseTimeToMinutes(checkIn.endTime) || (checkInStartMin + 30);

          // Find activities scheduled before check-in
          const preCheckInActivities: any[] = [];
          const postCheckInActivities: any[] = [];

          for (let i = 0; i < day.activities.length; i++) {
            if (i === checkInIdx) continue;
            const actStart = parseTimeToMinutes(day.activities[i].startTime);
            if (actStart < checkInStartMin) {
              preCheckInActivities.push(day.activities[i]);
            } else {
              postCheckInActivities.push(day.activities[i]);
            }
          }

          if (preCheckInActivities.length === 0) continue; // check-in is already first

          // Shift pre-check-in activities to after check-in ends
          let cursor = checkInEndMin + 15; // 15-min buffer after check-in
          // Sort pre-check-in by their original start time to preserve relative order
          preCheckInActivities.sort((a: any, b: any) =>
            (parseTimeToMinutes(a.startTime) || 0) - (parseTimeToMinutes(b.startTime) || 0)
          );

          for (const act of preCheckInActivities) {
            const origStart = parseTimeToMinutes(act.startTime) || 0;
            const origEnd = parseTimeToMinutes(act.endTime) || (origStart + 60);
            const duration = origEnd - origStart;
            act.startTime = minutesToHHMM(cursor);
            act.endTime = minutesToHHMM(cursor + duration);
            cursor += duration + 15; // 15-min gap between shifted activities
          }

          // Rebuild: check-in first, then shifted activities, then original post-check-in activities
          // Sort everything after check-in by start time
          const allAfter = [...preCheckInActivities, ...postCheckInActivities];
          allAfter.sort((a: any, b: any) =>
            (parseTimeToMinutes(a.startTime) || 0) - (parseTimeToMinutes(b.startTime) || 0)
          );
          
          // Mini overlap resolution: ensure shifted activities don't overlap existing ones
          for (let k = 0; k < allAfter.length - 1; k++) {
            const curEnd = parseTimeToMinutes(allAfter[k].endTime) || 0;
            const nextStart = parseTimeToMinutes(allAfter[k + 1].startTime) || 0;
            if (curEnd > nextStart) {
              const nextDuration = (parseTimeToMinutes(allAfter[k + 1].endTime) || (nextStart + 60)) - nextStart;
              const newStart = curEnd + 15;
              allAfter[k + 1].startTime = minutesToHHMM(newStart);
              allAfter[k + 1].endTime = minutesToHHMM(newStart + nextDuration);
              console.log(`[Stage 2.57] Resolved overlap: pushed "${allAfter[k + 1].title || allAfter[k + 1].name}" to ${minutesToHHMM(newStart)}`);
            }
          }
          
          day.activities = [checkIn, ...allAfter];
          aiResult.days[dIdx] = day;

          console.log(`[Stage 2.57] ✓ Day ${dIdx + 1}: Shifted ${preCheckInActivities.length} pre-check-in activities to after check-in (${checkIn.startTime}-${checkIn.endTime})`);
        }
      }

      // =======================================================================
      // Validate itinerary against user preferences before saving
      // =======================================================================
      console.log("[Stage 2.6] Validating personalization compliance...");
      
      // Build validation context from available preferences (Phase 2 Fix: use unified profile)
      const validationCtx = buildValidationContext(
        prefs || {},
        budgetIntent,
        unifiedProfile.traitScores as unknown as Record<string, number>,
        [] // Trip intents loaded separately for full generation
      );
      
      const validationResult = validateItineraryPersonalization(aiResult.days, validationCtx);
      
      // Log validation results
      console.log(`[Stage 2.6] Personalization score: ${validationResult.personalizationScore}/100`);
      console.log(`[Stage 2.6] Stats: ${validationResult.stats.personalizationFieldsPresent}/${validationResult.stats.activitiesChecked} activities have personalization fields`);
      
      if (validationResult.violations.length > 0) {
        console.warn(`[Stage 2.6] Violations found: ${validationResult.violations.length}`);
        validationResult.violations.slice(0, 5).forEach(v => 
          console.warn(`  - [${v.severity}] ${v.type}: ${v.activityTitle} - ${v.details}`)
        );
      }
      
      // Enforce critical violations — dietary restrictions and severe personalization failures
      if (!validationResult.isValid) {
        const criticalViolations = validationResult.violations.filter((v: any) => v.severity === 'critical');
        const majorDietaryViolations = validationResult.violations.filter((v: any) => v.type === 'dietary' && v.severity === 'major');

        if (criticalViolations.length > 0 || majorDietaryViolations.length > 0) {
          console.error(`[Stage 2.6] CRITICAL VIOLATIONS DETECTED — ${criticalViolations.length} critical, ${majorDietaryViolations.length} dietary`);

          for (const v of [...criticalViolations, ...majorDietaryViolations]) {
            console.error(`  → [${v.severity}] ${v.type}: "${v.activityTitle}" on Day ${v.dayNumber} — ${v.details}`);
          }

          // For dietary violations, patch offending activities with warnings
          for (const v of majorDietaryViolations) {
            const day = aiResult.days.find((d: any) => d.dayNumber === v.dayNumber);
            if (day) {
              const actIdx = day.activities.findIndex((a: any) => a.title === v.activityTitle);
              if (actIdx >= 0) {
                const original = day.activities[actIdx];
                console.warn(`[Stage 2.6] Patching dietary violation: "${original.title}" → marking for user warning`);
                original.dietaryWarning = v.details;
                original.description = (original.description || '') + `\n⚠️ Note: This venue may not fully accommodate your dietary preferences. Consider asking about ${v.details.split('restriction')[0].trim()} options when booking.`;
              }
            }
          }
        }

        if (validationResult.personalizationScore < 40) {
          console.warn(`[Stage 2.6] LOW PERSONALIZATION SCORE: ${validationResult.personalizationScore}/100 — itinerary may feel generic`);
        }
      }

      // =======================================================================
      // STAGE 2.7: Overlap Fix (lightweight)
      // Only fix true overlaps and zero/negative gaps (< 5 min).
      // Distance-aware buffer enforcement happens in Stage 4.6 after
      // coordinates are available from enrichment.
      // =======================================================================
      const MIN_OVERLAP_GAP = scheduleConstraints?.bufferMinutesBetweenActivities || 15;
      let overlapFixCount = 0;
      
      for (const day of aiResult.days) {
        if (!day.activities || day.activities.length < 2) continue;
        
        for (let i = 0; i < day.activities.length - 1; i++) {
          const current = day.activities[i];
          const next = day.activities[i + 1];
          
          const parseT = (t?: string): number | null => {
            if (!t) return null;
            const n = t.trim().toUpperCase();
            const m = n.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
            if (!m) return null;
            let h = parseInt(m[1], 10);
            const min = parseInt(m[2], 10);
            if (m[3] === 'PM' && h !== 12) h += 12;
            if (m[3] === 'AM' && h === 12) h = 0;
            return h * 60 + min;
          };
          
          const fmtT = (mins: number): string => {
            const dayMinutes = 24 * 60;
            const normalized = ((mins % dayMinutes) + dayMinutes) % dayMinutes;
            const h = Math.floor(normalized / 60);
            const m = normalized % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          };
          
          const startMins = parseT(current.startTime);
          if (startMins === null) continue;
          
          let durMins = 60;
          if (current.duration) {
            const d = String(current.duration).toLowerCase();
            const hm = d.match(/([\d.]+)\s*(?:hours?|hrs?|h)/);
            const mm = d.match(/([\d.]+)\s*(?:minutes?|mins?|m(?!onth))/);
            durMins = 0;
            if (hm) durMins += parseFloat(hm[1]) * 60;
            if (mm) durMins += parseFloat(mm[1]);
            if (durMins === 0) durMins = 60;
          }
          
          const endMins = startMins + durMins;
          const nextStartMins = parseT(next.startTime);
          if (nextStartMins === null) continue;
          
          const gap = nextStartMins - endMins;
          
          // Only fix true overlaps / near-zero gaps
          if (gap < MIN_OVERLAP_GAP) {
            const newStart = endMins + MIN_OVERLAP_GAP;
            const oldTime = next.startTime;
            next.startTime = fmtT(newStart);
            if (next.endTime) {
              const nextDur = (parseT(next.endTime) || (newStart + 60)) - (parseT(oldTime) || newStart);
              next.endTime = fmtT(newStart + Math.max(nextDur, 30));
            }
            overlapFixCount++;
            console.log(`[Stage 2.7] Day ${day.dayNumber}: Fixed overlap for "${next.title || next.name}" from ${oldTime} → ${next.startTime} (gap was ${gap} min)`);
          }
        }
      }
      
      if (overlapFixCount > 0) {
        console.log(`[Stage 2.7] Fixed ${overlapFixCount} overlaps/zero-gaps across all days`);
      }

      // =====================================================================
      // STAGE 2.75: Check-in Time Consistency
      // Relabel early arrivals as "Luggage Drop" when before hotel check-in
      // =====================================================================
      try {
        const hotelCheckInTime275 = context.hotelData?.checkInTime || '15:00';
        const checkInMins275 = parseTimeToMinutes(hotelCheckInTime275);
        if (checkInMins275 > 0 && aiResult.days.length > 0) {
          const day1 = aiResult.days[0];
          const checkinAct = day1.activities?.find((a: any) =>
            (a.category || '').toLowerCase() === 'accommodation' &&
            /(check.?in|luggage drop)/i.test(a.title || '')
          );
          if (checkinAct) {
            const actStart275 = parseTimeToMinutes(checkinAct.startTime || '');
            if (actStart275 > 0 && actStart275 < checkInMins275) {
              if (!/(luggage|bag|drop)/i.test(checkinAct.title || '')) {
                checkinAct.title = (checkinAct.title || '').replace(/check.?in/i, 'Luggage Drop') || 'Luggage Drop & Early Check-in';
                console.log(`[Stage 2.75] Relabeled Day 1 check-in to "${checkinAct.title}" (arrives ${checkinAct.startTime} before check-in ${hotelCheckInTime275})`);
              }
              if (!checkinAct.description?.includes('early check-in')) {
                checkinAct.description = (checkinAct.description || '') +
                  ` Early check-in subject to availability (standard check-in: ${hotelCheckInTime275}).`;
              }
            }
          }
        }
      } catch (e275) {
        console.warn(`[Stage 2.75] Check-in relabel error:`, e275);
      }

      // =====================================================================
      // STAGE 2.8: Must-Do Validation + Injection Safety Net
      // =====================================================================
      if (context.mustDoActivities && context.mustDoActivities.trim()) {
        try {
          const forceAllMust = !!context.isSmartFinish || !!context.smartFinishRequested;
          const mustDoCheck = parseMustDoInput(context.mustDoActivities, context.destination, forceAllMust, context.startDate, context.totalDays);
          if (mustDoCheck.length > 0) {
            const itineraryForValidation = aiResult.days.map((d: any) => ({
              dayNumber: d.dayNumber,
              activities: (d.activities || []).map((a: any) => ({ title: a.title || a.name || '', description: a.description || '' })),
            }));
            const validation = validateMustDosInItinerary(itineraryForValidation, mustDoCheck, context.destination);

            if (!validation.allPresent && validation.missing.length > 0) {
              console.warn(`[Stage 2.8] ⚠️ MISSING must-do activities — injecting safety-net placeholders:`);

              // Get schedule assignments for injection targeting
              const mustDoSchedule = scheduleMustDos(mustDoCheck, context.totalDays);
              const scheduledMap = new Map<string, number>();
              for (const s of mustDoSchedule.scheduled) {
                scheduledMap.set(s.priority.id, s.assignedDay);
              }

              for (const m of validation.missing) {
                const targetDay = scheduledMap.get(m.id) || m.preferredDay || Math.ceil(context.totalDays / 2);
                const dayObj = aiResult.days.find((d: any) => d.dayNumber === targetDay) || aiResult.days[aiResult.days.length - 1];

                if (!dayObj) continue;

                // Determine injection time based on preferredTime
                let injectionTime = '14:00';
                let injectionEndTime = '16:00';
                if (m.preferredTime === 'morning') { injectionTime = '10:00'; injectionEndTime = '12:00'; }
                else if (m.preferredTime === 'evening') { injectionTime = '18:00'; injectionEndTime = '20:00'; }

                const injectedActivity = {
                  id: `injected_${m.id}_${Date.now()}`,
                  title: m.activityName,
                  name: m.activityName,
                  description: m.userDescription || `You mentioned "${m.activityName}" — we've added it to your day. Tap to customize details.`,
                  startTime: injectionTime,
                  endTime: injectionEndTime,
                  duration: `${Math.round((m.estimatedDuration || 120) / 60)} hours`,
                  category: m.requiresBooking ? 'attraction' : 'experience',
                  source: 'must_do_injection',
                  cost: { amount: 0, currency: 'USD' },
                  location: { address: '', neighborhood: m.location || '' },
                  notes: `You mentioned "${m.activityName}" — we've added it to your day. Tap to customize details.`,
                };

                dayObj.activities.push(injectedActivity);

                // Re-sort chronologically
                dayObj.activities.sort((a: any, b: any) => {
                  const parseMin = (t?: string) => {
                    if (!t) return 0;
                    const match = t.match(/(\d{1,2}):(\d{2})/);
                    return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
                  };
                  return parseMin(a.startTime) - parseMin(b.startTime);
                });

                console.warn(`  🔧 Injected "${m.activityName}" into Day ${dayObj.dayNumber} at ${injectionTime}`);
              }

              console.log(`[Stage 2.8] Injected ${validation.missing.length} must-do placeholder(s) as safety net`);
            } else {
              console.log(`[Stage 2.8] ✓ All must-do activities verified present in itinerary (${validation.found.length} found)`);
            }
          }
        } catch (mustDoValErr) {
          console.warn('[Stage 2.8] Must-do validation error (non-blocking):', mustDoValErr);
        }
      }

      // STAGE 3: Early Save (Critical - ensures user gets itinerary)
      await earlySaveItinerary(supabase, tripId, aiResult.days);

      // =======================================================================
      // STAGE 3.5: Geographic Validation & Reordering
      // =======================================================================
      console.log("[Stage 3.5] Validating geographic coherence...");
      
      const geoValidations: GeographicValidation[] = [];
      
      for (let dayIdx = 0; dayIdx < aiResult.days.length; dayIdx++) {
        const day = aiResult.days[dayIdx];
        
        // Convert activities to ActivityWithLocation format
        const activitiesWithLocation: ActivityWithLocation[] = day.activities.map((act: StrictActivity) => ({
          id: act.id,
          title: act.title,
          coordinates: act.location?.coordinates,
          neighborhood: act.location?.address?.split(',')[0],
          isLocked: (act as any).isLocked || false,
          category: act.category
        }));
        
        // Determine day anchor
        const dayAnchor = determineDayAnchor(activitiesWithLocation, undefined, hotelNeighborhood, cityZones);
        
        // Validate
        const validation = validateDayGeography(activitiesWithLocation, dayAnchor, travelConstraints, cityZones);
        geoValidations.push(validation);
        
        // If validation fails, try reordering
        if (!validation.isValid && validation.violations.some(v => v.type === 'backtracking' || v.type === 'long_hop')) {
          console.log(`[Stage 3.5] Day ${dayIdx + 1} failed validation (score: ${validation.score}), attempting reorder...`);
          const reordered = reorderActivitiesOptimally(activitiesWithLocation, dayAnchor);
          
          // Apply reordering to actual activities (preserve all data, just change order)
          const reorderedIds = reordered.map(a => a.id);
          day.activities = day.activities.sort((a: StrictActivity, b: StrictActivity) => {
            const aIdx = reorderedIds.indexOf(a.id);
            const bIdx = reorderedIds.indexOf(b.id);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
          });
        }
      }
      
      // Log QA metrics
      logGeographicQAMetrics(geoValidations, tripId);

      // ── Access gate: determine if user qualifies for photo enrichment ──
      let canEnrichPhotos = true;
      try {
        // Check 1: Has any paid purchase?
        const { data: purchaseRow } = await supabase
          .from('credit_purchases')
          .select('id')
          .eq('user_id', context.userId)
          .not('credit_type', 'in', '("free_monthly","signup_bonus","referral_bonus")')
          .gt('remaining', -1)
          .limit(1)
          .maybeSingle();
        const hasCompletedPurchase = !!purchaseRow;

        // Check 2: Is this the user's first trip?
        const { count: tripCount } = await supabase
          .from('trips')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', context.userId)
          .not('itinerary_status', 'is', null);
        const isFirstTrip = (tripCount ?? 0) <= 1;

        // Check 3: Smart Finish purchased?
        const { data: tripRow } = await supabase
          .from('trips')
          .select('smart_finish_purchased')
          .eq('id', context.tripId)
          .maybeSingle();
        const tripHasSmartFinish = !!tripRow?.smart_finish_purchased;

        canEnrichPhotos = hasCompletedPurchase || tripHasSmartFinish || isFirstTrip;
        console.log(`[Stage 4] Photo enrichment gate: purchase=${hasCompletedPurchase}, firstTrip=${isFirstTrip}, smartFinish=${tripHasSmartFinish} → ${canEnrichPhotos ? 'ENRICH' : 'SKIP PHOTOS'}`);
      } catch (gateErr) {
        console.warn('[Stage 4] Access gate check failed, defaulting to enrich:', gateErr);
        canEnrichPhotos = true; // Fail-open
      }

      // STAGE 4: Enrichment (real photos + venue verification via Google Places API v1)
      let enrichedDays: StrictDay[];
      let enrichmentStats: EnrichmentStats | null = null;
      try {
        if (canEnrichPhotos) {
          const enrichmentResult = await enrichItinerary(aiResult.days, context.destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY);
          enrichedDays = enrichmentResult.days;
          enrichmentStats = enrichmentResult.stats;
        } else {
          // Skip photo enrichment but still do venue verification without photos
          console.log('[Stage 4] Skipping photo enrichment for gated user — venue verification only');
          const enrichmentResult = await enrichItinerary(aiResult.days, context.destination, supabaseUrl, supabaseKey, undefined, LOVABLE_API_KEY);
          enrichedDays = enrichmentResult.days;
          enrichmentStats = enrichmentResult.stats;
          // Strip any photos that might have been added from cache
          for (const day of enrichedDays) {
            for (const act of day.activities) {
              act.photos = [];
            }
          }
        }
      } catch (enrichError) {
        console.warn('[generate-itinerary] Enrichment failed, using base itinerary:', enrichError);
        enrichedDays = aiResult.days;
      }

      // =======================================================================
      // STAGE 4.5: Opening Hours Validation & Auto-Fix
      // Detect activities scheduled outside operating hours and attempt to fix.
      // CONFIRMED CLOSURES (venue closed all day) → REMOVE the activity.
      // Time conflicts (venue open, wrong time) → shift time.
      // Unfixable time conflicts → tag as closedRisk (uncertain warning only).
      // =======================================================================
      if (context.startDate) {
        const hoursViolations = validateOpeningHours(enrichedDays, context.startDate);
        if (hoursViolations.length > 0) {
          console.warn(`[Stage 4.5] ⚠️ ${hoursViolations.length} opening hours conflict(s) detected — attempting auto-fix:`);
          
          let fixedCount = 0;
          let removedCount = 0;
          
          for (const violation of hoursViolations) {
            const day = enrichedDays[violation.dayNumber - 1];
            if (!day) continue;
            const activity = day.activities.find((a: StrictActivity) => a.id === violation.activityId);
            if (!activity) continue;
            
            // ─── CONFIRMED CLOSED ALL DAY → REMOVE the activity ───
            if (violation.isConfirmedClosed) {
              const removedTitle = activity.title;
              day.activities = day.activities.filter((a: StrictActivity) => a.id !== violation.activityId);
              removedCount++;
              console.log(`  ✗ Day ${violation.dayNumber}: "${removedTitle}" — REMOVED (confirmed closed on this day)`);
              continue;
            }
            
            // ─── TIME CONFLICT (venue is open, but wrong time) → try shifting ───
            const openingHours = (activity as any).openingHours as string[] | undefined;
            if (openingHours && activity.startTime) {
              const startDate = new Date(context.startDate);
              startDate.setDate(startDate.getDate() + (violation.dayNumber - 1));
              const dayOfWeek = startDate.getDay();
              
              const DAY_NAMES_FIX = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const dayName = DAY_NAMES_FIX[dayOfWeek];
              const dayEntry = openingHours.find(h => h.toLowerCase().startsWith(dayName.toLowerCase()));
              
              if (dayEntry) {
                const entryLower = dayEntry.toLowerCase();
                // Double-check: if somehow closed entry slipped through (shouldn't with isConfirmedClosed above)
                if (entryLower.includes('closed') || entryLower.includes('fermé') || entryLower.includes('cerrado') || entryLower.includes('chiuso')) {
                  day.activities = day.activities.filter((a: StrictActivity) => a.id !== violation.activityId);
                  removedCount++;
                  console.log(`  ✗ Day ${violation.dayNumber}: "${violation.activityTitle}" — REMOVED (closed, caught in fallback)`);
                  continue;
                }
                
                // Extract ALL time ranges for this day (handles split hours like lunch + dinner)
                const { extractTimeRanges: extractRanges } = await import('./truth-anchors.ts');
                // We need to use the function from truth-anchors if available, otherwise parse inline
                const rangeMatch12h = entryLower.match(/(\d{1,2}):(\d{2})\s*(am|pm)\s*[–\-−to]+\s*(\d{1,2}):(\d{2})\s*(am|pm)/gi);
                const rangeMatch24h = entryLower.match(/(\d{1,2}):(\d{2})\s*[–\-−to]+\s*(\d{1,2}):(\d{2})/g);
                
                // Parse opening and closing times
                let venueOpenMins = -1;
                let venueCloseMins = -1;
                
                const timeMatch = entryLower.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
                if (timeMatch) {
                  let openHour = parseInt(timeMatch[1]);
                  const openMin = parseInt(timeMatch[2]);
                  const period = timeMatch[3]?.toUpperCase();
                  if (period === 'PM' && openHour !== 12) openHour += 12;
                  if (period === 'AM' && openHour === 12) openHour = 0;
                  venueOpenMins = openHour * 60 + openMin;
                }
                
                // Extract closing time (second time in the range)
                const closeMatch = entryLower.match(/[–\-−to]+\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i);
                if (closeMatch) {
                  let closeHour = parseInt(closeMatch[1]);
                  const closeMin = parseInt(closeMatch[2]);
                  const closePeriod = closeMatch[3]?.toUpperCase();
                  if (closePeriod === 'PM' && closeHour !== 12) closeHour += 12;
                  if (closePeriod === 'AM' && closeHour === 12) closeHour = 0;
                  venueCloseMins = closeHour * 60 + closeMin;
                  // Handle midnight: "11:00 PM – 12:00 AM" → close = 1440
                  if (venueCloseMins === 0) venueCloseMins = 1440;
                }
                
                if (venueOpenMins >= 0 && venueCloseMins > 0) {
                  const oldStartTime = activity.startTime;
                  const oldMins = parseInt(oldStartTime.split(':')[0]) * 60 + parseInt(oldStartTime.split(':')[1]);
                  const duration = activity.endTime 
                    ? (parseInt(activity.endTime.split(':')[0]) * 60 + parseInt(activity.endTime.split(':')[1])) - oldMins
                    : 60; // default 1 hour
                  
                  let newStartMins = -1;
                  
                  // Case A: Scheduled BEFORE venue opens → shift to opening + 10 min buffer
                  if (oldMins < venueOpenMins) {
                    newStartMins = venueOpenMins + 10;
                  }
                  // Case B: Scheduled AFTER venue closes (or too close to closing) → shift earlier
                  else if (oldMins >= venueCloseMins || (oldMins + duration) > venueCloseMins) {
                    // Place activity so it ends 15 min before closing
                    const latestStart = venueCloseMins - duration - 15;
                    if (latestStart >= venueOpenMins + 10) {
                      newStartMins = latestStart;
                    } else {
                      // Activity duration doesn't fit in opening window — REMOVE instead of warning
                      day.activities = day.activities.filter((a: StrictActivity) => a.id !== violation.activityId);
                      removedCount++;
                      console.log(`  ✗ Day ${violation.dayNumber}: "${violation.activityTitle}" — REMOVED (duration ${duration}min doesn't fit in venue hours)`);
                      continue;
                    }
                  }
                  
                  if (newStartMins >= 0 && newStartMins !== oldMins) {
                    // Hard-constraint check: ensure shifted time doesn't squeeze against checkout/departure
                    // But ONLY treat checkout as hard stop if day has a flight departure
                    // (no-flight days deliberately schedule farewell activities AFTER checkout)
                    const dayHasFlightDeparture = day.activities.some((a: StrictActivity) => {
                      const tLower = (a.title || a.name || '').toLowerCase();
                      const cLower = (a.category || '').toLowerCase();
                      return cLower === 'transport' && (tLower.includes('airport') || tLower.includes('flight'));
                    });
                    
                    const hardStopAct = day.activities.find((a: StrictActivity) => {
                      const catLower = (a.category || '').toLowerCase();
                      const titleLower = (a.title || a.name || '').toLowerCase();
                      const isCheckout = catLower === 'accommodation' && (titleLower.includes('check') || titleLower.includes('checkout'));
                      if (isCheckout && !dayHasFlightDeparture) return false;
                      return isCheckout
                        || (catLower === 'transport' && (titleLower.includes('depart') || titleLower.includes('airport') || titleLower.includes('flight') || titleLower.includes('train')));
                    });
                    if (hardStopAct && hardStopAct.startTime) {
                      const hardStopMins = parseInt(hardStopAct.startTime.split(':')[0]) * 60 + parseInt(hardStopAct.startTime.split(':')[1]);
                      const estimatedEnd = newStartMins + duration + 20; // 20min transit buffer
                      if (estimatedEnd > hardStopMins) {
                        // Shifted activity would squeeze past checkout/departure — REMOVE instead
                        day.activities = day.activities.filter((a: StrictActivity) => a.id !== violation.activityId);
                        removedCount++;
                        console.log(`  ✗ Day ${violation.dayNumber}: "${violation.activityTitle}" — REMOVED (shifted time ${newStartMins}min + ${duration}min + transit exceeds hard stop at ${hardStopMins}min)`);
                        continue;
                      }
                    }
                    
                    const newStartTime = `${Math.floor(newStartMins / 60).toString().padStart(2, '0')}:${(newStartMins % 60).toString().padStart(2, '0')}`;
                    const newEndMins = newStartMins + duration;
                    activity.startTime = newStartTime;
                    if (activity.endTime) {
                      activity.endTime = `${Math.floor(newEndMins / 60).toString().padStart(2, '0')}:${(newEndMins % 60).toString().padStart(2, '0')}`;
                    }
                    fixedCount++;
                    console.log(`  ✓ Day ${violation.dayNumber}: "${violation.activityTitle}" shifted ${oldStartTime} → ${newStartTime} (venue hours: ${Math.floor(venueOpenMins / 60).toString().padStart(2, '0')}:${(venueOpenMins % 60).toString().padStart(2, '0')}–${Math.floor(venueCloseMins / 60).toString().padStart(2, '0')}:${(venueCloseMins % 60).toString().padStart(2, '0')})`);
                    continue;
                  }
                }
              }
            }
            
            // Couldn't auto-fix and not confirmed closed — tag as uncertain warning only
            // But first: suppress for nightlife/entertainment categories with implausible morning-only hours
            const actCatLower = (activity.category || '').toLowerCase();
            const nightlifeCategories = ['nightlife', 'entertainment', 'bar', 'jazz', 'club', 'music', 'live music', 'concert'];
            const isNightlifeCategory = nightlifeCategories.some(c => actCatLower.includes(c));
            const reasonLooksImplausible = violation.reason && /Open\s+\d{2}:\d{2}[–\-]\d{2}:\d{2}/.test(violation.reason) && 
              (() => {
                const closeMatch = violation.reason.match(/Open\s+\d{2}:\d{2}[–\-](\d{2}):(\d{2})/);
                if (closeMatch) {
                  const closeMins = parseInt(closeMatch[1]) * 60 + parseInt(closeMatch[2]);
                  return closeMins <= 720; // closes before noon
                }
                return false;
              })();
            
            if (isNightlifeCategory && reasonLooksImplausible) {
              console.log(`  ⊘ Day ${violation.dayNumber}: "${violation.activityTitle}" — suppressed implausible hours warning for ${actCatLower} venue`);
            } else {
              (activity as any).closedRisk = true;
              (activity as any).closedRiskReason = violation.reason;
              console.warn(`  - Day ${violation.dayNumber}: "${violation.activityTitle}" — ${violation.reason} (uncertain, tagged as warning)`);
            }
          }
          
          const summary: string[] = [];
          if (fixedCount > 0) summary.push(`${fixedCount} time-shifted`);
          if (removedCount > 0) summary.push(`${removedCount} removed (confirmed closed)`);
          console.log(`[Stage 4.5] ✓ Results: ${summary.join(', ') || 'no fixes needed'} out of ${hoursViolations.length} conflicts`);
        } else {
          console.log("[Stage 4.5] ✓ No opening hours conflicts detected");
        }
      }

      // =======================================================================
      // STAGE 4.6: Distance-Aware Buffer Enforcement
      // Now that Stage 4 enrichment has added verified GPS coordinates,
      // calculate actual haversine distances between consecutive activities
      // and enforce realistic transit buffers based on distance.
      // =======================================================================
      {
        const distanceToMinBuffer = (distKm: number): number => {
          if (distKm < 0.5) return 10;   // < 500m: easy walk
          if (distKm < 2) return 15;      // 500m–2km: brisk walk
          if (distKm < 5) return 20;      // 2km–5km: short taxi
          if (distKm < 15) return 30;     // 5km–15km: taxi ride
          return 45;                       // > 15km: cross-city
        };

        let bufferFixCount = 0;

        for (const day of enrichedDays) {
          if (!day.activities || day.activities.length < 2) continue;

          for (let i = 0; i < day.activities.length - 1; i++) {
            const current = day.activities[i];
            const next = day.activities[i + 1];

            // Get coordinates from enriched location data
            const curCoords = current.location?.coordinates || current.coordinates;
            const nextCoords = next.location?.coordinates || next.coordinates;

            if (!curCoords?.lat || !curCoords?.lng || !nextCoords?.lat || !nextCoords?.lng) {
              // No coordinates — enforce a minimum buffer as fallback
              const FALLBACK_BUFFER = 15;
              const curEndMinsNoCoord = parseTimeToMinutes(current.endTime || current.startTime || '');
              const nextStartMinsNoCoord = parseTimeToMinutes(next.startTime || '');
              if (curEndMinsNoCoord > 0 && nextStartMinsNoCoord > 0) {
                const gapNoCoord = nextStartMinsNoCoord - curEndMinsNoCoord;
                if (gapNoCoord < FALLBACK_BUFFER && gapNoCoord >= 0) {
                  const deficit = FALLBACK_BUFFER - gapNoCoord;
                  for (let j = i + 1; j < day.activities.length; j++) {
                    const sM = parseTimeToMinutes(day.activities[j].startTime || '');
                    const eM = parseTimeToMinutes(day.activities[j].endTime || '');
                    if (sM > 0) {
                      const sH = Math.floor((sM + deficit) / 60);
                      const sMn = (sM + deficit) % 60;
                      day.activities[j].startTime = `${String(sH).padStart(2,'0')}:${String(sMn).padStart(2,'0')}`;
                    }
                    if (eM > 0) {
                      const eH = Math.floor((eM + deficit) / 60);
                      const eMn = (eM + deficit) % 60;
                      day.activities[j].endTime = `${String(eH).padStart(2,'0')}:${String(eMn).padStart(2,'0')}`;
                    }
                  }
                  bufferFixCount++;
                  console.log(`[Stage 4.6] Day ${day.dayNumber}: No-coord fallback buffer for "${next.title || next.name}" — shifted +${deficit}min`);
                }
              }
              continue;
            }

            const distKm = haversineDistanceKm(
              curCoords.lat, curCoords.lng,
              nextCoords.lat, nextCoords.lng
            );

            const requiredBuffer = distanceToMinBuffer(distKm);

            // Parse current end time and next start time
            const curEndMins = parseTimeToMinutes(current.endTime || current.startTime || '');
            const nextStartMins = parseTimeToMinutes(next.startTime || '');
            if (curEndMins === null || nextStartMins === null) continue;

            // If current has no endTime, estimate from duration
            let effectiveEndMins = curEndMins;
            if (!current.endTime && current.startTime) {
              const startM = parseTimeToMinutes(current.startTime);
              if (startM !== null) {
                let durMins = 60;
                if (current.duration) {
                  const d = String(current.duration).toLowerCase();
                  const hm = d.match(/([\d.]+)\s*(?:hours?|hrs?|h)/);
                  const mm = d.match(/([\d.]+)\s*(?:minutes?|mins?|m(?!onth))/);
                  durMins = 0;
                  if (hm) durMins += parseFloat(hm[1]) * 60;
                  if (mm) durMins += parseFloat(mm[1]);
                  if (durMins === 0) durMins = 60;
                }
                effectiveEndMins = startM + durMins;
              }
            }

            const actualGap = nextStartMins - effectiveEndMins;

            if (actualGap < requiredBuffer) {
              const deficit = requiredBuffer - actualGap;
              // Check if cascade would hit a hard-stop activity (checkout/departure)
              // Checkout is only a hard stop if the day has a flight departure
              const dayHasFlightDep46 = day.activities.some((a: any) => {
                const tL = (a.title || a.name || '').toLowerCase();
                const cL = (a.category || '').toLowerCase();
                return cL === 'transport' && (tL.includes('airport') || tL.includes('flight'));
              });
              
              let hitHardStop = false;
              for (let j = i + 1; j < day.activities.length; j++) {
                const act = day.activities[j];
                const catLower = (act.category || '').toLowerCase();
                const titleLower = (act.title || act.name || '').toLowerCase();
                const isCheckout = catLower === 'accommodation' && (titleLower.includes('check') || titleLower.includes('checkout'));
                const isTransportHardStop = catLower === 'transport' && (titleLower.includes('depart') || titleLower.includes('airport') || titleLower.includes('flight') || titleLower.includes('train'));
                const isHardStop = (isCheckout && dayHasFlightDep46) || isTransportHardStop;
                if (isHardStop) {
                  // Before removing, check if current is a must-do — if so, truncate instead
                  const isMustDo = (current as any).isMustDo || (current as any).mustDo || (current as any).is_must_do;
                  if (isMustDo) {
                    const actStartMins = parseTimeToMinutes(act.startTime || '') ?? 1440;
                    const curStartMins = parseTimeToMinutes(current.startTime || '') ?? 0;
                    const availableMins = actStartMins - curStartMins - requiredBuffer;
                    if (availableMins >= 20) {
                      const newEndMins = curStartMins + availableMins;
                      current.endTime = `${Math.floor(newEndMins / 60).toString().padStart(2, '0')}:${(newEndMins % 60).toString().padStart(2, '0')}`;
                      console.log(`[Stage 4.6] Day ${day.dayNumber}: truncated must-do "${current.title}" to ${availableMins}min to fit before hard-stop "${act.title}"`);
                      hitHardStop = true;
                      bufferFixCount++;
                      break;
                    }
                  }
                  // Don't cascade into checkout/departure — remove the activity causing the overflow instead
                  console.log(`[Stage 4.6] Day ${day.dayNumber}: cascade would shift hard-stop "${act.title}" — removing "${current.title}" instead`);
                  day.activities.splice(i, 1);
                  i--; // re-check from same index
                  hitHardStop = true;
                  bufferFixCount++;
                  break;
                }
              }
              if (!hitHardStop) {
                // Safe to cascade-shift all subsequent activities forward
                for (let j = i + 1; j < day.activities.length; j++) {
                  const act = day.activities[j];
                  const s = parseTimeToMinutes(act.startTime || '');
                  const e = parseTimeToMinutes(act.endTime || '');
                  if (s !== null) act.startTime = minutesToHHMM(s + deficit);
                  if (e !== null) act.endTime = minutesToHHMM(e + deficit);
                }
                bufferFixCount++;
                console.log(`[Stage 4.6] Day ${day.dayNumber}: "${current.title}" → "${next.title}" = ${distKm.toFixed(1)}km, needed ${requiredBuffer}min buffer but had ${actualGap}min — shifted +${deficit}min`);
              }
            }
          }
        }

        if (bufferFixCount > 0) {
          console.log(`[Stage 4.6] ✓ Fixed ${bufferFixCount} insufficient distance-based buffers across all days`);
        } else {
          console.log(`[Stage 4.6] ✓ All transit buffers are sufficient for actual distances`);
        }
      }

      // =======================================================================
      // STAGE 4.7: Batch Geocode — fill in missing coordinates for route maps
      // Activities with addresses but no lat/lng from Google Places verification
      // =======================================================================
      if (GOOGLE_MAPS_API_KEY) {
        const activitiesToGeocode: { dayIdx: number; actIdx: number; address: string }[] = [];
        for (let di = 0; di < enrichedDays.length; di++) {
          for (let ai = 0; ai < enrichedDays[di].activities.length; ai++) {
            const act = enrichedDays[di].activities[ai];
            if (!act.location?.coordinates && act.location?.address && act.location.address.length > 5) {
              activitiesToGeocode.push({ dayIdx: di, actIdx: ai, address: act.location.address });
            }
          }
        }

        if (activitiesToGeocode.length > 0) {
          console.log(`[Stage 4.7] Batch geocoding ${activitiesToGeocode.length} activities without coordinates`);
          // Process in batches of 5 to respect rate limits
          const GEO_BATCH = 5;
          for (let gi = 0; gi < activitiesToGeocode.length; gi += GEO_BATCH) {
            const batch = activitiesToGeocode.slice(gi, gi + GEO_BATCH);
            const results = await Promise.all(batch.map(async (item) => {
              try {
                const resp = await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(item.address)}&key=${GOOGLE_MAPS_API_KEY}`
                );
                const data = await resp.json();
                const loc = data.results?.[0]?.geometry?.location;
                return loc ? { ...item, lat: loc.lat as number, lng: loc.lng as number } : null;
              } catch {
                return null;
              }
            }));
            for (const r of results) {
              if (r) {
                enrichedDays[r.dayIdx].activities[r.actIdx].location = {
                  ...enrichedDays[r.dayIdx].activities[r.actIdx].location,
                  coordinates: { lat: r.lat, lng: r.lng },
                };
              }
            }
            if (gi + GEO_BATCH < activitiesToGeocode.length) {
              await new Promise(r => setTimeout(r, 200));
            }
          }
          const geocoded = activitiesToGeocode.length;
          const succeeded = enrichedDays.reduce(
            (s, d) => s + d.activities.filter(a => a.location?.coordinates).length, 0
          ) - enrichedDays.reduce(
            (s, d) => s + d.activities.filter(a => a.location?.coordinates && a.verified?.placeId).length, 0
          );
          console.log(`[Stage 4.7] Geocoded ${succeeded}/${geocoded} activities`);
        }
      }

      // =======================================================================
      // STAGE 4.9: Auto Route Optimization — reorder flexible activities
      // by geographic proximity. No API calls, no credits — quality feature.
      // =======================================================================
      try {
        const { autoOptimizeDayRoute } = await import('./auto-route-optimizer.ts');
        for (const day of enrichedDays) {
          day.activities = autoOptimizeDayRoute(day.activities as any[]) as typeof day.activities;
        }
        console.log(`[Stage 4.9] ✓ Auto route optimization applied to ${enrichedDays.length} days`);
      } catch (routeErr) {
        console.warn('[Stage 4.9] Auto route optimization failed (non-blocking):', routeErr);
      }

      // =======================================================================
      // STAGE 4.92: Post-enrichment geographic reorder
      // Re-run geographic validation now that activities have verified GPS coords.
      // Stage 3.5 ran pre-enrichment when most activities lacked coordinates.
      // =======================================================================
      try {
        const { isTimeFixed } = await import('./auto-route-optimizer.ts');
        let reorderCount = 0;
        for (let dayIdx = 0; dayIdx < enrichedDays.length; dayIdx++) {
          const day = enrichedDays[dayIdx];
          if (!day.activities || day.activities.length < 3) continue;

          const activitiesWithLocation = day.activities.map((act: any) => ({
            id: act.id,
            title: act.title || act.name || '',
            coordinates: act.location?.coordinates,
            neighborhood: act.location?.address?.split(',')[0],
            isLocked: isTimeFixed(act),
            category: act.category,
          }));

          const dayAnchor = determineDayAnchor(activitiesWithLocation, undefined, hotelNeighborhood, cityZones);
          const validation = validateDayGeography(activitiesWithLocation, dayAnchor, travelConstraints, cityZones);

          if (!validation.isValid && validation.violations?.some((v: any) => v.type === 'backtracking' || v.type === 'long_hop')) {
            const reordered = reorderActivitiesOptimally(activitiesWithLocation, dayAnchor);
            const reorderedIds = reordered.map((a: any) => a.id);
            // Preserve original time slots, just reorder activities
            const originalTimes = day.activities.map((a: any) => ({ startTime: a.startTime, endTime: a.endTime }));
            day.activities = [...day.activities].sort((a: any, b: any) => {
              const aIdx = reorderedIds.indexOf(a.id);
              const bIdx = reorderedIds.indexOf(b.id);
              return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            });
            // Reassign original time slots to reordered activities
            day.activities.forEach((act: any, i: number) => {
              if (originalTimes[i]) {
                act.startTime = originalTimes[i].startTime;
                act.endTime = originalTimes[i].endTime;
              }
            });
            reorderCount++;
            console.log(`[Stage 4.92] Reordered Day ${dayIdx + 1} activities by geographic proximity (score: ${validation.score})`);
          }
        }
        console.log(`[Stage 4.92] ✓ Post-enrichment geographic reorder: ${reorderCount} days reordered`);
      } catch (geoErr) {
        console.warn('[Stage 4.92] Post-enrichment geographic reorder failed (non-blocking):', geoErr);
      }

      // =======================================================================
      // STAGE 4.93: Name-location cross-check
      // Detect when AI-generated title contains a neighborhood that contradicts
      // the verified Google Places address. E.g. "Ginza Toyoda" at Kagurazaka.
      // =======================================================================
      try {
        const KNOWN_NEIGHBORHOODS = ['ginza','shibuya','shinjuku','asakusa','roppongi',
          'omotesando','ebisu','akihabara','ueno','ikebukuro','sumida','kagurazaka','otemachi',
          'nihonbashi','meguro','daikanyama','nakameguro','azabu','akasaka','harajuku',
          'tsukiji','odaiba','shimokitazawa','yanaka','nezu','sendagi','roppongi','minato',
          'chiyoda','taito','setagaya','nakano','koenji','kichijoji','marunouchi',
          'montmartre','marais','saint-germain','bastille','belleville','pigalle','oberkampf',
          'trastevere','monti','testaccio','prati','esquilino','aventino',
          'soho','shoreditch','mayfair','camden','brixton','notting hill','chelsea',
          'el born','gracia','eixample','raval','barceloneta','gothic quarter',
          'tribeca','williamsburg','dumbo','greenpoint','bushwick','astoria'];
        let nameFixCount = 0;
        for (const day of enrichedDays) {
          for (const act of day.activities as any[]) {
            if (!act.verified?.placeId || !act.location?.address) continue;
            const title = (act.title || '').toLowerCase();
            const address = (act.location.address || '').toLowerCase();
            const titleNeighborhood = KNOWN_NEIGHBORHOODS.find(n => title.includes(n));
            const addressNeighborhood = KNOWN_NEIGHBORHOODS.find(n => address.includes(n));
            if (titleNeighborhood && addressNeighborhood && titleNeighborhood !== addressNeighborhood) {
              const re = new RegExp(`\\b${titleNeighborhood}\\b`, 'gi');
              const oldTitle = act.title;
              act.title = (act.title || '').replace(re, addressNeighborhood.charAt(0).toUpperCase() + addressNeighborhood.slice(1));
              nameFixCount++;
              console.log(`[Stage 4.93] Fixed name-location mismatch: "${oldTitle}" → "${act.title}" (address is in ${addressNeighborhood}, not ${titleNeighborhood})`);
            }
          }
        }
        console.log(`[Stage 4.93] ✓ Name-location cross-check: ${nameFixCount} mismatches fixed`);
      } catch (nameErr) {
        console.warn('[Stage 4.93] Name-location cross-check failed (non-blocking):', nameErr);
      }

      // =======================================================================
      // STAGE 4.95: Transport title consistency
      // Sync transport card destinations with the next non-transport activity's
      // verified location name. Prevents "Metro to Omotesando" → Roppongi.
      // =======================================================================
      try {
        let transportFixCount = 0;
        for (const day of enrichedDays) {
          for (let i = 0; i < day.activities.length; i++) {
            const act = day.activities[i] as any;
            const cat = (act.category || '').toLowerCase();
            if (cat !== 'transport' && cat !== 'transportation' && cat !== 'transit') continue;

            // Find next non-transport activity
            let nextAct: any = null;
            for (let j = i + 1; j < day.activities.length; j++) {
              const nc = ((day.activities[j] as any).category || '').toLowerCase();
              if (nc !== 'transport' && nc !== 'transportation' && nc !== 'transit') {
                nextAct = day.activities[j];
                break;
              }
            }
            if (!nextAct) continue;

            const nextLocationName = nextAct.location?.name || nextAct.title || '';
            if (!nextLocationName) continue;

            // Extract transport mode from current title
            const modeMatch = (act.title || '').match(/^(taxi|metro|walk|train|bus|ferry|uber|rideshare|drive|subway)\s+to\b/i)
              || (act.title || '').match(/^travel\s+to\s+.+\s+via\s+(.+)$/i);

            if (modeMatch) {
              const mode = modeMatch[1] || 'Travel';
              const oldTitle = act.title;
              act.title = `${mode.charAt(0).toUpperCase() + mode.slice(1)} to ${nextLocationName}`;
              if (oldTitle !== act.title) transportFixCount++;
            } else if ((act.title || '').toLowerCase().startsWith('travel to')) {
              const oldTitle = act.title;
              // Check transportation.method for a real mode
              const methodRaw = (act.transportation?.method || '').toLowerCase();
              const knownModes = ['taxi','metro','walk','walking','train','bus','ferry','uber','subway','tram','rideshare','drive','driving'];
              const modeLabel = knownModes.includes(methodRaw)
                ? methodRaw.charAt(0).toUpperCase() + methodRaw.slice(1)
                : null;
              act.title = modeLabel
                ? `${modeLabel} to ${nextLocationName}`
                : `Travel to ${nextLocationName}`;
              if (oldTitle !== act.title) transportFixCount++;
            }

            // Sync transport card's location to destination
            act.location = { ...act.location, name: nextLocationName, address: nextAct.location?.address || act.location?.address || '' };
            if (nextAct.location?.coordinates) {
              act.location.coordinates = nextAct.location.coordinates;
            }

            // Normalize duration format on transport cards
            if (act.transportation?.duration) {
              act.transportation.duration = normalizeDurationString(act.transportation.duration) || act.transportation.duration;
            }
            if (act.duration && typeof act.duration === 'string') {
              act.duration = normalizeDurationString(act.duration) || act.duration;
            }
          }
        }
        console.log(`[Stage 4.95] ✓ Transport title consistency: ${transportFixCount} transport cards synced`);
      } catch (transportErr) {
        console.warn('[Stage 4.95] Transport title consistency failed (non-blocking):', transportErr);
      }

      // STAGE 5: Trip Overview (with enriched data from Stage 1.9)
      const overview = generateTripOverview(enrichedDays, context, {
        travelAdvisory: fetchedTravelAdvisory,
        localEvents: fetchedLocalEvents,
      });

      // Build enrichment metadata from stats or calculate from days
      const totalActivities = enrichmentStats?.totalActivities || enrichedDays.reduce((sum, d) => sum + d.activities.length, 0);
      const photosAdded = enrichmentStats?.photosAdded || enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.photos?.length).length, 0
      );
      const verifiedVenues = enrichmentStats?.venuesVerified || enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.verified?.placeId).length, 0
      );
      const geocodedActivities = enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.location?.coordinates).length, 0
      );

      const enrichedItinerary: EnrichedItinerary = {
        days: enrichedDays,
        overview,
        enrichmentMetadata: {
          enrichedAt: new Date().toISOString(),
          geocodedActivities,
          verifiedActivities: verifiedVenues,
          photosAdded,
          totalActivities,
          ...(enrichmentStats?.enrichmentFailures && enrichmentStats.enrichmentFailures > 0 && {
            failures: enrichmentStats.enrichmentFailures,
            retriedSuccessfully: enrichmentStats.retriedSuccessfully
          })
        }
      };

      // STAGE 6: Final Save
      await finalSaveItinerary(supabase, tripId, enrichedItinerary, context);

      // Return complete response with free tier metadata
      return new Response(
        JSON.stringify({
          success: true,
          status: 'ready',
          tripId,
          totalDays: context.totalDays,
          totalActivities,
          itinerary: {
            days: enrichedDays,
            overview
          },
          enrichmentMetadata: enrichedItinerary.enrichmentMetadata,
          // Hidden gems discovered but not auto-included (for browsable section)
          hiddenGems: discoveredGems.length > 0 ? discoveredGems : undefined,
          // freeTierInfo removed — credit gating handled by client-side generation gate
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

}
