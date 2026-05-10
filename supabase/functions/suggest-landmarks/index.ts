import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightRequest, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  // Require an authenticated caller — this endpoint calls the paid Lovable AI
  // gateway. TODO(rate-limit): add per-user / per-IP rate limiting — deferred
  // (see Discover hardening).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authentication required", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return errorResponse("Invalid token", 401);
    }
  } catch (e) {
    console.error("[suggest-landmarks] Auth check failed:", e);
    return errorResponse("Invalid token", 401);
  }

  const costTracker = trackCost("suggest-landmarks", "google/gemini-2.5-flash");

  try {
    const { city, country } = await req.json();
    if (!city || typeof city !== "string") {
      return errorResponse("city is required", 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first
    const normalizedCity = city.trim();
    const { data: cached } = await supabase
      .from("city_landmarks_cache")
      .select("landmarks")
      .ilike("city", normalizedCity)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached?.landmarks) {
      costTracker.markCacheHit().addMetadata("city", normalizedCity);
      await costTracker.save();
      return jsonResponse({ landmarks: cached.landmarks, cached: true });
    }

    // Generate via Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return errorResponse("AI service not configured", 500);
    }

    const prompt = `List the top 10 must-see landmarks and attractions in ${normalizedCity}${country ? `, ${country}` : ""}. 
Return ONLY a JSON array of objects with these fields:
- "name": the landmark name (string)
- "emoji": a single relevant emoji (string)
- "category": one of "history", "nature", "culture", "food", "shopping", "viewpoint", "architecture", "religious"

Example format: [{"name":"Colosseum","emoji":"🏛️","category":"history"}]
Return the JSON array only, no other text.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a travel expert. Return only valid JSON arrays, no markdown fences." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const text = await aiResponse.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) return errorResponse("Rate limited, try again shortly", 429);
      if (status === 402) return errorResponse("AI credits exhausted", 402);
      return errorResponse("Failed to generate landmarks", 500);
    }

    const aiData = await aiResponse.json();
    costTracker.recordAiUsage(aiData, "google/gemini-2.5-flash");
    costTracker.addMetadata("city", normalizedCity);
    const content = aiData.choices?.[0]?.message?.content || "[]";

    // Parse the JSON — handle markdown fences if present
    let landmarks: Array<{ name: string; emoji: string; category: string }> = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      landmarks = JSON.parse(cleaned);
      if (!Array.isArray(landmarks)) landmarks = [];
      // Validate and sanitize
      landmarks = landmarks
        .filter((l: any) => l && typeof l.name === "string")
        .slice(0, 12)
        .map((l: any) => ({
          name: l.name.trim(),
          emoji: typeof l.emoji === "string" ? l.emoji : "📍",
          category: typeof l.category === "string" ? l.category : "culture",
        }));
    } catch {
      console.error("Failed to parse AI landmarks response:", content);
      await costTracker.save();
      return errorResponse("Failed to parse landmarks", 500);
    }

    // Cache the result
    if (landmarks.length > 0) {
      await supabase.from("city_landmarks_cache").upsert(
        {
          city: normalizedCity,
          country: country || null,
          landmarks,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "city" }
      );
    }

    await costTracker.save();
    return jsonResponse({ landmarks, cached: false });
  } catch (e) {
    console.error("suggest-landmarks error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
