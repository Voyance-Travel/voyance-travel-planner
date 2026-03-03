import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tripId } = await req.json();
    
    if (!tripId) {
      return new Response(
        JSON.stringify({ error: 'tripId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the trip learning
    const { data: learning, error: learningError } = await supabase
      .from('trip_learnings')
      .select('*')
      .eq('trip_id', tripId)
      .single();

    if (learningError || !learning) {
      return new Response(
        JSON.stringify({ error: 'Trip learning not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get activity feedback for this trip too
    const { data: activityFeedback } = await supabase
      .from('activity_feedback')
      .select('rating, feedback_tags, activity_type, activity_category')
      .eq('trip_id', tripId);

    // Build context for AI
    const context = {
      destination: learning.destination,
      overallRating: learning.overall_rating,
      wouldReturn: learning.would_return,
      pacingFeedback: learning.pacing_feedback,
      accommodationFeedback: learning.accommodation_feedback,
      highlights: learning.highlights || [],
      painPoints: learning.pain_points || [],
      skippedActivities: learning.skipped_activities || [],
      discoveredLikes: learning.discovered_likes || [],
      discoveredDislikes: learning.discovered_dislikes || [],
      wouldChange: learning.would_change,
      travelPartyNotes: learning.travel_party_notes,
      bestTimeOfDay: learning.best_time_of_day,
      activityRatings: activityFeedback?.map(f => ({
        rating: f.rating,
        tags: f.feedback_tags,
        type: f.activity_type,
        category: f.activity_category
      })) || []
    };

    // Generate AI summary
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      // Fallback: Generate a basic summary without AI
      const basicSummary = generateBasicSummary(context);
      
      await supabase
        .from('trip_learnings')
        .update({ lessons_summary: basicSummary })
        .eq('id', learning.id);

      return new Response(
        JSON.stringify({ summary: basicSummary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Analyze this trip feedback and generate a concise, actionable summary (2-3 sentences max) that can be used to improve future itinerary generation for this traveler.

Trip Context:
${JSON.stringify(context, null, 2)}

Focus on:
1. Key preferences discovered (what they loved/hated)
2. Pacing and timing insights (when they're at their best)
3. Specific things to avoid or prioritize next time

Output a single paragraph that could be injected into an AI prompt for their next trip planning.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a travel insights analyst. Generate concise, actionable summaries for improving future trip planning." },
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const aiResult = await response.json();
    const summary = aiResult.choices?.[0]?.message?.content?.trim() || generateBasicSummary(context);

    // Update the learning with the summary
    await supabase
      .from('trip_learnings')
      .update({ lessons_summary: summary })
      .eq('id', learning.id);

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[summarize-trip-learnings] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: "Trip summary failed", code: "SUMMARY_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateBasicSummary(context: any): string {
  const parts: string[] = [];

  if (context.pacingFeedback === 'too_rushed') {
    parts.push('Prefers a slower pace with fewer activities per day.');
  } else if (context.pacingFeedback === 'too_slow') {
    parts.push('Enjoys packed itineraries with lots to do.');
  }

  if (context.discoveredLikes?.length > 0) {
    parts.push(`Discovered a love for ${context.discoveredLikes.slice(0, 2).join(' and ')}.`);
  }

  if (context.discoveredDislikes?.length > 0) {
    parts.push(`Avoid ${context.discoveredDislikes.slice(0, 2).join(' and ')} in future trips.`);
  }

  if (context.bestTimeOfDay === 'morning_person') {
    parts.push('Schedule key activities in the morning when energy is highest.');
  } else if (context.bestTimeOfDay === 'evening_adventurer') {
    parts.push('Plan major activities for afternoon/evening.');
  }

  if (context.painPoints?.length > 0) {
    const firstPain = context.painPoints[0];
    if (firstPain.solution) {
      parts.push(`Lesson learned: ${firstPain.solution}.`);
    }
  }

  return parts.join(' ') || 'Continue refining preferences based on future trips.';
}
