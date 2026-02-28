import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProactiveRequest {
  destination: string;
  archetype: string;
  dayNumber: number;
  dayActivities: { title: string; category: string; time?: string; location?: string }[];
  tripDates?: { start: string; end: string };
  budgetTier?: string;
  interests?: string[];
  timeOfDay?: string;
  blendedDna?: {
    blendedTraits: Record<string, number>;
    travelerProfiles: Array<{ userId: string; name: string; archetypeId: string; isOwner: boolean; weight: number }>;
    isBlended: boolean;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ProactiveRequest = await req.json();
    const { destination, archetype, dayNumber, dayActivities, tripDates, budgetTier, interests, timeOfDay, blendedDna } = body;

    if (!destination || !archetype) {
      return new Response(
        JSON.stringify({ error: "destination and archetype are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build schedule gap analysis
    const scheduleContext = dayActivities.length > 0
      ? `Current Day ${dayNumber} schedule:\n${dayActivities.map((a, i) => `  ${i + 1}. ${a.time || '?'} — ${a.title} (${a.category})${a.location ? ` at ${a.location}` : ''}`).join('\n')}`
      : `Day ${dayNumber} is currently empty.`;

    const interestsContext = interests?.length ? `\nTraveler interests: ${interests.join(', ')}` : '';
    const budgetContext = budgetTier ? `\nBudget tier: ${budgetTier}` : '';
    const dateContext = tripDates ? `\nTrip dates: ${tripDates.start} to ${tripDates.end}` : '';

    // Build group context if blended
    let groupDiscoverContext = '';
    if (blendedDna?.isBlended && blendedDna.travelerProfiles?.length > 1) {
      const travelerList = blendedDna.travelerProfiles.map(p => 
        `- ${p.name} (${p.isOwner ? 'Trip Owner' : 'Companion'}, archetype: ${p.archetypeId.replace(/_/g, ' ')}, weight: ${Math.round(p.weight * 100)}%)`
      ).join('\n');
      groupDiscoverContext = `

GROUP TRIP: This trip has ${blendedDna.travelerProfiles.length} travelers with blended preferences.
${travelerList}

Blended Traits: ${JSON.stringify(blendedDna.blendedTraits)}

For the "forYou" category, generate suggestions tagged for SPECIFIC travelers based on their archetypes. Include a "forTraveler" field with the traveler's name. Alternate between travelers so each person gets personalized picks. For "nearSchedule" and "hiddenGems", suggest activities that appeal to the GROUP.`;
    }

    const systemPrompt = `You are Voyance, a premium AI travel planner. You PROACTIVELY suggest activities that this specific traveler would love — not generic tourist attractions, but things matched to WHO they are.

DESTINATION: ${destination}
TRAVELER ARCHETYPE: ${archetype}
TIME OF DAY: ${timeOfDay || 'current'}
${scheduleContext}
${interestsContext}
${budgetContext}
${dateContext}
${groupDiscoverContext}

Generate THREE categories of proactive suggestions:

1. "forYou" — 3 suggestions specifically matched to ${blendedDna?.isBlended ? 'the group travelers (tag each with "forTraveler" name)' : `the ${archetype} archetype`}. These should feel personal and surprising, not obvious. Explain WHY this traveler would love each one based on their archetype traits.

2. "nearSchedule" — 2-3 suggestions that fit into gaps or complement activities already on Day ${dayNumber}. If the day is empty, suggest great ways to start or fill the day. Reference specific schedule gaps or transitions.

3. "hiddenGems" — 2 suggestions that are off-the-beaten-path, local favorites, or lesser-known spots that match this traveler's style. These should feel like insider knowledge.

For each suggestion, provide:
- A compelling title
- Brief description (15-25 words)
- Why it's perfect for THIS traveler (personalized, 10-20 words)
- Category (dining, sightseeing, nightlife, culture, nature, shopping, wellness)
- Estimated cost range
- Best time to go
- How it fits with their schedule
- Estimated distance from the nearest itinerary activity that day (e.g. "1.2 km", "800m")
- Estimated walking time from the nearest activity (e.g. "15 min walk", "5 min walk")
${blendedDna?.isBlended ? '- "forTraveler": Name of the traveler this is best suited for (for "forYou" category)' : ''}

CRITICAL: Be opinionated. Don't suggest things every tourist does. Suggest things that make the traveler feel like Voyance truly knows them.

OUTPUT FORMAT (JSON only, no markdown):
{
  "forYou": [
    {
      "id": "unique-slug",
      "name": "Place Name",
      "description": "Brief compelling description",
      "whyForYou": "Personalized reason tied to archetype",
      "category": "dining",
      "priceLevel": 2,
      "bestTime": "afternoon",
      "scheduleFit": "Perfect for the 2pm gap between museum and dinner",
      "rating": 4.5,
      "distance": "1.2 km from your lunch spot",
      "walkTime": "15 min walk"${blendedDna?.isBlended ? ',\n      "forTraveler": "Traveler Name"' : ''}
    }
  ],
  "nearSchedule": [...],
  "hiddenGems": [...]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate proactive discovery suggestions for a ${archetype} traveler in ${destination}, Day ${dayNumber}` }
        ],
        temperature: 0.8,
        max_tokens: 1800,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    return new Response(JSON.stringify({
      forYou: parsed.forYou || [],
      nearSchedule: parsed.nearSchedule || [],
      hiddenGems: parsed.hiddenGems || [],
      archetype,
      destination,
      dayNumber,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("discover-proactive error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
