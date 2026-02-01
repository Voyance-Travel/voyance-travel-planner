import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuickPreviewRequest {
  destination: string;
}

interface QuickPreviewDay {
  dayNumber: number;
  headline: string;
  description: string;
}

interface QuickPreviewResponse {
  destination: string;
  days: QuickPreviewDay[];
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination }: QuickPreviewRequest = await req.json();

    if (!destination || typeof destination !== "string") {
      return new Response(
        JSON.stringify({ error: "Destination is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use the fastest model for quick preview
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
            content: `You are a travel expert creating quick trip previews. Generate a 3-day taste of what a trip could look like.

CRITICAL RULES:
1. Use the "Slow Traveler" style: unhurried, intentional, fewer activities done well
2. Be SPECIFIC to the destination - use real neighborhood names, real landmarks
3. Keep each day to ONE headline (5-7 words) and ONE description (15-25 words)
4. Show the CONTRAST with typical rushed tourism
5. Make it feel like insider knowledge

TONE: Confident, warm, slightly irreverent. Like a well-traveled friend sharing secrets.

OUTPUT FORMAT (JSON only, no markdown):
{
  "days": [
    { "dayNumber": 1, "headline": "...", "description": "..." },
    { "dayNumber": 2, "headline": "...", "description": "..." },
    { "dayNumber": 3, "headline": "...", "description": "..." }
  ],
  "totalDays": 7
}`
          },
          {
            role: "user",
            content: `Create a quick 3-day preview for: ${destination}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
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

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON from the response
    let parsed;
    try {
      // Try to extract JSON from the response
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

    const result: QuickPreviewResponse = {
      destination: destination,
      days: parsed.days || [],
      totalDays: parsed.totalDays || 7,
      archetypeUsed: "Slow Traveler",
      archetypeTagline: "Fewer things, done well. That's the whole philosophy.",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-quick-preview error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
