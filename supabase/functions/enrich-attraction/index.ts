import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";
import { buildCacheKey, getCached, setCache, TTL } from "../_shared/perplexity-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AttractionEnrichmentRequest {
  attractionName: string;
  destination: string;
  travelDate?: string;
}

serve(async (req) => {
  const costTracker = trackCost('enrich_attraction', 'perplexity/sonar');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attractionName, destination, travelDate } = await req.json() as AttractionEnrichmentRequest;

    if (!attractionName || !destination) {
      return new Response(
        JSON.stringify({ success: false, error: 'Attraction name and destination are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first (24-hour TTL for hours/prices)
    const cacheKey = buildCacheKey('attraction', attractionName, destination);
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

    const dateContext = travelDate 
      ? `The visitor will be there on ${travelDate}.` 
      : '';

    console.log(`Enriching attraction: ${attractionName} in ${destination}`);

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
            content: `You are a travel research assistant. Provide accurate, current information about tourist attractions.

Return a JSON object with these fields (use null for unknown values):
{
  "isOpen": boolean or null (whether the attraction is currently operating),
  "isClosed": boolean or null (true if permanently/temporarily closed),
  "closureReason": string or null (reason if closed),
  "openingHours": string or null (e.g., "9:00 AM - 6:00 PM daily"),
  "admissionPrice": string or null (e.g., "$25 adults, $15 children"),
  "priceRange": string or null (e.g., "$", "$$", "$$$"),
  "reservationRequired": boolean or null,
  "bookingUrl": string or null (official booking/ticket URL),
  "website": string or null (official website URL),
  "bestTimeToVisit": string or null (e.g., "Early morning to avoid crowds"),
  "currentWaitTime": string or null,
  "specialNotes": string or null (any current advisories, special exhibitions, or important info),
  "lastUpdated": string (today's date in YYYY-MM-DD format)
}

ONLY return valid JSON. No markdown, no explanation.`
          },
          {
            role: 'user',
            content: `Get current information about "${attractionName}" in ${destination}. ${dateContext}`
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
        const enrichmentData = JSON.parse(jsonMatch[0]);
        const result = { data: enrichmentData, citations: data.citations };
        
        // Cache for 24 hours
        await setCache(cacheKey, 'attraction_enrichment', result, TTL.ONE_DAY);
        
        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error('Failed to parse enrichment data:', parseError);
    }

    return new Response(
      JSON.stringify({ success: true, data: null, rawContent: content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error enriching attraction:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
