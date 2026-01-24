import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Search API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up URL for: ${restaurantName} in ${destination}`);

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
            content: `You are a restaurant URL lookup assistant. Your ONLY job is to find the official website URL for a restaurant. 
            
IMPORTANT RULES:
1. Return ONLY the official restaurant website URL (their own domain, not a third-party site)
2. If they have a reservation page, prefer that URL (e.g., OpenTable direct link to the restaurant, or their own /reservations page)
3. If no official website exists, return their official social media page (Instagram or Facebook)
4. If you cannot find any official presence, respond with "NOT_FOUND"
5. DO NOT return Yelp, TripAdvisor, Google Maps, or generic directory URLs
6. Your response must be ONLY the URL, nothing else - no explanation, no formatting`
          },
          {
            role: 'user',
            content: `Find the official website URL for "${restaurantName}" restaurant in ${destination}`
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
    
    console.log('Perplexity response:', content);

    // Validate it looks like a URL
    if (content === 'NOT_FOUND' || !content.startsWith('http')) {
      return new Response(
        JSON.stringify({ success: true, url: null, fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up the URL (remove any trailing punctuation or whitespace)
    const cleanUrl = content.replace(/[.,;:!?\s]+$/, '');

    return new Response(
      JSON.stringify({ success: true, url: cleanUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error looking up restaurant URL:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
