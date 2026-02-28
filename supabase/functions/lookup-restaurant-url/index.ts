import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";
import { buildCacheKey, getCached, setCache, TTL } from "../_shared/perplexity-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  const costTracker = trackCost('lookup_restaurant_url', 'perplexity/sonar');
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurantName, destination } = await req.json();

    if (!restaurantName || !destination) {
      return new Response(
        JSON.stringify({ success: false, error: 'Restaurant name and destination are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first (30-day TTL for restaurant URLs)
    const cacheKey = buildCacheKey('restaurant-url', restaurantName, destination);
    const cached = await getCached<{ url: string | null }>(cacheKey);
    if (cached) {
      console.log(`[lookup-restaurant-url] Cache HIT for "${restaurantName}" in ${destination}`);
      return new Response(
        JSON.stringify({ success: true, url: cached.url, cached: true }),
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

    console.log(`[lookup-restaurant-url] Looking up: "${restaurantName}" in ${destination}`);

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
            content: `You are a restaurant URL finder. Find the official website for restaurants.

RULES:
1. Search for the restaurant's official website, reservation page, or menu page
2. Acceptable URLs: the restaurant's own domain, their page on OpenTable, Resy, TheFork, or similar booking platforms
3. If you find their Instagram or Facebook page but no website, return that
4. If the query looks like a generic dining experience (e.g., "Traditional Fado Dinner Experience") rather than a specific restaurant name, try to identify what specific restaurant or venue offers this experience and return its URL
5. DO NOT return Yelp, TripAdvisor, Google Maps, Google search results, or generic directory URLs
6. If you truly cannot find any official presence, respond with exactly: NOT_FOUND
7. Your response must be ONLY the URL - no explanation, no markdown, no extra text`
          },
          {
            role: 'user',
            content: `Find the official website or booking page for "${restaurantName}" in ${destination}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[lookup-restaurant-url] Perplexity API error:', response.status, errorText);
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
    
    console.log('[lookup-restaurant-url] Perplexity response:', content);

    let cleanUrl: string | null = null;

    if (content !== 'NOT_FOUND' && !content.toLowerCase().includes('not_found') && content.startsWith('http')) {
      const urlMatch = content.match(/https?:\/\/[^\s"'<>]+/);
      cleanUrl = urlMatch ? urlMatch[0].replace(/[.,;:!?\s]+$/, '') : null;
    }

    // Cache result (even null) for 30 days
    await setCache(cacheKey, 'restaurant_url', { url: cleanUrl }, TTL.THIRTY_DAYS);

    if (!cleanUrl) {
      console.log('[lookup-restaurant-url] No URL found, returning fallback');
      return new Response(
        JSON.stringify({ success: true, url: null, fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[lookup-restaurant-url] Found URL:', cleanUrl);
    return new Response(
      JSON.stringify({ success: true, url: cleanUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[lookup-restaurant-url] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
