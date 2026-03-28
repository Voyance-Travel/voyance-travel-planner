/**
 * ACTION: generate-trip — Server-side orchestrated day-by-day generation
 * 
 * The frontend calls this ONCE. The edge function sets status='generating',
 * returns immediately, and runs the day loop in the background via self-chaining.
 * Progress is saved to trips.itinerary_data after each day. On completion
 * status becomes 'ready'; on failure status becomes 'failed' and ungenerated
 * day credits are refunded server-side.
 * 
 * Extracted from index.ts to prevent scope-leaking bugs.
 */

import { corsHeaders, type ActionContext, verifyTripAccess } from './action-types.ts';
import { GenerationTimer } from './generation-timer.ts';

// Imported enrichment modules (compute once-per-trip context)
import { loadTravelerProfile } from './profile-loader.ts';
import { buildDietaryEnforcementPrompt } from './dietary-rules.ts';
import { calculateJetLagImpact, buildJetLagPrompt, resolveTimezone } from './jet-lag-calculator.ts';
import { buildWeatherBackupPrompt, determineSeason } from './weather-backup.ts';
import { getTripDurationConfig, calculateDayEnergies, buildTripDurationPrompt, analyzeChildrenAges, buildChildrenAgesPrompt } from './trip-duration-rules.ts';
import { buildReservationUrgencyPrompt } from './reservation-urgency.ts';
import { buildDailyEstimatesPrompt } from './daily-estimates.ts';
import { blendGroupArchetypes, type TravelerArchetype } from './group-archetype-blending.ts';
import { getUserPreferences } from './preference-context.ts';
import {
  deriveForcedSlots,
  deriveScheduleConstraints,
  buildForcedSlotsPrompt,
  buildScheduleConstraintsPrompt,
  type TraitScores,
} from './personalization-enforcer.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

export async function handleGenerateTrip(
  supabase: any,
  userId: string,
  params: Record<string, any>,
): Promise<Response> {
  const { tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, isMultiCity, creditsCharged, requestedDays, resumeFromDay, isFirstTrip } = params;

  if (!tripId || !destination || !startDate || !endDate) {
    return new Response(
      JSON.stringify({ error: "Missing required fields", code: "INVALID_INPUT" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Verify trip access
  const tripAccessResult = await verifyTripAccess(supabase, tripId, userId, true);
  if (!tripAccessResult.allowed) {
    return new Response(
      JSON.stringify({ error: tripAccessResult.reason || "Access denied", code: "FORBIDDEN" }),
      { status: 403, headers: jsonHeaders }
    );
  }

  // ── PERFORMANCE TIMER ──
  const timer = new GenerationTimer(tripId, supabase);

  // Guard: prevent double generation if already in progress (not a resume)
  if (!resumeFromDay) {
    const { data: statusCheck } = await supabase.from('trips').select('itinerary_status, metadata').eq('id', tripId).single();
    if (statusCheck?.itinerary_status === 'generating') {
      const meta = (statusCheck.metadata as Record<string, unknown>) || {};
      const heartbeat = meta.generation_heartbeat ? new Date(meta.generation_heartbeat as string) : null;
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      const isStale = !heartbeat || (Date.now() - heartbeat.getTime() > staleThreshold);
      
      if (!isStale) {
        console.log(`[generate-trip] Trip ${tripId} already generating (heartbeat ${heartbeat?.toISOString()}), skipping duplicate`);
        return new Response(
          JSON.stringify({ success: true, status: 'already_generating', totalDays: (meta.generation_total_days as number) || 0 }),
          { headers: jsonHeaders }
        );
      }
      console.log(`[generate-trip] Trip ${tripId} has stale generation (heartbeat ${heartbeat?.toISOString()}), restarting`);
    }
  }

  // Calculate total days from canonical date span (inclusive end date).
  const sDate = new Date(startDate);
  const eDate = new Date(endDate);
  let totalDays = Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (requestedDays && requestedDays > 0 && requestedDays !== totalDays) {
    console.log(`[generate-trip] Using requestedDays=${requestedDays} (date-based=${totalDays})`);
    totalDays = requestedDays;
  }

  // Log multi-city city-sum for diagnostics only (never override totalDays)
  if (isMultiCity) {
    try {
      const { data: tripCitiesForCount } = await supabase
        .from('trip_cities')
        .select('nights, days_total')
        .eq('trip_id', tripId);
      if (tripCitiesForCount && tripCitiesForCount.length > 0) {
        const sumDays = tripCitiesForCount.reduce((sum: number, c: any) => {
          const dt = (c as any).days_total;
          const n = (c as any).nights;
          return sum + (dt || ((n || 1) + 1));
        }, 0);
        if (sumDays !== totalDays) {
          console.log(`[generate-trip] Multi-city diagnostic: date-based totalDays=${totalDays}, city-days-sum=${sumDays} (using date-based)`);
        }
      }
    } catch (e) {
      console.warn('[generate-trip] Could not query trip_cities for diagnostics:', e);
    }
  }

  // Initialize performance timer
  const totalDaysForTimer = totalDays; // Will be set after calculation
  await timer.init(destination, totalDays, travelers || 1);
  timer.startPhase('pre_chain_setup');

  // Set status to generating + store metadata
  const { data: currentTrip } = await supabase.from('trips').select('metadata, itinerary_data').eq('id', tripId).single();
  const existingMeta = (currentTrip?.metadata as Record<string, unknown>) || {};
  const isResume = resumeFromDay && resumeFromDay > 1;
  
  const generationRunId = crypto.randomUUID();
  
  const updatePayload: Record<string, unknown> = {
    itinerary_status: 'generating',
    metadata: {
      ...existingMeta,
      generation_started_at: new Date().toISOString(),
      generation_total_days: totalDays,
      generation_completed_days: isResume ? (resumeFromDay - 1) : 0,
      generation_error: null,
      generation_heartbeat: new Date().toISOString(),
      generation_run_id: generationRunId,
      chain_broken_at_day: null,
      chain_error: null,
    },
  };
  
  // If starting fresh (not resume), clear existing days to prevent duplicates
  if (!isResume) {
    const existingItData = (currentTrip?.itinerary_data as Record<string, unknown>) || {};
    updatePayload.itinerary_data = { ...existingItData, days: [], status: 'generating' };
    console.log(`[generate-trip] Clearing existing itinerary_data.days for fresh generation`);
    
    // Also clear normalized tables to prevent stale rows
    try {
      const { data: oldDays } = await supabase
        .from('itinerary_days')
        .select('id')
        .eq('trip_id', tripId);
      
      if (oldDays && oldDays.length > 0) {
        const oldDayIds = oldDays.map((d: any) => d.id);
        await supabase.from('itinerary_activities').delete().in('day_id', oldDayIds);
        await supabase.from('itinerary_days').delete().eq('trip_id', tripId);
        console.log(`[generate-trip] Cleared ${oldDays.length} stale itinerary_days rows for fresh generation`);
      }
    } catch (cleanupErr) {
      console.warn('[generate-trip] Failed to clear normalized tables:', cleanupErr);
    }
  }
  
  // =====================================================================
  // PRE-CHAIN ENRICHMENT: Compute once-per-trip context and store in metadata
  // =====================================================================
  if (!isResume) {
   console.log('[generate-trip] Computing generation_context enrichment...');
    timer.startPhase('pre_chain_enrichment');
    const enrichmentContext: Record<string, unknown> = {};
    
    try {
      // 1. Load unified traveler profile
      const tripProfile = await loadTravelerProfile(supabase, userId, tripId, destination);
      enrichmentContext.archetype = tripProfile.archetype;
      enrichmentContext.traitScores = tripProfile.traitScores;
      enrichmentContext.budgetTier = tripProfile.budgetTier || budgetTier || 'moderate';
      enrichmentContext.dietaryRestrictions = tripProfile.dietaryRestrictions;
      enrichmentContext.avoidList = tripProfile.avoidList;
      enrichmentContext.interests = tripProfile.interests;
      enrichmentContext.mobilityNeeds = tripProfile.mobilityNeeds;
      console.log(`[generate-trip] Profile: archetype=${tripProfile.archetype}, completeness=${tripProfile.dataCompleteness}%`);
      
      // 2. Dietary enforcement prompt
      const dietaryPrompt = buildDietaryEnforcementPrompt(tripProfile.dietaryRestrictions);
      if (dietaryPrompt) {
        enrichmentContext.dietaryEnforcementPrompt = dietaryPrompt;
        console.log(`[generate-trip] Dietary enforcement built for ${tripProfile.dietaryRestrictions.length} restrictions`);
      }
      
      // 3. Jet lag assessment
      try {
        const { data: tripRow } = await supabase.from('trips').select('origin_city, flight_selection').eq('id', tripId).single();
        const originCity = tripRow?.origin_city || '';
        if (originCity && destination) {
          const originTz = resolveTimezone(originCity);
          const destTz = resolveTimezone(destination);
          if (originTz && destTz) {
            const jetLagImpact = calculateJetLagImpact(originTz, destTz);
            const jetLagPromptText = buildJetLagPrompt(jetLagImpact);
            if (jetLagPromptText) {
              enrichmentContext.jetLagPrompt = jetLagPromptText;
              console.log(`[generate-trip] Jet lag prompt built: ${jetLagImpact.hoursDifference}h difference`);
            }
          }
        }
      } catch (jlErr) {
        console.warn('[generate-trip] Jet lag calculation failed (non-blocking):', jlErr);
      }
      
      // 4. Weather backup prompt
      try {
        const season = determineSeason(startDate, destination);
        const weatherPrompt = buildWeatherBackupPrompt(destination, season);
        if (weatherPrompt) {
          enrichmentContext.weatherBackupPrompt = weatherPrompt;
          console.log(`[generate-trip] Weather backup prompt built for season: ${season}`);
        }
      } catch (wErr) {
        console.warn('[generate-trip] Weather prompt failed (non-blocking):', wErr);
      }
      
      // 5. Trip duration pacing
      try {
        const durationConfig = getTripDurationConfig(totalDays);
        const energies = calculateDayEnergies(totalDays, durationConfig);
        const durationPrompt = buildTripDurationPrompt(totalDays, durationConfig, energies);
        if (durationPrompt) {
          enrichmentContext.tripDurationPrompt = durationPrompt;
          console.log(`[generate-trip] Trip duration prompt built: ${totalDays} days, pattern=${durationConfig.pacingPattern}`);
        }
      } catch (tdErr) {
        console.warn('[generate-trip] Trip duration prompt failed (non-blocking):', tdErr);
      }
      
      // 6. Children ages
      try {
        const { data: tripForChildren } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
        const tripMeta = (tripForChildren?.metadata as Record<string, unknown>) || {};
        const childrenAges = (tripMeta.childrenAges as number[]) || [];
        if (childrenAges.length > 0) {
          const childrenAnalysis = analyzeChildrenAges(childrenAges);
          const childrenPrompt = buildChildrenAgesPrompt(childrenAnalysis);
          if (childrenPrompt) {
            enrichmentContext.childrenAgesPrompt = childrenPrompt;
            console.log(`[generate-trip] Children ages prompt built for ${childrenAges.length} children`);
          }
        }
      } catch (caErr) {
        console.warn('[generate-trip] Children ages prompt failed (non-blocking):', caErr);
      }
      
      // 7. Reservation urgency
      try {
        const reservationPrompt = buildReservationUrgencyPrompt(destination, startDate);
        if (reservationPrompt) {
          enrichmentContext.reservationUrgencyPrompt = reservationPrompt;
        }
      } catch (ruErr) {
        console.warn('[generate-trip] Reservation urgency failed (non-blocking):', ruErr);
      }
      
      // 8. Daily estimates prompt
      try {
        const dailyEstimatesPrompt = buildDailyEstimatesPrompt(budgetTier || 'standard');
        enrichmentContext.dailyEstimatesPrompt = dailyEstimatesPrompt;
      } catch {}
      
      // 9. Group archetype blending (for trips with collaborators)
      try {
        const [{ data: collabRows }, { data: memberRows }] = await Promise.all([
          supabase.from('trip_collaborators').select('user_id').eq('trip_id', tripId).eq('include_preferences', true),
          supabase.from('trip_members').select('user_id').eq('trip_id', tripId).not('user_id', 'is', null),
        ]);
        const participantIds = new Set<string>();
        (collabRows || []).forEach((c: any) => { if (c.user_id) participantIds.add(c.user_id); });
        (memberRows || []).forEach((m: any) => { if (m.user_id) participantIds.add(m.user_id); });
        participantIds.delete(userId);
        
        if (participantIds.size > 0) {
          const companionUserIds = Array.from(participantIds);
          const { data: companionDnaRows } = await supabase
            .from('travel_dna_profiles')
            .select('user_id, primary_archetype_name, trait_scores, travel_dna_v2')
            .in('user_id', companionUserIds);
          
          const { data: profileRows } = await supabase.from('profiles').select('id, display_name, handle').in('id', [userId, ...companionUserIds]);
          const profileMap = new Map((profileRows || []).map((p: any) => [p.id, p.display_name || p.handle || 'Guest']));
          
          const travelersList: TravelerArchetype[] = [{ travelerId: userId, name: profileMap.get(userId) || 'You', archetype: tripProfile.archetype, isPrimary: true }];
          const companionTraitsList: Record<string, number>[] = [];
          
          for (const dna of (companionDnaRows || [])) {
            const archetype = dna.primary_archetype_name || (dna.travel_dna_v2 as any)?.primary_archetype_name || 'balanced_story_collector';
            travelersList.push({ travelerId: dna.user_id, name: profileMap.get(dna.user_id) || 'Guest', archetype, isPrimary: false });
            const rawScores = dna.trait_scores || (dna.travel_dna_v2 as any)?.trait_scores || {};
            companionTraitsList.push({
              pace: Number(rawScores.pace ?? 0), budget: Number(rawScores.budget ?? 0),
              social: Number(rawScores.social ?? 0), planning: Number(rawScores.planning ?? 0),
              comfort: Number(rawScores.comfort ?? 0), authenticity: Number(rawScores.authenticity ?? 0),
              adventure: Number(rawScores.adventure ?? 0), cultural: Number(rawScores.cultural ?? 0),
            });
          }
          
          if (travelersList.length > 1) {
            const blendResult = await blendGroupArchetypes(travelersList, totalDays, destination);
            enrichmentContext.groupBlendingPrompt = blendResult.promptSection;
            
            const ownerWeight = 0.5;
            const companionWeight = companionTraitsList.length > 0 ? 0.5 / companionTraitsList.length : 0;
            const blendedTraits: Record<string, number> = {};
            const traitKeys = ['pace', 'budget', 'social', 'planning', 'comfort', 'authenticity', 'adventure', 'cultural'];
            for (const key of traitKeys) {
              const ownerVal = (tripProfile.traitScores as any)[key] || 0;
              const companionSum = companionTraitsList.reduce((sum, ct) => sum + (ct[key] || 0) * companionWeight, 0);
              blendedTraits[key] = Math.round(ownerVal * ownerWeight + companionSum);
            }
            enrichmentContext.blendedTraitScores = blendedTraits;
            enrichmentContext.blendedDnaSnapshot = {
              blendedTraits,
              travelers: travelersList.map(t => ({ userId: t.travelerId, name: t.name, archetype: t.archetype, weight: t.isPrimary ? ownerWeight : companionWeight, isPrimary: t.isPrimary })),
              blendMethod: 'weighted_average',
              generatedAt: new Date().toISOString(),
            };
            
            console.log(`[generate-trip] Group blending complete: ${travelersList.length} travelers`);
          }
        }
      } catch (gbErr) {
        console.warn('[generate-trip] Group blending failed (non-blocking):', gbErr);
      }
      
      // 10. Past trip learnings
      try {
        const { data: learnings } = await supabase
          .from('trip_learnings')
          .select('destination, highlights, pain_points, pacing_feedback, discovered_likes, discovered_dislikes, lessons_summary')
          .eq('user_id', userId)
          .not('lessons_summary', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(3);
        
        if (learnings && learnings.length > 0) {
          const sections: string[] = [];
          for (const l of learnings) {
            const parts: string[] = [];
            if (l.destination) parts.push(`Past trip to ${l.destination}:`);
            const highlights = l.highlights as Array<{ activity?: string; why?: string }> | null;
            if (highlights?.length) parts.push(`  ✓ Loved: ${highlights.slice(0, 2).map((h: any) => `${h.activity || ''} (${h.why || ''})`).join(', ')}`);
            const painPoints = l.pain_points as Array<{ issue?: string; solution?: string }> | null;
            if (painPoints?.length) parts.push(`  ✗ Avoid: ${painPoints.slice(0, 2).map((p: any) => `${p.issue || ''}${p.solution ? ` → ${p.solution}` : ''}`).join('; ')}`);
            if (l.lessons_summary) parts.push(`  📝 Key insight: ${l.lessons_summary}`);
            if (parts.length > 1) sections.push(parts.join('\n'));
          }
          if (sections.length > 0) {
            enrichmentContext.pastTripLearnings = `\n## 🔄 LEARNINGS FROM PAST TRIPS\n${sections.join('\n\n')}\n`;
            console.log(`[generate-trip] Loaded ${learnings.length} past trip learnings`);
          }
        }
      } catch (ptErr) {
        console.warn('[generate-trip] Past trip learnings failed (non-blocking):', ptErr);
      }
      
      // 11. Recently used activities for variety
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const destLower = destination.toLowerCase();
        const { data: recentTrips } = await supabase
          .from('trips')
          .select('destination, itinerary_data')
          .neq('id', tripId)
          .gte('created_at', thirtyDaysAgo)
          .not('itinerary_data', 'is', null)
          .limit(10);
        
        if (recentTrips?.length) {
          const names: string[] = [];
          for (const trip of recentTrips) {
            const tripDest = (trip.destination || '').toLowerCase();
            if (tripDest.includes(destLower) || destLower.includes(tripDest)) {
              const itData = trip.itinerary_data as any;
              for (const day of (itData?.days || [])) {
                for (const act of (day.activities || [])) {
                  const n = act.title || act.name;
                  if (n && !names.includes(n)) names.push(n);
                }
              }
            }
          }
          if (names.length > 0) {
            enrichmentContext.recentlyUsedActivities = names.slice(0, 20);
            console.log(`[generate-trip] Found ${Math.min(names.length, 20)} recently used activities to avoid`);
          }
        }
      } catch (ruErr) {
        console.warn('[generate-trip] Recently used activities failed (non-blocking):', ruErr);
      }
      
      // 12. Forced personalization slots
      try {
        const userPrefsForSlots = userId ? await getUserPreferences(supabase, userId) : null;
        const slotTraits: Partial<TraitScores> = {
          planning: tripProfile.traitScores.planning ?? 0,
          social: tripProfile.traitScores.social ?? 0,
          comfort: tripProfile.traitScores.comfort ?? 0,
          pace: tripProfile.traitScores.pace ?? 0,
          authenticity: tripProfile.traitScores.authenticity ?? 0,
          adventure: tripProfile.traitScores.adventure ?? 0,
          budget: tripProfile.traitScores.budget ?? 0,
          transformation: 0,
        };
        const slotContext = {
          tripType: tripType || 'vacation',
          travelCompanions: userPrefsForSlots?.travel_companions || [],
          hasChildren: (travelers || 1) > 2,
          primaryArchetype: tripProfile.archetype,
          secondaryArchetype: undefined,
          celebrationDay: undefined,
          travelerCount: travelers || 1,
        };
        const forcedSlots = deriveForcedSlots(slotTraits, tripProfile.interests, 1, totalDays, slotContext);
        if (forcedSlots.length > 0) {
          enrichmentContext.forcedSlotsPrompt = buildForcedSlotsPrompt(forcedSlots);
          console.log(`[generate-trip] ${forcedSlots.length} forced slots computed`);
        }
        
        const scheduleConstraints = deriveScheduleConstraints(slotTraits, tripProfile.mobilityNeeds);
        enrichmentContext.scheduleConstraintsPrompt = buildScheduleConstraintsPrompt(scheduleConstraints);
      } catch (fsErr) {
        console.warn('[generate-trip] Forced slots failed (non-blocking):', fsErr);
      }
      
      // Store blended DNA snapshot on trip record
      if (enrichmentContext.blendedDnaSnapshot) {
        try {
          await supabase.from('trips').update({ blended_dna_snapshot: enrichmentContext.blendedDnaSnapshot }).eq('id', tripId);
        } catch {}
      }
      
      console.log(`[generate-trip] Enrichment context computed with ${Object.keys(enrichmentContext).length} fields`);
      timer.endPhase('pre_chain_enrichment');
    } catch (enrichErr) {
      console.warn('[generate-trip] Enrichment context computation failed (non-blocking):', enrichErr);
      timer.addError('pre_chain_enrichment', String(enrichErr));
    }
    
    // Store generation_context in the update payload
    (updatePayload.metadata as Record<string, unknown>).generation_context = enrichmentContext;
  }
  
  await supabase.from('trips').update(updatePayload).eq('id', tripId);

  // Determine starting day (for resume support)
  const effectiveStartDay = resumeFromDay && resumeFromDay > 1 ? resumeFromDay : 1;

  // Fire the first day generation via self-chain (non-blocking)
  const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-itinerary`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  timer.endPhase('pre_chain_setup');
  await timer.updateProgress('Launching day generation', 5);

  const initialChainBody = JSON.stringify({
    action: 'generate-trip-day',
    tripId,
    destination,
    destinationCountry,
    startDate,
    endDate,
    travelers: travelers || 1,
    tripType: tripType || 'vacation',
    budgetTier: budgetTier || 'moderate',
    userId,
    isMultiCity: isMultiCity || false,
    creditsCharged: creditsCharged || 0,
    requestedDays: requestedDays || totalDays,
    dayNumber: effectiveStartDay,
    totalDays,
    generationRunId,
    isFirstTrip: isFirstTrip || false,
    generationLogId: timer.getLogId(),
  });

  // Retry loop with exponential backoff for intermittent 403 errors
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: initialChainBody,
      });
      if (response.ok) break;
      const respText = await response.text().catch(() => '(no body)');
      console.error(`[generate-trip] Initial chain attempt ${attempt}/${maxRetries} returned ${response.status}: ${respText.slice(0, 200)}`);
      if (response.status >= 400 && response.status < 500) {
        console.error(`[generate-trip] Client error ${response.status} — not retrying`);
        break;
      }
    } catch (err) {
      console.error(`[generate-trip] Initial chain attempt ${attempt}/${maxRetries} error:`, err);
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }

  // Return immediately — generation continues server-side via self-chaining
  return new Response(
    JSON.stringify({ success: true, status: 'generating', totalDays }),
    { headers: jsonHeaders }
  );
}
