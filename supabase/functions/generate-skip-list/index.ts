import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Generate Skip List — AI-powered tourist trap avoidance for ANY destination.
 * Returns a list of places/experiences to avoid with reasons and alternatives.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination } = await req.json();
    if (!destination) {
      return new Response(
        JSON.stringify({ error: 'destination is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are a seasoned travel expert. For the destination "${destination}", list 3-5 specific tourist traps, overpriced spots, overcrowded attractions, or overhyped experiences that savvy travelers should AVOID.

For each item, provide:
- name: The specific place or experience name
- reason: 1-2 sentences explaining WHY to avoid it (be specific — mention prices, quality issues, crowd problems)
- category: one of "tourist-trap", "overpriced", "overcrowded", "overhyped"
- savingsEstimate: { money?: "$XX", time?: "XX min" } — what the traveler saves by skipping
- betterAlternative: A specific, lesser-known alternative (optional but preferred)

RULES:
- Be SPECIFIC — real venue/experience names, real prices
- Focus on things that locals would NEVER do or places that are genuinely bad value
- Do NOT include legitimate attractions that happen to be popular (e.g., the Louvre is crowded but still worth it)
- Include at least one dining-related trap and one activity-related trap

Return valid JSON only:
{
  "skippedItems": [
    {
      "name": "Example Restaurant Row",
      "reason": "Triple the price for half the quality...",
      "category": "tourist-trap",
      "savingsEstimate": { "money": "$40", "time": "30 min" },
      "betterAlternative": "A specific alternative"
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a travel expert. Return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      console.error("[generate-skip-list] AI error:", response.status);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '{}';

    if (content.includes('```')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    const parsed = JSON.parse(content);

    return new Response(
      JSON.stringify({ success: true, skippedItems: parsed.skippedItems || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("[generate-skip-list] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed', skippedItems: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
