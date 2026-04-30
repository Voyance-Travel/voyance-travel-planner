/**
 * Enrich Manual Trip — Smart Finish via Full Generation (ASYNC)
 *
 * When a user purchases Smart Finish on a manually-built itinerary, this function:
 * 1. Reads the user's parsed research/activities from the existing itinerary_data
 * 2. Converts them into a "mustDoActivities" research context string
 * 3. Writes that context into trips.metadata so generate-itinerary can use it
 * 4. Kicks off generate-itinerary in the BACKGROUND (fire-and-forget)
 * 5. Returns immediately so the client never times out
 *
 * The client polls trips.metadata.smartFinishCompleted to know when it's done.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Convert parsed itinerary activities into a compact research string
 * that can be injected as mustDoActivities into generate-itinerary's prompt
 */
function buildResearchContext(itinerary: any): string {
  if (!itinerary?.days?.length) return "";

  const lines: string[] = [];

  if (itinerary.preferences) {
    const prefs = itinerary.preferences;
    if (prefs.rawPreferenceText) {
      lines.push(`USER'S ORIGINAL PREFERENCES:\n"${prefs.rawPreferenceText}"\n`);
    } else {
      const parts: string[] = [];
      if (prefs.focus?.length) parts.push(`Focus: ${prefs.focus.join(", ")}`);
      if (prefs.avoid?.length) parts.push(`Avoid: ${prefs.avoid.join(", ")}`);
      if (prefs.dietary?.length) parts.push(`Dietary: ${prefs.dietary.join(", ")}`);
      if (prefs.pace) parts.push(`Pace: ${prefs.pace}`);
      if (prefs.budget) parts.push(`Budget: ${prefs.budget}`);
      if (parts.length) lines.push(`USER PREFERENCES: ${parts.join(" | ")}\n`);
    }
  }

  if (itinerary.tripVibe) {
    lines.push(`TRIP VIBE/INTENT: ${itinerary.tripVibe}`);
  }
  if (itinerary.tripPriorities?.length) {
    lines.push(`TRIP PRIORITIES: ${itinerary.tripPriorities.join(", ")}`);
  }

  lines.push("");
  lines.push("SMART_FINISH_SOURCE_NOTES:");
  lines.push("Use the user's researched venues below as hard anchors.");
  lines.push("Keep all user-provided anchors, then expand with DNA-matched additions, transit, meals, and exact HH:MM times.");
  lines.push("");

  lines.push("USER'S RESEARCHED PLACES & ACTIVITIES (incorporate ALL of these, then EXPAND with additional DNA-matched activities):");

  for (const day of itinerary.days) {
    const dayNum = day.dayNumber || day.day;
    if (dayNum) lines.push(`\n  Day ${dayNum}:`);

    const dayActivities = day.activities || [];
    const daySeen = new Set<string>();

    for (const activity of dayActivities) {
      const name = activity.title || activity.name || "";
      if (!name) continue;

      // Skip pure cost/price annotations (e.g. "€16pp", "~€45pp", "$25/person")
      if (/^[~≈]?\s*[€$£¥₹]?\s*\d+[\d.,]*\s*(?:\/?\s*(?:pp|person|pax|each|per\s*person))?\s*[€$£¥₹]?\s*$/i.test(name.trim())) continue;

      // Skip generic category placeholders (not specific venues)
      const genericTitles = ['dinner at a restaurant', 'lunch at a restaurant', 'breakfast at a café', 'breakfast at a cafe'];
      if (genericTitles.includes(name.trim().toLowerCase())) continue;

      const normalizedName = name.toLowerCase().trim();
      if (daySeen.has(normalizedName)) continue;
      daySeen.add(normalizedName);

      const parts: string[] = [`  - ${name}`];
      if (activity.category) parts.push(`(${activity.category})`);
      if (activity.startTime || activity.start_time) {
        parts.push(`at ${activity.startTime || activity.start_time}`);
      }
      if (activity.location?.name || activity.location?.address || activity.address) {
        const loc = activity.location?.name || activity.location?.address || activity.address;
        parts.push(`@ ${loc}`);
      }
      if (activity.notes || activity.description) {
        const note = typeof activity.notes === 'string' ? activity.notes
          : typeof activity.description === 'string' ? activity.description : null;
        if (note && note.length < 200) parts.push(`— ${note}`);
      }
      if (activity.bookingUrl || activity.booking_url) {
        parts.push(`[link: ${activity.bookingUrl || activity.booking_url}]`);
      }
      lines.push(parts.join(" "));
    }
  }

  if (Array.isArray(itinerary.practicalTips) && itinerary.practicalTips.length > 0) {
    lines.push(`\nPRACTICAL TIPS FROM USER'S RESEARCH:\n${itinerary.practicalTips.slice(0, 5).map((t: any) => `- ${String(t)}`).join("\n")}`);
  }

  const accNotes = Array.isArray(itinerary.accommodationNotes) ? itinerary.accommodationNotes
    : Array.isArray(itinerary.metadata?.accommodationNotes) ? itinerary.metadata.accommodationNotes : null;
  if (accNotes && accNotes.length > 0) {
    lines.push(`\nACCOMMODATION NOTES:\n${accNotes.slice(0, 5).map((n: any) => `- ${String(n)}`).join("\n")}`);
  }

  return lines.join("\n");
}

/**
 * After a gateway timeout, generation may still complete in the backend.
 * Reconcile by polling the trip row for a fresh ready itinerary.
 */
async function waitForGenerationCompletionAfterTimeout(
  supabase: any,
  tripId: string,
  baselineTripUpdatedAt?: string | null,
): Promise<boolean> {
  const MAX_CHECKS = 60;
  const INTERVAL_MS = 5000;
  const baselineTs = baselineTripUpdatedAt ? Date.parse(baselineTripUpdatedAt) : 0;

  for (let i = 1; i <= MAX_CHECKS; i++) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));

    const { data, error } = await supabase
      .from("trips")
      .select("itinerary_status, itinerary_data, updated_at")
      .eq("id", tripId)
      .maybeSingle();

    if (error || !data) continue;

    const updatedTs = data.updated_at ? Date.parse(data.updated_at as string) : 0;
    const hasFreshUpdate = baselineTs ? updatedTs > baselineTs : true;
    const status = String(data.itinerary_status || "").toLowerCase();

    const itinerary = data.itinerary_data as any;
    const days = itinerary?.days || itinerary?.itinerary?.days || [];
    const hasDays = Array.isArray(days) && days.length > 0;

    if (hasFreshUpdate && (status === "ready" || status === "completed") && hasDays) {
      console.log(`[enrich-manual-trip:bg] Recovered after timeout: itinerary became ready (check ${i}/${MAX_CHECKS})`);
      return true;
    }
  }

  return false;
}

/**
 * Background generation task.
 * Runs AFTER the HTTP response has been sent to the client.
 */
async function runGenerationInBackground(
  supabaseUrl: string,
  supabaseServiceKey: string,
  authHeader: string,
  tripId: string,
  userId: string,
  updatedMetadata: any,
  pendingChargeId: string | null,
  baselineTripUpdatedAt?: string | null,
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[enrich-manual-trip:bg] Starting generate-itinerary for trip ${tripId}`);

    // Pre-set itinerary_status to 'generating' so the chain doesn't get interrupted
    const { error: statusErr } = await supabase
      .from("trips")
      .update({ itinerary_status: "generating" })
      .eq("id", tripId);
    if (statusErr) {
      console.warn(`[enrich-manual-trip:bg] Failed to pre-set itinerary_status:`, statusErr.message);
    }

    // Fetch trip data — needed for generate-itinerary request body
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city")
      .eq("id", tripId)
      .maybeSingle();

    if (tripErr || !trip) {
      throw new Error(`Failed to fetch trip for background generation: ${tripErr?.message || 'not found'}`);
    }

    let generateData: any = null;

    const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-itinerary`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({
        action: "generate-trip",
        tripId,
        destination: trip.destination,
        destinationCountry: (trip as any).destination_country || "",
        startDate: trip.start_date,
        endDate: trip.end_date,
        travelers: (trip as any).travelers || 1,
        tripType: (trip as any).trip_type || "vacation",
        budgetTier: (trip as any).budget_tier || "moderate",
        isMultiCity: (trip as any).is_multi_city || false,
        creditsCharged: 0,
      }),
    });

    if (!generateResponse.ok) {
      const errText = await generateResponse.text();
      console.error(`[enrich-manual-trip:bg] generate-itinerary returned ${generateResponse.status}: ${errText}`);

      // Try to extract the actual error message from the response body
      let detailedError = `Generation failed: ${generateResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error) detailedError = errJson.error;
        else if (errJson.message) detailedError = errJson.message;
      } catch {
        // If not JSON, use truncated text
        if (errText && errText.length > 0) {
          detailedError = errText.length > 300 ? errText.substring(0, 300) + '…' : errText;
        }
      }

      const isGatewayTimeout = [408, 504, 524].includes(generateResponse.status);
      if (isGatewayTimeout) {
        console.warn(`[enrich-manual-trip:bg] Timeout status ${generateResponse.status} — checking if generation completed anyway...`);
        const recovered = await waitForGenerationCompletionAfterTimeout(
          supabase,
          tripId,
          baselineTripUpdatedAt,
        );

        if (recovered) {
          generateData = {
            success: true,
            recoveredFromTimeout: true,
            totalDays: 0,
            totalActivities: 0,
          };
        } else {
          throw new Error(detailedError);
        }
      } else {
        throw new Error(detailedError);
      }
    }

    if (!generateData) {
      generateData = await generateResponse.json();

      if (!generateData.success) {
        const errMsg = generateData.error || "Generation returned failure status";
        console.error(`[enrich-manual-trip:bg] generate-itinerary failed:`, errMsg);
        throw new Error(errMsg);
      }
    }

    console.log(`[enrich-manual-trip:bg] ✓ Smart Finish complete: ${generateData.totalDays} days, ${generateData.totalActivities} activities`);

    // --- Post-generation quality check ---
    // Re-fetch the saved itinerary and validate Smart Finish quality
    const { data: savedTrip } = await supabase
      .from("trips")
      .select("itinerary_data, start_date, end_date")
      .eq("id", tripId)
      .single();

    const savedItinerary = savedTrip?.itinerary_data;
    const savedDays = savedItinerary?.days || savedItinerary?.itinerary?.days || [];
    const generatedActivityCount = Array.isArray(savedDays)
      ? savedDays.reduce((sum: number, day: any) => sum + ((day?.activities?.length as number) || 0), 0)
      : 0;
    const SLOT_LABELS = /^(morning|afternoon|evening|dinner|lunch|breakfast|night|brunch|midday)$/i;
    const HH_MM = /^\d{1,2}:\d{2}/;

    let qualityPass = true;
    const qualityIssues: string[] = [];

    // Check 1: Days exist
    if (!Array.isArray(savedDays) || savedDays.length === 0) {
      qualityPass = false;
      qualityIssues.push("No days generated");
    } else {
      for (const day of savedDays) {
        const dayNum = day.dayNumber || day.day || "?";
        const acts = day.activities || [];

        // Check 2: Minimum activity count (6 for first/last, 8 for middle)
        const isEdgeDay = dayNum === 1 || dayNum === savedDays.length;
        const minActs = isEdgeDay ? 6 : 8;
        if (acts.length < minActs) {
          qualityIssues.push(`Day ${dayNum}: only ${acts.length} activities (need ${minActs}+)`);
        }

        // Check 3: No unresolved slot labels in times
        for (const act of acts) {
          const time = act.startTime || act.start_time || act.time || "";
          if (SLOT_LABELS.test(time.trim()) || (time && !HH_MM.test(time.trim()))) {
            qualityPass = false;
            qualityIssues.push(`Day ${dayNum}: "${act.title || act.name}" has non-HH:MM time "${time}"`);
          }
        }
      }
    }

    // Check 4: accommodationNotes / practicalTips present
    const hasAccNotes = Array.isArray(savedItinerary?.accommodationNotes) && savedItinerary.accommodationNotes.length > 0;
    const hasTips = Array.isArray(savedItinerary?.practicalTips) && savedItinerary.practicalTips.length > 0;
    if (!hasAccNotes) qualityIssues.push("Missing accommodationNotes");
    if (!hasTips) qualityIssues.push("Missing practicalTips");

    if (qualityIssues.length > 0) {
      console.warn(`[enrich-manual-trip:bg] Quality issues: ${qualityIssues.join("; ")}`);
    }

    if (!qualityPass) {
      console.error(`[enrich-manual-trip:bg] ❌ Smart Finish FAILED quality gate: ${qualityIssues.join("; ")}`);
      throw new Error(`Quality gate failed: ${qualityIssues.slice(0, 3).join("; ")}`);
    }

    console.log(`[enrich-manual-trip:bg] ✓ Quality gate passed (${qualityIssues.length} minor warnings)`);

    // Mark completion in metadata
    const completedMeta = {
      ...updatedMetadata,
      smartFinishCompleted: true,
      smartFinishCompletedAt: new Date().toISOString(),
      smartFinishTotalActivities: generateData.totalActivities || generatedActivityCount || 0,
      smartFinishStatus: "success",
      smartFinishQualityWarnings: qualityIssues.length > 0 ? qualityIssues : undefined,
    };
    const { error: metaSuccessErr } = await supabase
      .from("trips")
      .update({
        metadata: completedMeta,
        smart_finish_purchased: true,
        creation_source: "smart_finish",
      })
      .eq("id", tripId);

    if (metaSuccessErr) {
      console.error(`[enrich-manual-trip:bg] Failed to write success metadata:`, metaSuccessErr);
    }

    // Mark pending charge as completed
    if (pendingChargeId) {
      const { error: pcErr } = await supabase
        .from("pending_credit_charges")
        .update({
          status: "completed",
          resolved_at: new Date().toISOString(),
          resolution_note: generateData?.recoveredFromTimeout
            ? "Smart Finish succeeded (recovered after gateway timeout)"
            : "Smart Finish succeeded",
        })
        .eq("id", pendingChargeId);

      if (pcErr) {
        console.error(`[enrich-manual-trip:bg] Failed to mark pending charge ${pendingChargeId} as completed:`, pcErr);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[enrich-manual-trip:bg] Background generation FAILED:`, msg);

    // Create a user-safe error message (truncate internal details)
    const userSafeError = msg.length > 200 ? msg.substring(0, 200) + '…' : msg;

    // Mark failure in metadata so client can detect it
    const failedMeta = {
      ...updatedMetadata,
      smartFinishCompleted: false,
      smartFinishFailed: true,
      smartFinishFailedAt: new Date().toISOString(),
      smartFinishError: userSafeError,
      smartFinishErrorFull: msg.substring(0, 1000), // full diagnostic (truncated)
      smartFinishStatus: "failed",
    };
    const { error: metaFailErr } = await supabase
      .from("trips")
      .update({ metadata: failedMeta })
      .eq("id", tripId);

    if (metaFailErr) {
      console.error(`[enrich-manual-trip:bg] CRITICAL: Failed to write failure metadata:`, metaFailErr);
    }

    // Mark pending charge as failed
    if (pendingChargeId) {
      const { error: pcFailErr } = await supabase
        .from("pending_credit_charges")
        .update({ status: "failed", resolved_at: new Date().toISOString(), resolution_note: `Smart Finish failed: ${userSafeError}` })
        .eq("id", pendingChargeId);

      if (pcFailErr) {
        console.error(`[enrich-manual-trip:bg] Failed to mark pending charge ${pendingChargeId} as failed:`, pcFailErr);
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { tripId } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // --- Load trip ---
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, itinerary_data, destination, destination_country, user_id, start_date, end_date, metadata, smart_finish_purchased, creation_source, updated_at, travelers, trip_type, budget_tier, is_multi_city")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");
    if (trip.user_id !== user.id) throw new Error("Not your trip");

    // Guard: if Smart Finish already successfully completed, do not re-run generation.
    const meta = (trip.metadata as any) || {};
    if (meta.smartFinishCompleted === true) {
      console.log(`[enrich-manual-trip] Smart Finish already completed for trip ${tripId} — skipping.`);
      return new Response(JSON.stringify({
        success: true,
        alreadyCompleted: true,
        status: "completed",
        totalDays: 0,
        totalActivities: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itinerary = trip.itinerary_data as any;
    if (!itinerary?.days) throw new Error("No itinerary data to base generation on");

    // --- Record pending charge for server-side safety net ---
    let pendingChargeId: string | null = null;
    try {
      const { data: pendingRow } = await supabase
        .from("pending_credit_charges")
        .insert({
          user_id: user.id,
          trip_id: tripId,
          action: "SMART_FINISH",
          credits_amount: 50,
          status: "pending",
        })
        .select("id")
        .single();
      pendingChargeId = pendingRow?.id ?? null;
      console.log(`[enrich-manual-trip] Pending charge recorded: ${pendingChargeId}`);
    } catch (pcErr) {
      console.warn("[enrich-manual-trip] Failed to record pending charge (non-fatal):", pcErr);
    }

    console.log(`[enrich-manual-trip] Starting Smart Finish for trip ${tripId} (${trip.destination})`);

    // --- Ensure Travel DNA traits are non-zero before generation ---
    try {
      const { data: dnaRow } = await supabase
        .from("travel_dna_profiles")
        .select("trait_scores")
        .eq("user_id", user.id)
        .maybeSingle();

      const traits = (dnaRow?.trait_scores as Record<string, number>) || {};
      const allZero = Object.values(traits).every(v => v === 0);

      if (!dnaRow || allZero) {
        console.log(`[enrich-manual-trip] DNA traits missing or all zeros — triggering recalculation`);
        const recalcResp = await fetch(`${supabaseUrl}/functions/v1/calculate-travel-dna`, {
          method: "POST",
          headers: {
            "Authorization": authHeader!,
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          },
          body: JSON.stringify({ userId: user.id }),
        });
        if (recalcResp.ok) {
          console.log(`[enrich-manual-trip] ✓ DNA recalculated successfully`);
        } else {
          console.warn(`[enrich-manual-trip] DNA recalc returned ${recalcResp.status} (non-fatal)`);
        }
      } else {
        console.log(`[enrich-manual-trip] DNA traits look healthy, skipping recalc`);
      }
    } catch (dnaErr) {
      console.warn("[enrich-manual-trip] DNA pre-check failed (non-fatal):", dnaErr);
    }

    // --- Build user research context from parsed activities ---
    const researchContext = buildResearchContext(itinerary);
    console.log(`[enrich-manual-trip] Research context built: ${researchContext.length} chars, ${itinerary.days.length} days`);

    // --- Build structured userAnchors so generate-itinerary's anchor guard
    //     treats every parsed activity as a hard invariant (not just prompt
    //     context the AI can drift from). Mirrors createTripFromParsed.ts. ---
    const derivedAnchors: Array<Record<string, any>> = [];
    const seenAnchorKeys = new Set<string>();
    const existingAnchors = Array.isArray((trip.metadata as any)?.userAnchors)
      ? ((trip.metadata as any).userAnchors as Array<Record<string, any>>)
      : [];
    for (const a of existingAnchors) {
      const key = `${a.dayNumber}|${a.lockedSource || ''}|${(a.title || '').toLowerCase().trim()}`;
      if (!seenAnchorKeys.has(key)) {
        seenAnchorKeys.add(key);
        derivedAnchors.push(a);
      }
    }
    for (const day of (itinerary.days || [])) {
      const dayNumber = day?.dayNumber || day?.day;
      if (!dayNumber) continue;
      for (const act of (day?.activities || [])) {
        if (act?.isOption && act?.optionGroup) continue;
        const title = (act?.title || act?.name || '').toString().trim();
        if (!title) continue;
        // Skip pure cost/price annotations and generic placeholders
        if (/^[~≈]?\s*[€$£¥₹]?\s*\d+[\d.,]*\s*(?:\/?\s*(?:pp|person|pax|each|per\s*person))?\s*[€$£¥₹]?\s*$/i.test(title)) continue;
        const lockedSource = act?.lockedSource || `manual_paste:${title}`;
        const key = `${dayNumber}|${lockedSource}|${title.toLowerCase()}`;
        if (seenAnchorKeys.has(key)) continue;
        seenAnchorKeys.add(key);
        derivedAnchors.push({
          dayNumber,
          title,
          startTime: act?.startTime || act?.start_time || undefined,
          endTime: act?.endTime || act?.end_time || undefined,
          category: act?.category || 'activity',
          venueName: act?.location?.name || act?.venue_name || undefined,
          lockedSource,
          source: act?.anchorSource || 'manual_paste',
        });
      }
    }
    console.log(`[enrich-manual-trip] Built ${derivedAnchors.length} userAnchors for Smart Finish protection`);

    // ─── Mirror anchors into structured `trip_day_intents` (idempotent) ───
    // Smart Finish runs single-day regen, which won't re-seed from metadata
    // until generation actually starts. Writing intents here ensures the
    // Day Brief picks them up on the very first regen pass.
    try {
      if (derivedAnchors.length > 0) {
        const { intentsFromUserAnchors } = await import('../_shared/intent-normalizers.ts');
        const { upsertDayIntents } = await import('../_shared/day-intents-store.ts');
        const anchorIntents = intentsFromUserAnchors(derivedAnchors);
        if (anchorIntents.length > 0) {
          await upsertDayIntents(supabase, trip.id, trip.user_id || null, anchorIntents);
          console.log(`[enrich-manual-trip] Mirrored ${anchorIntents.length} anchors into trip_day_intents`);
        }
      }
    } catch (intentErr) {
      console.warn('[enrich-manual-trip] trip_day_intents mirror failed (non-blocking):', intentErr);
    }

    // --- Write research context + anchors into trip metadata so generate-itinerary picks them up ---
    const existingMetadata = (trip.metadata as any) || {};
    const updatedMetadata = {
      ...existingMetadata,
      mustDoActivities: researchContext,
      userAnchors: derivedAnchors,
      smartFinishSource: "manual_builder_standard",
      smartFinishMode: true, // Explicit boolean — generate-itinerary uses this as primary detection
      smartFinishRequestedAt: new Date().toISOString(),
      smartFinishStatus: "generating", // <-- client polls this
      smartFinishFailed: false,
      smartFinishError: null,
      accommodationNotes: itinerary.metadata?.accommodationNotes || itinerary.accommodationNotes || existingMetadata.accommodationNotes || [],
      practicalTips: itinerary.metadata?.practicalTips || itinerary.practicalTips || existingMetadata.practicalTips || [],
      tripVibe: itinerary.tripVibe || existingMetadata.tripVibe || null,
      tripPriorities: itinerary.tripPriorities || existingMetadata.tripPriorities || [],
    };

    const { error: metaUpdateError } = await supabase
      .from("trips")
      .update({
        metadata: updatedMetadata,
        smart_finish_purchased: true,
        smart_finish_purchased_at: new Date().toISOString(),
      })
      .eq("id", tripId);

    if (metaUpdateError) {
      throw new Error(`Failed to write research context: ${metaUpdateError.message}`);
    }

    console.log(`[enrich-manual-trip] Metadata written. Kicking off background generation and returning immediately.`);

    // --- Fire-and-forget: run generation in background ---
    // EdgeRuntime.waitUntil keeps the isolate alive after we return the response.
    const bgPromise = runGenerationInBackground(
      supabaseUrl,
      supabaseServiceKey,
      authHeader,
      tripId,
      user.id,
      updatedMetadata,
      pendingChargeId,
      trip.updated_at,
    );

    // Use waitUntil if available (Supabase Edge Runtime), otherwise just fire-and-forget
    if (typeof (globalThis as any).EdgeRuntime !== "undefined" && (globalThis as any).EdgeRuntime.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(bgPromise);
    } else {
      // Fallback: just let the promise run (function stays alive until it completes or times out)
      bgPromise.catch(err => console.error("[enrich-manual-trip] bg fallback error:", err));
    }

    // --- Return immediately ---
    return new Response(JSON.stringify({
      success: true,
      status: "generating",
      message: "Smart Finish is generating your itinerary. This may take a minute or two.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[enrich-manual-trip] Error:", msg);
    const status = msg.includes("Not authenticated") ? 401
      : msg.includes("required") || msg.includes("not found") || msg.includes("Not your trip") ? 400
      : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
