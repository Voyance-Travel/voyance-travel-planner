/**
 * Image Quality Scoring Edge Function
 * 
 * Uses Lovable AI (Gemini Vision) to assess image quality before display.
 * Returns a quality score 0-1 and rejection reasons if applicable.
 * 
 * Quality checks:
 * - Resolution/blur detection
 * - Relevance to destination/activity
 * - Content appropriateness (no people close-ups, screenshots, watermarks)
 * - Aesthetic quality
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScoreRequest {
  imageUrl: string;
  context: {
    destination?: string;
    venueName?: string;
    category?: string;
    expectedType?: 'destination' | 'activity' | 'hotel' | 'restaurant';
  };
}

interface ScoreResponse {
  score: number;           // 0-1, higher is better
  pass: boolean;           // true if score >= threshold
  issues: string[];        // List of detected issues
  confidence: number;      // 0-1, how confident the model is
  cached?: boolean;
}

// Quality threshold - images below this score will be rejected
const QUALITY_THRESHOLD = 0.6;

// Cache results to avoid re-scoring the same images
const scoreCache = new Map<string, ScoreResponse>();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, context } = await req.json() as ScoreRequest;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache first
    const cacheKey = `${imageUrl}:${JSON.stringify(context)}`;
    const cached = scoreCache.get(cacheKey);
    if (cached) {
      console.log("[Quality] Cache hit for:", imageUrl.slice(0, 50));
      return new Response(
        JSON.stringify({ ...cached, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[Quality] LOVABLE_API_KEY not configured");
      // Fail open - allow image if we can't check
      return new Response(
        JSON.stringify({ score: 0.7, pass: true, issues: [], confidence: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context string for the prompt
    const contextParts: string[] = [];
    if (context?.destination) contextParts.push(`destination: ${context.destination}`);
    if (context?.venueName) contextParts.push(`venue: ${context.venueName}`);
    if (context?.category) contextParts.push(`category: ${context.category}`);
    if (context?.expectedType) contextParts.push(`type: ${context.expectedType}`);
    const contextStr = contextParts.length > 0 ? contextParts.join(", ") : "travel photo";

    console.log("[Quality] Scoring image:", imageUrl.slice(0, 80), "context:", contextStr);

    const prompt = `You are an image quality assessor for a travel planning app. Analyze this image and provide a quality score.

Context: This image should represent ${contextStr}.

Score the image from 0-100 based on these criteria:
1. RELEVANCE (40%): Does the image match the expected context? A restaurant photo should show food/interior, a landmark should show the landmark, etc.
2. QUALITY (30%): Is the image high resolution, well-lit, properly exposed, not blurry?
3. APPROPRIATENESS (20%): No close-up faces, no screenshots, no watermarks, no text overlays, no stock photo markers
4. AESTHETICS (10%): Is it visually appealing for a travel app?

REJECT (score 0-30) if:
- Image shows random people's faces prominently
- Image is a screenshot or has UI elements
- Image has large watermarks or stock photo text
- Image is completely unrelated to the context
- Image is very low quality/blurry/dark
- Image shows something offensive or inappropriate

PASS (score 60-100) if:
- Image clearly represents the destination/venue/activity
- Image is high quality and travel-appropriate
- Image would look good in a travel itinerary

Respond with ONLY a JSON object (no markdown):
{"score": <0-100>, "issues": ["issue1", "issue2"], "confidence": <0-100>}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageUrl } }
              ]
            }
          ],
          max_tokens: 200,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Quality] AI API error:", response.status, errorText);
        
        // Handle rate limits gracefully
        if (response.status === 429 || response.status === 402) {
          console.log("[Quality] Rate limited, failing open");
          return new Response(
            JSON.stringify({ score: 0.7, pass: true, issues: ["rate_limited"], confidence: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Fail open for other errors
        return new Response(
          JSON.stringify({ score: 0.7, pass: true, issues: ["api_error"], confidence: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      
      console.log("[Quality] AI response:", content.slice(0, 200));

      // Parse the JSON response
      let parsed: { score: number; issues: string[]; confidence: number };
      try {
        // Clean up potential markdown formatting
        const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error("[Quality] Failed to parse AI response:", content);
        // Try to extract score with regex as fallback
        const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 70;
        parsed = { score, issues: ["parse_error"], confidence: 50 };
      }

      // Normalize score to 0-1
      const normalizedScore = Math.max(0, Math.min(1, parsed.score / 100));
      const normalizedConfidence = Math.max(0, Math.min(1, (parsed.confidence || 70) / 100));

      const result: ScoreResponse = {
        score: normalizedScore,
        pass: normalizedScore >= QUALITY_THRESHOLD,
        issues: parsed.issues || [],
        confidence: normalizedConfidence,
      };

      // Cache the result (limit cache size)
      if (scoreCache.size > 500) {
        const firstKey = scoreCache.keys().next().value;
        if (firstKey) scoreCache.delete(firstKey);
      }
      scoreCache.set(cacheKey, result);

      console.log(`[Quality] Score: ${normalizedScore.toFixed(2)}, Pass: ${result.pass}, Issues: ${result.issues.join(", ")}`);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === "AbortError") {
        console.log("[Quality] Timeout scoring image");
        return new Response(
          JSON.stringify({ score: 0.7, pass: true, issues: ["timeout"], confidence: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error("[Quality] Error:", error);
    
    // Fail open - allow image if scoring fails
    return new Response(
      JSON.stringify({ score: 0.7, pass: true, issues: ["error"], confidence: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
