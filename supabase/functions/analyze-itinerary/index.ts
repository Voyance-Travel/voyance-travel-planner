import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalyzeItineraryRequest {
  itineraryText: string;
}

interface Issue {
  emoji: string;
  headline: string;
  detail: string;
  severity: "critical" | "warning" | "suggestion";
}

interface AnalyzeItineraryResponse {
  destination: string | null;
  issues: Issue[];
  positives: string[];
  canFix: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itineraryText }: AnalyzeItineraryRequest = await req.json();

    if (!itineraryText || typeof itineraryText !== "string" || itineraryText.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Please paste a more detailed itinerary (at least 20 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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
            role: "system",
            content: `You are a brutally honest travel expert reviewing someone's trip itinerary. Your job is to "roast" their plan - find genuine issues that will cause problems.

LOOK FOR THESE ISSUES:
1. PACING: Too many activities in one day? No rest days? Jet lag ignored?
2. LOGISTICS: Things in opposite directions on same day? Unrealistic transit times?
3. RESERVATIONS: Popular restaurants that need advance booking? Sold-out attractions?
4. TOURIST TRAPS: Overhyped places with better alternatives?
5. TIMING: Wrong time of day for certain activities? Peak crowds?
6. FLOW: Activities that don't make sense together?

TONE: Direct, helpful, slightly sassy. Like a friend who actually tells you the truth.

Use these severity levels:
- "critical": Will definitely ruin part of the trip
- "warning": Will cause frustration or wasted time
- "suggestion": Nice-to-know improvement

OUTPUT FORMAT (JSON only, no markdown):
{
  "destination": "City/Country they're visiting (infer from content, or null if unclear)",
  "issues": [
    {
      "emoji": "🚨 or 😐 or 💡",
      "headline": "Short punchy problem title (5-8 words)",
      "detail": "Specific explanation with local knowledge (20-40 words)",
      "severity": "critical|warning|suggestion"
    }
  ],
  "positives": ["One or two things they got right, if any"],
  "canFix": true
}`
          },
          {
            role: "user",
            content: `Analyze this itinerary and find the issues:\n\n${itineraryText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    // Track cost for this AI call
    const costTracker = trackCost('analyze_itinerary', 'google/gemini-2.5-flash');
    costTracker.recordAiUsage(aiResponse);
    await costTracker.save();

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON from the response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      throw new Error("Failed to parse AI response");
    }

    const result: AnalyzeItineraryResponse = {
      destination: parsed.destination || null,
      issues: parsed.issues || [],
      positives: parsed.positives || [],
      canFix: parsed.canFix !== false,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("analyze-itinerary error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Itinerary analysis failed", code: "ANALYSIS_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
