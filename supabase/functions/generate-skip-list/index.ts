import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Generate Local Alternatives — AI-powered insider recommendations for ANY destination.
 * Returns a list of better local-favorite alternatives to commonly visited tourist spots.
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

    const prompt = `You are a seasoned travel expert who helps travelers discover authentic local experiences. For the destination "${destination}", list 3-5 commonly visited spots where savvy travelers can find BETTER local alternatives.

For each item, provide:
- name: The well-known spot or experience
- localAlternative: A specific, lesser-known alternative that locals prefer
- reason: 1-2 sentences explaining WHY the alternative is better (focus on the positive — better value, more authentic, less crowded, better quality)
- category: one of "local-favorite", "better-value", "hidden-gem", "insider-pick"
- savingsEstimate: { money?: "$XX", time?: "XX min" } — what the traveler gains by choosing the alternative

RULES:
- Frame everything POSITIVELY — focus on why the alternative is great, not why the popular spot is bad
- Be SPECIFIC — real venue/experience names, real benefits
- Focus on genuine local favorites that deliver better experiences
- Include at least one dining alternative and one activity alternative

Return valid JSON only:
{
  "localAlternatives": [
    {
      "name": "Popular Spot Name",
      "localAlternative": "The better local option",
      "reason": "Why locals prefer this — better quality, authentic atmosphere...",
      "category": "local-favorite",
      "savingsEstimate": { "money": "$40", "time": "30 min" }
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

    // Strip markdown code fences
    if (content.includes('```')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    // Fix common AI JSON issues
    content = content
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/\n/g, ' ');

    let parsed: { localAlternatives?: unknown[]; skippedItems?: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error("[generate-skip-list] Raw content:", content.substring(0, 500));
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw parseErr;
      }
    }

    // Support both old and new response shapes
    const items = parsed.localAlternatives || parsed.skippedItems || [];

    return new Response(
      JSON.stringify({ success: true, skippedItems: items }),
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
