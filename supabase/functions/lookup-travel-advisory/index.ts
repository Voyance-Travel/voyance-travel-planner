import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";
import { buildCacheKey, getCached, setCache, TTL } from "../_shared/perplexity-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TravelAdvisoryRequest {
  destination: string;
  originCountry?: string;
  travelDate?: string;
}

serve(async (req) => {
  const costTracker = trackCost('lookup_travel_advisory', 'perplexity/sonar');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, originCountry, travelDate } = await req.json() as TravelAdvisoryRequest;

    if (!destination) {
      return new Response(
        JSON.stringify({ success: false, error: 'Destination is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first (7-day TTL for travel advisories)
    const origin = originCountry || 'US';
    const cacheKey = buildCacheKey('travel-advisory', destination, origin);
    const cached = await getCached<{ data: unknown; citations?: unknown }>(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ success: true, data: cached.data, citations: cached.citations, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const originContext = originCountry 
      ? `The traveler is from ${originCountry}.` 
      : 'Assume the traveler is from the United States.';
    
    const dateContext = travelDate 
      ? `Travel date: ${travelDate}.` 
      : '';

    console.log(`Looking up travel advisory for ${destination}`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a travel advisory specialist. Provide current, accurate information about entry requirements, safety, and health for travelers.

Return a JSON object with this structure:
{
  "visaRequired": boolean,
  "visaType": string or null (e.g., "Tourist visa on arrival", "eVisa required", "Visa-free for 90 days"),
  "visaDetails": string or null (how to obtain, cost estimate),
  "passportValidity": string or null (e.g., "6 months beyond travel dates"),
  "entryRequirements": [string] (list of requirements like ETIAS, ETA, etc.),
  "safetyLevel": "low-risk" | "moderate" | "elevated" | "high-risk",
  "safetyAdvisory": string or null (current government advisory if any),
  "healthRequirements": [string] (vaccinations, health insurance, etc.),
  "covidRestrictions": string or null (current COVID rules if any),
  "currencyTips": string or null (e.g., "Euro (€). Cards widely accepted."),
  "importantNotes": [string] (any current alerts, strikes, events to be aware of),
  "lastUpdated": string (today's date YYYY-MM-DD)
}

RULES:
- Be accurate and current - travelers rely on this
- Include only verified requirements
- Note if requirements may have changed recently
- ONLY return valid JSON. No markdown, no explanation.`
          },
          {
            role: 'user',
            content: `Get travel advisory information for traveling to ${destination}. ${originContext} ${dateContext}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    costTracker.recordPerplexity(1);
    costTracker.recordAiUsage(data, 'perplexity/sonar');
    await costTracker.save();
    
    console.log('Perplexity response:', content);

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const advisoryData = JSON.parse(jsonMatch[0]);
        const result = { data: advisoryData, citations: data.citations };
        
        // Cache for 7 days
        await setCache(cacheKey, 'travel_advisory', result, TTL.SEVEN_DAYS);
        
        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error('Failed to parse advisory data:', parseError);
    }

    return new Response(
      JSON.stringify({ success: true, data: null, rawContent: content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error looking up travel advisory:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
