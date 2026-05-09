import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { tripId, mode } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // =============================================
    // DAILY BRIEFING MODE
    // =============================================
    if (mode === 'daily-briefing') {
      const { data: tripData } = await supabase
        .from('trips')
        .select('destination, destination_country, itinerary_data, metadata, start_date')
        .eq('id', tripId)
        .single();

      if (!tripData) {
        return new Response(JSON.stringify({ error: 'Trip not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const itin = (tripData.itinerary_data as any) || {};
      const days = itin.days || itin.itinerary || [];
      const todayDay = (Array.isArray(days) ? days : []).find((d: any) => d.date === today);
      const todayActivities = todayDay?.activities || [];

      const todaySchedule = {
        activityCount: todayActivities.length,
        firstActivity: todayActivities.length > 0
          ? `${todayActivities[0].title} at ${todayActivities[0].startTime || todayActivities[0].start_time || 'TBD'}`
          : 'No activities planned',
        lastActivity: todayActivities.length > 1
          ? `${todayActivities[todayActivities.length - 1].title} at ${todayActivities[todayActivities.length - 1].startTime || todayActivities[todayActivities.length - 1].start_time || 'TBD'}`
          : todayActivities.length === 1 ? 'Just one activity today' : '',
      };

      const destination = tripData.destination || 'the destination';
      const meta = (tripData.metadata as any) || {};
      const dnaTraits = meta.interestCategories || [];

      const briefingPrompt = `You are a local travel concierge for ${destination}, ${tripData.destination_country || ''}.
Today's date: ${today}

The traveler has these interests: ${dnaTraits.join(', ') || 'general sightseeing'}.

Today's planned activities:
${todayActivities.map((a: any, i: number) => `${i + 1}. ${a.title} (${a.startTime || a.start_time || 'TBD'}) - ${a.category || 'activity'}`).join('\n') || 'None planned'}

Generate a daily briefing as JSON with:
1. "weather": Realistic weather estimate for ${destination} today (use seasonal averages for this time of year). Include condition, tempHigh, tempLow, unit ("C" for non-US destinations, "F" for US), and a practical tip.
2. "highlights": 2-3 things happening near ${destination} today that match the traveler's interests. Could be markets, seasonal events, local customs, neighborhood vibes. Each needs title, reason (why this matches them), and optional timeNote.
3. "dontMiss": 2-3 practical, time-sensitive tips for today. Examples: best times to visit busy spots, sunset times, restaurant reservation tips, local customs to know. Each needs tip and category ("timing", "local", "weather", or "tip").

Return ONLY valid JSON, no markdown.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'You are a travel concierge. Return only valid JSON.' },
            { role: 'user', content: briefingPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('[mid-trip-dna] AI gateway error:', aiResponse.status, errText);
        return new Response(JSON.stringify({ error: 'Failed to generate briefing' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '{}';

      let briefingData;
      try {
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        briefingData = JSON.parse(cleanContent);
      } catch {
        briefingData = { weather: null, highlights: [], dontMiss: [] };
      }

      return new Response(JSON.stringify({
        briefing: {
          weather: briefingData.weather || null,
          todaySchedule,
          highlights: briefingData.highlights || [],
          dontMiss: briefingData.dontMiss || [],
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Only 'daily-briefing' is supported. The legacy 'predictions' mode was
    // removed (no UI surface consumed it). Reject other modes explicitly.
    return new Response(
      JSON.stringify({ error: "Unsupported mode. Only 'daily-briefing' is supported." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("mid-trip-dna error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
