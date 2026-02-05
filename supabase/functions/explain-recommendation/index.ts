// =============================================================================
// EXPLAIN RECOMMENDATION - AI-powered activity explanations
// =============================================================================
// Uses archetype context and activity metadata to explain WHY a recommendation
// fits this specific user. Returns 2-3 conversational sentences.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Activity {
  id: string;
  name: string;
  type?: string;
  category?: string;
  description?: string;
  location?: string | { name?: string; address?: string };
  price?: number;
  duration?: number;
  tags?: string[];
}

interface TripContext {
  destination: string;
  tripType?: string;
  budget?: string;
  travelers?: number;
}

interface ExplainRequest {
  activity: Activity;
  tripContext: TripContext;
  userId?: string;
}

serve(async (req) => {
  const costTracker = trackCost('explain_recommendation', 'google/gemini-2.5-flash');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    // Use anon key + auth header for proper user token validation
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { activity, tripContext } = await req.json() as ExplainRequest;

    if (!activity || !tripContext?.destination) {
      return new Response(
        JSON.stringify({ error: 'Missing activity or trip context' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load user's Travel DNA profile
    const { data: travelDNA } = await supabase
      .from('travel_dna_profiles')
      .select('primary_archetype_name, travel_dna_v2, archetype_matches')
      .eq('user_id', user.id)
      .single();

    // Resolve archetype with fallback
    let archetype = 'balanced_story_collector';
    if (travelDNA?.primary_archetype_name) {
      archetype = travelDNA.primary_archetype_name;
    } else if (travelDNA?.travel_dna_v2 && (travelDNA.travel_dna_v2 as any).primary_archetype_name) {
      archetype = (travelDNA.travel_dna_v2 as any).primary_archetype_name;
    }

    // Format archetype name for display
    const archetypeName = archetype
      .split('_')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Build AI prompt for explanation
    const activityLocation = typeof activity.location === 'string' 
      ? activity.location 
      : activity.location?.name || activity.location?.address || '';

    const prompt = `You are explaining why a specific activity was recommended for a traveler.

TRAVELER PROFILE:
- Archetype: ${archetypeName}
- Trip type: ${tripContext.tripType || 'general travel'}
- Destination: ${tripContext.destination}
- Budget level: ${tripContext.budget || 'moderate'}
- Travelers: ${tripContext.travelers || 1}

ACTIVITY BEING EXPLAINED:
- Name: ${activity.name}
- Type: ${activity.type || activity.category || 'experience'}
- Description: ${activity.description || 'No description available'}
- Location: ${activityLocation || 'In ' + tripContext.destination}
${activity.price ? `- Price: $${activity.price}` : ''}
${activity.duration ? `- Duration: ${activity.duration} minutes` : ''}
${activity.tags?.length ? `- Tags: ${activity.tags.join(', ')}` : ''}

Write a 2-3 sentence explanation of why this activity fits this traveler specifically.
Be conversational, specific, and reference their travel style.
Don't be generic - connect the activity to what makes this traveler unique.
Don't start with "This" or "Based on". Start with something about the activity itself.
Keep it under 100 words.`;

    // Call Lovable AI
    if (!lovableApiKey) {
      // Fallback response if no API key
      return new Response(
        JSON.stringify({
          explanation: `${activity.name} fits your ${archetypeName} travel style—it matches the ${activity.category || 'experience'} vibe you gravitate toward in ${tripContext.destination}.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      console.error('[explain-recommendation] AI API error:', await aiResponse.text());
      // Return fallback explanation
      return new Response(
        JSON.stringify({
          explanation: `${activity.name} aligns with your ${archetypeName} approach to travel—the kind of ${activity.category || 'experience'} that resonates with how you explore ${tripContext.destination}.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const explanation = aiData.choices?.[0]?.message?.content?.trim() || 
      `This ${activity.category || 'activity'} fits your travel style as a ${archetypeName}.`;

    // Track cost
    costTracker.recordAiUsage(aiData, 'google/gemini-2.5-flash');
    await costTracker.save();

    return new Response(
      JSON.stringify({ explanation }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[explain-recommendation] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate explanation' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
