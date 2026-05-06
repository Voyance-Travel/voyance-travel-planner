import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
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
  hotelArea?: string;
  tripId?: string;
  forceRefresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, country, startDate, endDate, travelers, archetype, interests, hotelArea, tripId, forceRefresh } = await req.json() as TravelIntelRequest;

    if (!destination || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Destination, startDate, and endDate are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Check cache first (if tripId provided and not forcing refresh) ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (tripId && !forceRefresh) {
      const { data: cached } = await supabaseAdmin
        .from('travel_intel_cache')
        .select('intel_data, destination, start_date, end_date, request_params')
        .eq('trip_id', tripId)
        .single();

      if (cached?.intel_data) {
        const cachedParams = (cached.request_params as Record<string, unknown> | null) || {};
        const sortedInterests = (xs: unknown): string => {
          if (!Array.isArray(xs)) return '';
          return [...xs].map(String).sort().join(',');
        };
        const personalizationMatches =
          (cachedParams.archetype ?? null) === (archetype ?? null) &&
          (cachedParams.hotelArea ?? null) === (hotelArea ?? null) &&
          sortedInterests(cachedParams.interests) === sortedInterests(interests);

        if (
          cached.destination === destination &&
          cached.start_date === startDate &&
          cached.end_date === endDate &&
          personalizationMatches
        ) {
          console.log(`Returning cached travel intel for trip ${tripId}`);
          return new Response(
            JSON.stringify({
              success: true,
              data: cached.intel_data,
              destination: country ? `${destination}, ${country}` : destination,
              dates: { startDate, endDate },
              cached: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // ── No cache hit — call Perplexity ──
    const costTracker = trackCost('generate_travel_intel', 'perplexity/sonar-pro');

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
    const hotelContext = hotelArea ? `They are staying near ${hotelArea}.` : '';

    console.log(`Generating travel intel for ${locationContext}, ${startDate} to ${endDate}${forceRefresh ? ' (forced refresh)' : ''}`);

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
            content: `You are a brilliant travel intelligence analyst who sounds like a well-traveled friend, not a Wikipedia article. You provide timely, date-specific, opinionated destination intelligence.

This section is the ONLY place for currency, tipping, transit, and local customs info — the separate "Need to Know" section only covers static logistics (visa, voltage, emergency, etc.). So be thorough here.

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
    "paymentTip": "string (cash vs card, what's accepted, ATM advice)",
    "currencyInfo": "string (e.g. 'British Pound (£). Currently ~$1.27 USD. Contactless is king.')",
    "tippingCustom": "string (e.g. '10-15% at restaurants. Check if service charge is included. Not expected at pubs.')",
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
  "localCustomsAndEtiquette": [
    {
      "do": "string (what TO do, e.g. 'Always greet shopkeepers when entering')",
      "dont": "string (what NOT to do, e.g. 'Don't snap your fingers to call a waiter')",
      "context": "string (brief explanation of why)"
    }
  ],
  "neighborhoodGuide": {
    "stayingNear": "string (area name or 'Central area' if unknown)",
    "vibe": "string (1 sentence describing the area's character)",
    "walkingDistance": ["string (nearby highlight 1)", "string (nearby highlight 2)", "string (nearby highlight 3)"],
    "localGem": "string (a specific restaurant, café, or shop worth visiting nearby)",
    "avoidNearby": "string (what to skip or be cautious of in that area, or null)"
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
- Do NOT include events that end before ${startDate} or start after ${endDate}. Every event MUST overlap with the travel window ${startDate} to ${endDate}
- eventsAndHappenings: 3-6 events. Include festivals, exhibitions, sporting events, seasonal markets, holidays
- bookNowVsWalkUp: 3-5 items in each list
- localCustomsAndEtiquette: 3-5 do/don't pairs
- neighborhoodGuide: If hotel area is provided, focus on that. Otherwise give general central area guide
- insiderTips: 4-6 tips that feel genuinely insider, not Wikipedia-level
- moneyAndSpending.currencyInfo: Include the actual currency name, symbol, and a current approximate exchange rate vs USD
- moneyAndSpending.tippingCustom: Be specific about when, how much, and when NOT to tip
- Be opinionated. Say "Do this, skip that" not "You might consider..."
- Sound like advice from a well-traveled friend, not a guidebook
- Costs should be realistic and current
- ONLY return valid JSON. No markdown, no explanation, no wrapping.`
          },
          {
            role: 'user',
            content: `Generate timely travel intelligence for ${locationContext} for a trip from ${startDate} to ${endDate}. ${travelerCount} traveler(s). ${archetypeContext} ${interestContext} ${hotelContext}

Focus on:
1. What's actually happening in ${destination} during those exact dates (festivals, events, exhibitions, sports, seasonal things)
2. How locals actually get around (not generic "public transport available")
3. Real meal costs, currency tips, tipping customs, and money advice
4. What needs advance booking vs what you can walk up to
5. Weather and packing specific to those dates
6. Local customs and etiquette — the stuff that makes you look like you've been before
7. Neighborhood guide for where they're staying
8. Insider tips that make the traveler feel prepared`
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
        let jsonStr = jsonMatch[0];
        
        // Attempt repair: fix common truncation issues from LLM output
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length;
        const closeBrackets = (jsonStr.match(/\]/g) || []).length;
        
        jsonStr = jsonStr.replace(/,\s*$/, '');
        
        const unescapedQuotes = jsonStr.match(/(?<!\\)"/g) || [];
        if (unescapedQuotes.length % 2 !== 0) {
          jsonStr += '"';
        }
        
        for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}';
        
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
        
        const intelData = JSON.parse(jsonStr);

        // ── Save to cache if tripId provided ──
        if (tripId) {
          const { error: upsertError } = await supabaseAdmin
            .from('travel_intel_cache')
            .upsert({
              trip_id: tripId,
              destination,
              start_date: startDate,
              end_date: endDate,
              request_params: { country, travelers, archetype, interests, hotelArea },
              intel_data: intelData,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'trip_id' });

          if (upsertError) {
            console.error('Failed to cache travel intel:', upsertError);
          } else {
            console.log(`Cached travel intel for trip ${tripId}`);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: intelData,
            destination: locationContext,
            dates: { startDate, endDate },
            citations: data.citations,
            cached: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error('Failed to parse travel intel:', parseError);
      console.error('Raw content length:', content.length, 'first 500 chars:', content.substring(0, 500));
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Travel intelligence is temporarily unavailable. Please try again.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating travel intel:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
