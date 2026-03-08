import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateSlug(destination: string, handle?: string): string {
  const base = (destination || 'travel-guide')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  const handlePart = handle
    ? `-${handle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 15)}`
    : '';
  const suffix = Date.now().toString(36);
  return `${base}${handlePart}-${suffix}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const { tripId, selectedActivityIds, includeNotes, includeHotel, includeFlights } = await req.json();
    if (!tripId) return jsonResponse({ error: 'tripId is required' }, 400);

    // Deduct credits
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: deductResult, error: deductError } = await adminClient.rpc('deduct_credits_fifo', {
      p_user_id: userId,
      p_cost: 15,
    });

    if (deductError) {
      const msg = deductError.message || '';
      if (msg.includes('INSUFFICIENT_CREDITS')) {
        return jsonResponse({ error: 'Insufficient credits', required: 15 }, 402);
      }
      throw deductError;
    }

    // Log credit spend
    await adminClient.from('credit_ledger').insert({
      user_id: userId,
      transaction_type: 'spend',
      action_type: 'generate_travel_guide',
      credits_delta: -15,
      is_free_credit: false,
      notes: `Travel guide generation for trip ${tripId}`,
    });

    // Sync balance cache
    const now = new Date().toISOString();
    await adminClient.from('credit_balances').update({
      purchased_credits: (await adminClient.from('credit_purchases')
        .select('remaining')
        .eq('user_id', userId)
        .gt('remaining', 0)
        .neq('credit_type', 'free')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
      ).data?.reduce((sum: number, r: any) => sum + r.remaining, 0) || 0,
      free_credits: (await adminClient.from('credit_purchases')
        .select('remaining')
        .eq('user_id', userId)
        .gt('remaining', 0)
        .eq('credit_type', 'free')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
      ).data?.reduce((sum: number, r: any) => sum + r.remaining, 0) || 0,
      updated_at: now,
    }).eq('user_id', userId);

    // Fetch trip data
    const { data: trip } = await supabase
      .from('trips')
      .select('id, name, destination, start_date, end_date, travelers, trip_type, metadata, itinerary_data')
      .eq('id', tripId)
      .single();

    if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);

    // Fetch user profile for slug
    const { data: profile } = await supabase
      .from('profiles')
      .select('handle, display_name')
      .eq('id', userId)
      .single();

    // Fetch itinerary days
    const { data: days } = await supabase
      .from('itinerary_days')
      .select('*')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true });

    // Fetch trip notes
    const { data: notes } = includeNotes !== false
      ? await supabase.from('trip_notes').select('*').eq('trip_id', tripId).order('created_at', { ascending: true })
      : { data: [] };

    // Fetch trip activities
    let activitiesQuery = supabase
      .from('trip_activities')
      .select('*')
      .eq('trip_id', tripId)
      .order('start_time', { ascending: true });

    const { data: allActivities } = await activitiesQuery;

    // Filter to selected activities if provided
    const activities = selectedActivityIds?.length
      ? (allActivities || []).filter((a: any) => selectedActivityIds.includes(a.id))
      : allActivities || [];

    // Build dates
    const startDate = trip.start_date ? new Date(trip.start_date) : null;
    const endDate = trip.end_date ? new Date(trip.end_date) : null;
    const tripDates = startDate && endDate
      ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : '';

    // Group activities by day
    let daysContext = '';
    for (const day of (days || [])) {
      const dayActivities = activities.filter((a: any) => a.itinerary_day_id === day.id);
      if (dayActivities.length === 0) continue;

      daysContext += `\nDay ${day.day_number}${day.date ? ` — ${day.date}` : ''}${day.title ? ` — ${day.title}` : ''}:\n`;
      if (day.theme) daysContext += `  Theme: ${day.theme}\n`;

      for (const act of dayActivities) {
        daysContext += `  - ${act.title || act.name || 'Activity'}`;
        if (act.description) daysContext += `: ${act.description}`;
        if (act.type) daysContext += ` [${act.type}]`;
        if (act.start_time) daysContext += ` at ${act.start_time}`;
        daysContext += '\n';
      }
    }

    // Also include activities not matched to days
    const unmatchedActivities = activities.filter((a: any) =>
      !days?.some((d: any) => d.id === a.itinerary_day_id)
    );
    if (unmatchedActivities.length > 0) {
      daysContext += '\nAdditional activities:\n';
      for (const act of unmatchedActivities) {
        daysContext += `  - ${act.title || 'Activity'}`;
        if (act.description) daysContext += `: ${act.description}`;
        if (act.type) daysContext += ` [${act.type}]`;
        daysContext += '\n';
      }
    }

    let notesContext = '';
    if (includeNotes !== false && notes?.length) {
      notesContext = '\nMy personal notes:\n';
      for (const note of notes) {
        notesContext += `- [${note.note_type || 'general'}] ${note.content}\n`;
      }
    }

    // Hotel/flight info from metadata or itinerary_data
    let hotelContext = '';
    let flightContext = '';
    if (includeHotel !== false && trip.metadata) {
      const meta = typeof trip.metadata === 'string' ? JSON.parse(trip.metadata) : trip.metadata;
      if (meta?.hotel) hotelContext = `\nWhere I stayed: ${JSON.stringify(meta.hotel)}\n`;
    }
    if (includeFlights !== false && trip.metadata) {
      const meta = typeof trip.metadata === 'string' ? JSON.parse(trip.metadata) : trip.metadata;
      if (meta?.flights) flightContext = `\nHow I got there: ${JSON.stringify(meta.flights)}\n`;
    }

    const systemPrompt = `You are a travel writer creating a personal travel guide. Write in first person, warm and conversational. Include practical tips, honest opinions, and personal touches. Structure it as a readable guide with sections for each day. Output in markdown format.`;

    const userPrompt = `Create a travel guide for my trip to ${trip.destination || 'a beautiful destination'} (${tripDates || 'recent trip'}).

Selected activities by day:
${daysContext || 'No detailed activities available.'}
${notesContext}${hotelContext}${flightContext}

Write a personal travel guide with:
1. A catchy title (as # heading)
2. Brief intro about the trip
3. Day-by-day breakdown with honest commentary (## headings per day)
4. Practical tips section (## Tips)
5. "Would I go back?" conclusion

Keep it personal and authentic. Use the activity descriptions and my notes to add color. Write 800-1500 words.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: 'AI service not configured' }, 500);
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[generate-travel-guide] AI error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return jsonResponse({ error: 'AI rate limited, please try again shortly' }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: 'AI service payment required' }, 402);
      }
      return jsonResponse({ error: 'AI generation failed' }, 500);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Extract title from first markdown heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1] || `My ${trip.destination || 'Travel'} Guide`;

    // Check for existing guide
    const { data: existingGuide } = await supabase
      .from('travel_guides')
      .select('id, slug')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .maybeSingle();

    const slug = existingGuide?.slug || generateSlug(trip.destination || 'travel', profile?.handle);

    const guideData = {
      trip_id: tripId,
      user_id: userId,
      title,
      content,
      slug,
      destination: trip.destination || '',
      status: 'draft',
      selected_activities: selectedActivityIds || [],
      updated_at: new Date().toISOString(),
    };

    let guideId: string;

    if (existingGuide) {
      const { error: updateErr } = await supabase
        .from('travel_guides')
        .update(guideData)
        .eq('id', existingGuide.id);
      if (updateErr) throw updateErr;
      guideId = existingGuide.id;
    } else {
      const { data: newGuide, error: insertErr } = await supabase
        .from('travel_guides')
        .insert(guideData)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      guideId = newGuide.id;
    }

    return jsonResponse({ success: true, guideId, slug, content, title });
  } catch (err) {
    console.error('[generate-travel-guide] Error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
