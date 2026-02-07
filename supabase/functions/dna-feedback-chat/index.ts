/**
 * DNA Feedback Chat Edge Function
 * 
 * AI-powered chat to help users refine their Travel DNA profile.
 * Uses tool-calling to extract structured trait adjustments.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a Travel DNA refinement assistant for Voyance. Users tell you what feels wrong about their travel personality profile, and you suggest specific trait adjustments.

## TRAIT DIMENSIONS (each -10 to +10)
- **planning**: -10 = totally spontaneous, +10 = meticulous planner
- **social**: -10 = solo traveler, +10 = loves groups and socializing
- **comfort**: -10 = roughing it is fine, +10 = luxury is non-negotiable
- **pace**: -10 = slow and relaxed, +10 = packed schedule
- **authenticity**: -10 = loves popular tourist spots, +10 = seeks hidden local gems
- **adventure**: -10 = plays it safe, +10 = thrill-seeker
- **budget**: -10 = luxury spender, +10 = budget-conscious
- **transformation**: -10 = travel for relaxation only, +10 = travel for personal growth

## RULES
- Listen to the user and propose ONE trait adjustment per message (1-2 traits max)
- Explain why the adjustment makes sense for them
- Use the adjust_traits tool to propose changes
- Keep responses warm, concise (2-3 sentences), and conversational
- Adjustments should be moderate (±3 to ±5 per trait), never extreme
- If the user's request is vague, ask ONE clarifying question
- Only discuss travel preferences — redirect off-topic requests

## CURRENT PROFILE
The user's current trait scores will be provided. Use them to make informed suggestions.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "adjust_traits",
      description: "Propose adjustments to the user's Travel DNA trait scores based on their feedback",
      parameters: {
        type: "object",
        properties: {
          adjustments: {
            type: "object",
            description: "Map of trait names to their NEW absolute values (-10 to +10)",
            additionalProperties: { type: "number" },
          },
          explanation: {
            type: "string",
            description: "Brief explanation of why these adjustments fit the user's feedback",
          },
        },
        required: ["adjustments", "explanation"],
      },
    },
  },
];

serve(async (req) => {
  const costTracker = trackCost('dna_feedback_chat', 'google/gemini-3-flash-preview');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { messages, currentArchetype, currentTraits } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Missing required field: messages");
    }

    // Build context about current profile
    const profileContext = currentTraits
      ? `\n## USER'S CURRENT SCORES\n${Object.entries(currentTraits).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n${currentArchetype ? `Current archetype: ${currentArchetype}` : ''}`
      : '';

    const apiMessages = [
      { role: "system", content: SYSTEM_PROMPT + profileContext },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    
    costTracker.setUserId(userId || 'anonymous');
    costTracker.recordAiUsage(data, 'google/gemini-3-flash-preview');
    await costTracker.save();

    const choice = data.choices?.[0];
    const toolCalls = choice?.message?.tool_calls || [];
    const textContent = choice?.message?.content || "";

    // Extract trait adjustments from tool calls
    let suggestedTraits: Record<string, number> | null = null;
    let explanation = "";

    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === "adjust_traits") {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        suggestedTraits = args.adjustments || null;
        explanation = args.explanation || "";
      }
    }

    return new Response(
      JSON.stringify({
        message: textContent || explanation || "I've suggested some adjustments to your profile.",
        suggestedTraits,
        explanation,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("[dna-feedback-chat] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
