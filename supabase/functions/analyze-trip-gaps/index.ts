/**
 * Analyze Trip Gaps — Free DNA gap analysis teaser
 * 
 * Compares a user's manually-built itinerary against their Travel DNA
 * to surface specific mismatches (pacing, meals, crowds, wellness, weather).
 * 
 * Returns gap count + vague hints (FREE), detailed fixes gated behind Smart Finish.
 * Cost: ~$0.02–0.05/call
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { tripId } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // 1. Load trip data
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("itinerary_data, destination, start_date, end_date, trip_type, budget_tier, gap_analysis_result")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");

    // Return cached result if available and less than 1 hour old
    if (trip.gap_analysis_result) {
      const cached = trip.gap_analysis_result as any;
      if (cached.analyzedAt) {
        const age = Date.now() - new Date(cached.analyzedAt).getTime();
        if (age < 3600000) { // 1 hour
          return new Response(JSON.stringify(cached), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // 2. Load user's Travel DNA
    const { data: profile } = await supabase
      .from("profiles")
      .select("travel_dna, travel_dna_overrides")
      .eq("id", user.id)
      .single();

    const dna = profile?.travel_dna as any;
    const itinerary = trip.itinerary_data as any;

    if (!itinerary?.days || !dna) {
      return new Response(JSON.stringify({
        gapCount: 0,
        gaps: [],
        message: "We need your Travel DNA and itinerary to analyze gaps.",
        analyzedAt: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Algorithmic gap detection (no AI needed for basic checks)
    const gaps: Array<{ hint: string; severity: "warning" | "info"; category: string }> = [];
    const days = itinerary.days || [];

    // Extract DNA traits
    const traits = dna.traits || dna.traitScores || {};
    const paceScore = traits.pace ?? traits.paceScore ?? 5;
    const socialScore = traits.social ?? traits.socialScore ?? 5;
    const comfortScore = traits.comfort ?? traits.comfortScore ?? 5;
    const spontaneityScore = traits.spontaneity ?? traits.spontaneityScore ?? 5;
    const archetype = dna.primaryArchetype || dna.archetype || "";

    // Pace analysis
    const isSlowTraveler = paceScore <= 4 || /slow/i.test(archetype);
    const isPackedTraveler = paceScore >= 8;

    for (const day of days) {
      const activities = day.activities || [];
      const activityCount = activities.filter(
        (a: any) => !["free_time", "downtime", "transit", "transportation", "check-in", "check-out"]
          .includes((a.category || a.type || "").toLowerCase())
      ).length;

      // Pacing conflicts
      if (isSlowTraveler && activityCount > 5) {
        gaps.push({
          hint: `Day ${day.dayNumber} has ${activityCount} activities — may feel rushed for your travel style`,
          severity: "warning",
          category: "pacing",
        });
      }
      if (isPackedTraveler && activityCount < 3) {
        gaps.push({
          hint: `Day ${day.dayNumber} has only ${activityCount} activities — you usually prefer a packed schedule`,
          severity: "info",
          category: "pacing",
        });
      }

      // Meal gap detection
      const hasMorningMeal = activities.some((a: any) => {
        const cat = (a.category || a.type || "").toLowerCase();
        const time = a.startTime || a.time || "";
        return cat === "dining" && /^(7|8|9|10)/.test(time);
      });
      const hasLunch = activities.some((a: any) => {
        const cat = (a.category || a.type || "").toLowerCase();
        const time = a.startTime || a.time || "";
        return cat === "dining" && /^(11|12|13|1[0-2])/.test(time);
      });

      if (!hasLunch && activityCount >= 4) {
        gaps.push({
          hint: `No lunch break on Day ${day.dayNumber}`,
          severity: "warning",
          category: "meals",
        });
      }

      // Wellness gap (for comfort-oriented travelers)
      if (comfortScore >= 7) {
        const hasWellness = activities.some((a: any) => {
          const cat = (a.category || a.type || a.title || "").toLowerCase();
          return /wellness|spa|relax|rest|massage|yoga|meditation|pool/i.test(cat);
        });
        if (!hasWellness && day.dayNumber > 1) {
          gaps.push({
            hint: `No wellness or downtime moment on Day ${day.dayNumber}`,
            severity: "info",
            category: "wellness",
          });
        }
      }

      // Crowd timing (popular attractions at peak hours)
      for (const activity of activities) {
        const time = activity.startTime || activity.time || "";
        const hour = parseInt(time.split(":")[0], 10);
        if (!isNaN(hour) && hour >= 11 && hour <= 15) {
          const title = (activity.title || "").toLowerCase();
          const isPopularAttraction = /museum|cathedral|basilica|tower|palace|castle|park|monument|market/i.test(title);
          if (isPopularAttraction && spontaneityScore <= 4) {
            gaps.push({
              hint: `${activity.title} at peak hours — crowds likely`,
              severity: "warning",
              category: "timing",
            });
            break; // Only flag once per day
          }
        }
      }
    }

    // Weather gap — check if any outdoor activities on potentially rainy days
    // (lightweight: just flag if no indoor backup exists for outdoor-heavy days)
    for (const day of days) {
      const activities = day.activities || [];
      const outdoorCount = activities.filter((a: any) => {
        const cat = (a.category || a.type || a.title || "").toLowerCase();
        return /outdoor|hike|walk|beach|park|garden|tour|boat|kayak|cycle/i.test(cat);
      }).length;
      if (outdoorCount >= 3) {
        const hasIndoorBackup = activities.some((a: any) => {
          const cat = (a.category || a.type || a.title || "").toLowerCase();
          return /museum|gallery|cinema|mall|spa|indoor|cafe|restaurant/i.test(cat);
        });
        if (!hasIndoorBackup) {
          gaps.push({
            hint: `Day ${day.dayNumber} is heavily outdoor — no rain backup`,
            severity: "info",
            category: "weather",
          });
        }
      }
    }

    // Deduplicate similar gaps and cap at 7
    const uniqueGaps = gaps.reduce((acc, gap) => {
      const exists = acc.some(g => g.category === gap.category && g.hint.includes(`Day ${gap.hint.match(/Day (\d+)/)?.[1]}`));
      if (!exists) acc.push(gap);
      return acc;
    }, [] as typeof gaps).slice(0, 7);

    const result = {
      gapCount: uniqueGaps.length,
      gaps: uniqueGaps,
      dnaArchetype: archetype,
      analyzedAt: new Date().toISOString(),
      detailedFixes: null, // Unlocked after Smart Finish purchase
    };

    // Cache the result
    await supabase
      .from("trips")
      .update({ gap_analysis_result: result as any })
      .eq("id", tripId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[analyze-trip-gaps] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
