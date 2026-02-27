import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TravelIntelRequest {
  destination: string;
  country?: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  archetype?: string;
  interests?: string[];
}

serve(async (req) => {
  const costTracker = trackCost('generate_travel_intel', 'perplexity/sonar-pro');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, country, startDate, endDate, travelers, archetype, interests } = await req.json() as TravelIntelRequest;

    if (!destination || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Destination, startDate, and endDate are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Search API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const locationContext = country ? `${destination}, ${country}` : destination;
    const travelerCount = travelers || 2;
    const archetypeContext = archetype ? `The traveler is a "${archetype}" type.` : '';
    const interestContext = interests?.length ? `Their interests include: ${interests.join(', ')}.` : '';

    console.log(`Generating travel intel for ${locationContext}, ${startDate} to ${endDate}`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a brilliant travel intelligence analyst. You provide timely, date-specific, opinionated destination intelligence that makes travelers feel smarter than the average tourist. Your advice is specific, practical, and feels like getting insider tips from a well-connected local friend.

Return a JSON object with this EXACT structure:
{
  "eventsAndHappenings": [
    {
      "name": "string",
      "dates": "string (specific dates or 'Every Saturday')",
      "type": "festival" | "exhibition" | "sports" | "concert" | "theatre" | "market" | "holiday" | "other",
      "description": "string (1-2 sentences, why it matters)",
      "bookingTip": "string or null (e.g. 'Tickets sell out — book 2 weeks ahead')",
      "isFree": boolean
    }
  ],
  "gettingAround": {
    "doNotDo": "string (the ONE thing NOT to do, e.g. 'Do NOT rent a car in London')",
    "bestOption": "string (the smartest way to get around)",
    "moneyTip": "string (how to save on transport)",
    "localSecret": "string (an insider transport hack)",
    "etiquetteTip": "string (a behavior tip locals care about)"
  },
  "moneyAndSpending": {
    "paymentTip": "string (cash vs card advice)",
    "mealCosts": {
      "budget": "string (e.g. '£8-12')",
      "midRange": "string (e.g. '£20-35')",
      "fineDining": "string (e.g. '£70-150/person')"
    },
    "moneyTrap": "string (a common tourist money mistake)",
    "savingHack": "string (a real money-saving tip)"
  },
  "bookNowVsWalkUp": {
    "bookNow": [
      { "name": "string", "reason": "string (why book ahead)" }
    ],
    "walkUpFine": [
      { "name": "string", "note": "string (any timing advice)" }
    ]
  },
  "weatherAndPacking": {
    "summary": "string (specific to the travel dates, not generic)",
    "temperature": "string (e.g. 'Average 8°C / 46°F')",
    "rainChance": "string (e.g. 'Rain likely 3-4 days out of 7')",
    "packingList": ["string item 1", "string item 2", "string item 3", "string item 4"],
    "dontPack": "string (what to leave at home)"
  },
  "insiderTips": [
    {
      "tip": "string (the actual tip — specific, actionable, opinionated)",
      "category": "money" | "food" | "culture" | "transport" | "timing" | "experience"
    }
  ],
  "archetypeAdvice": "string (1-2 sentences of personalized advice based on traveler type, or general if no archetype given)"
}

RULES:
- ALL information must be specific to ${locationContext} during ${startDate} to ${endDate}
- Weather/packing must reflect the ACTUAL season for those dates, not generic "best time to visit"
- Events must be real events actually happening during those dates. If unsure, don't fabricate — include fewer but accurate ones
- eventsAndHappenings: 3-6 events. Include festivals, exhibitions, sporting events, seasonal markets, holidays
- bookNowVsWalkUp: 3-5 items in each list
- insiderTips: 4-6 tips that feel genuinely insider, not Wikipedia-level
- Be opinionated. Say "Do this, skip that" not "You might consider..."
- Costs should be realistic and current
- ONLY return valid JSON. No markdown, no explanation, no wrapping.`
          },
          {
            role: 'user',
            content: `Generate timely travel intelligence for ${locationContext} for a trip from ${startDate} to ${endDate}. ${travelerCount} traveler(s). ${archetypeContext} ${interestContext}

Focus on:
1. What's actually happening in ${destination} during those exact dates (festivals, events, exhibitions, sports, seasonal things)
2. How locals actually get around (not generic "public transport available")
3. Real meal costs and money tips
4. What needs advance booking vs what you can walk up to
5. Weather and packing specific to those dates
6. Insider tips that make the traveler feel prepared`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    costTracker.recordPerplexity(1);
    costTracker.recordAiUsage(data, 'perplexity/sonar-pro');
    await costTracker.save();

    console.log('Travel intel response received');

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intelData = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({
            success: true,
            data: intelData,
            destination: locationContext,
            dates: { startDate, endDate },
            citations: data.citations,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error('Failed to parse travel intel:', parseError);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Failed to parse travel intelligence' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating travel intel:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
