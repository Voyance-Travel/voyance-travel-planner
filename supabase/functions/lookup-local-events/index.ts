import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LocalEventsRequest {
  destination: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  interests?: string[]; // Optional filter by interests
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, startDate, endDate, interests } = await req.json() as LocalEventsRequest;

    if (!destination || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Destination, start date, and end date are required' }),
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

    const interestFilter = interests?.length 
      ? `Focus on events related to: ${interests.join(', ')}.` 
      : '';

    console.log(`Looking up events in ${destination} from ${startDate} to ${endDate}`);

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
            content: `You are a local events researcher. Find current festivals, concerts, exhibitions, sports events, cultural events, and special happenings in a destination during specific travel dates.

Return a JSON array of events with this structure:
[
  {
    "name": "Event name",
    "type": "festival" | "concert" | "exhibition" | "sports" | "cultural" | "market" | "other",
    "dates": "Date range or specific date (e.g., 'March 15-17' or 'Every Saturday')",
    "location": "Venue or area name",
    "description": "Brief 1-2 sentence description",
    "ticketUrl": "URL for tickets if applicable, null otherwise",
    "isFree": boolean,
    "priceRange": "$" | "$$" | "$$$" | null,
    "isRecurring": boolean
  }
]

RULES:
- Include only events happening during the specified dates
- Maximum 10 events, prioritize by significance/popularity
- Include both ticketed and free events
- Only return events you're confident about
- Return an empty array [] if no events found
- ONLY return valid JSON array. No markdown, no explanation.`
          },
          {
            role: 'user',
            content: `Find events and happenings in ${destination} between ${startDate} and ${endDate}. ${interestFilter}`
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

    try {
      // Try to parse JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const events = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({ success: true, events, citations: data.citations }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error('Failed to parse events data:', parseError);
    }

    return new Response(
      JSON.stringify({ success: true, events: [], rawContent: content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error looking up local events:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
