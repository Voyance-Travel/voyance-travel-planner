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
    const { activityName, destination, activityType } = await req.json();

    if (!activityName || !destination) {
      return new Response(
        JSON.stringify({ success: false, error: 'Activity name and destination are required' }),
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

    const typeHint = activityType ? ` (${activityType})` : '';
    console.log(`Looking up booking URL for: ${activityName}${typeHint} in ${destination}`);

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
            content: `You are an activity booking URL finder. Your ONLY job is to find the best URL to book or get tickets for an activity/attraction.

PRIORITY ORDER for URLs:
1. Official attraction website with ticket/booking page
2. Official tourism board booking page
3. GetYourGuide, Viator, or Klook direct link to this specific activity
4. TripAdvisor experience booking link (NOT review page)
5. Eventbrite or similar for events/tours

RULES:
- Return ONLY the URL, nothing else
- Prefer official sources over aggregators
- The URL must lead to booking/tickets, not just information
- If no booking URL exists (free attraction), return the official website
- If you cannot find any relevant URL, respond with "NOT_FOUND"
- DO NOT return generic search pages or directory listings`
          },
          {
            role: 'user',
            content: `Find the booking or ticket URL for "${activityName}"${typeHint} in ${destination}`
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
        JSON.stringify({ success: true, url: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up the URL
    const cleanUrl = content.replace(/[.,;:!?\s]+$/, '');

    return new Response(
      JSON.stringify({ success: true, url: cleanUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error looking up activity URL:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
