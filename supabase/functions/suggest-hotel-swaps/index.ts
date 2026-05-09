/**
 * Suggest Hotel Swaps Edge Function
 * Analyzes current itinerary activities vs hotel neighborhood
 * and suggests swaps for activities that would benefit from being closer to the hotel.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Activity {
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  location?: { name?: string; address?: string };
  isLocked?: boolean;
}

interface DayData {
  dayNumber: number;
  date?: string;
  activities: Activity[];
}

interface SwapSuggestion {
  dayNumber: number;
  activityId: string;
  currentActivity: string;
  currentLocation?: string;
  suggestedActivity: string;
  suggestedLocation?: string;
  reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tripId, destination, hotelName, hotelNeighborhood, days } = await req.json();

    if (!destination || !days?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hotelContext = hotelNeighborhood 
      ? `${hotelName} in ${hotelNeighborhood}, ${destination}`
      : `${hotelName}, ${destination}`;

    // Build activity summary for the AI — skip locked activities
    const activitySummary = days.map((day: DayData) => {
      const acts = day.activities
        .filter(a => !a.isLocked && a.type !== 'transport' && a.type !== 'free_time')
        .map(a => `- [ID:${a.id}] ${a.name} (${a.category || a.type || 'activity'}) at ${a.location?.name || a.location?.address || 'unknown location'}, ${a.startTime || ''}`)
        .join('\n');
      return `Day ${day.dayNumber}:\n${acts || '(no swappable activities)'}`;
    }).join('\n\n');

    const prompt = `You are a travel optimization expert. A traveler has confirmed they're staying at ${hotelContext}.

Here is their current itinerary (locked activities CANNOT be changed and are excluded):

${activitySummary}

Analyze which activities would benefit from being swapped to alternatives CLOSER to the hotel neighborhood (${hotelNeighborhood || hotelName}). Only suggest swaps where:
1. The current activity is far from the hotel area AND there's a genuinely better alternative nearby
2. The swap maintains the same category/vibe (don't swap a museum for a restaurant)
3. The suggested alternative is a REAL, specific place in ${destination}
4. The quality is equal or better

For activities already near the hotel or where no better nearby alternative exists, DO NOT suggest a swap.

Return a JSON array of swap suggestions. Each suggestion must have:
- dayNumber (number)
- activityId (string, the [ID:xxx] from above)
- currentActivity (string, name of current)
- currentLocation (string, where it currently is)
- suggestedActivity (string, specific real venue name)
- suggestedLocation (string, neighborhood/area)
- reason (string, one sentence explaining why this is better given the hotel location)

If no swaps are beneficial, return an empty array [].
Return ONLY the JSON array, no markdown or explanation.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded, please try again shortly.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: 'AI credits exhausted. Add credits in Workspace settings.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[suggest-hotel-swaps] AI call failed:', errText);
      throw new Error('AI service unavailable');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '[]';
    
    // Parse JSON from response (handle markdown code blocks)
    let suggestions: SwapSuggestion[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      suggestions = JSON.parse(cleaned);
      
      // Validate structure
      suggestions = suggestions.filter((s: any) => 
        s.dayNumber && s.activityId && s.currentActivity && s.suggestedActivity && s.reason
      );
    } catch (parseErr) {
      console.error('[suggest-hotel-swaps] Failed to parse AI response:', content);
      suggestions = [];
    }

    return new Response(
      JSON.stringify({ 
        suggestions, 
        hotelContext,
        totalSwaps: suggestions.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[suggest-hotel-swaps] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
