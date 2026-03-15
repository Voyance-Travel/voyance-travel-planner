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

function generateSlug(destination: string): string {
  const base = (destination || 'travel-blog')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
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

    const { tripId, style = 'full', includedDays, socialLinks } = await req.json();
    if (!tripId) return jsonResponse({ error: 'tripId is required' }, 400);

    // Check for existing blog on this trip
    const { data: existingBlog } = await supabase
      .from('trip_blogs')
      .select('id, slug')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .maybeSingle();

    // NOTE: Credit deduction is handled client-side via spend-credits edge function
    // before invoking this function. This ensures idempotency, proper balance sync,
    // and consistency with all other credit-gated actions.

    // Fetch trip data
    const { data: trip } = await supabase
      .from('trips')
      .select('id, name, destination, start_date, end_date, travelers, trip_type, metadata, itinerary_data')
      .eq('id', tripId)
      .single();

    if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);

    // Fetch itinerary days
    const { data: days } = await supabase
      .from('itinerary_days')
      .select('*')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true });

    // Fetch trip notes
    const { data: notes } = await supabase
      .from('trip_notes')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    // Fetch trip activities
    const { data: activities } = await supabase
      .from('trip_activities')
      .select('*')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true });

    // Filter days if custom style
    let filteredDays = days || [];
    if (style === 'custom' && includedDays?.length) {
      filteredDays = filteredDays.filter((d: any) => includedDays.includes(d.day_number));
    }

    // Build trip duration
    const totalDays = filteredDays.length || 1;
    const startDate = trip.start_date ? new Date(trip.start_date) : null;
    const endDate = trip.end_date ? new Date(trip.end_date) : null;
    const tripDates = startDate && endDate
      ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : '';

    // Build prompt context
    let daysContext = '';
    for (const day of filteredDays) {
      const dayActivities = (activities || []).filter((a: any) => a.day_number === day.day_number);
      const dayNotes = (notes || []).filter((n: any) => n.day_number === day.day_number);
      
      daysContext += `\nDay ${day.day_number}${day.date ? ` — ${day.date}` : ''}${day.city ? ` — ${day.city}` : ''}:\n`;
      if (day.theme) daysContext += `  Theme: ${day.theme}\n`;
      
      for (const act of dayActivities) {
        daysContext += `  - ${act.name || act.title || 'Activity'}`;
        if (act.description) daysContext += `: ${act.description}`;
        if (act.category) daysContext += ` (${act.category})`;
        daysContext += '\n';
      }
      
      for (const note of dayNotes) {
        daysContext += `  Note [${note.note_type || 'general'}]: ${note.content}\n`;
      }
    }

    let socialContext = '';
    if (socialLinks?.length) {
      socialContext = '\nSocial media posts to include:\n';
      for (const link of socialLinks) {
        socialContext += `- ${link.platform}: ${link.url}`;
        if (link.caption) socialContext += ` — "${link.caption}"`;
        if (link.dayNumber) socialContext += ` (Day ${link.dayNumber})`;
        socialContext += '\n';
      }
    }

    const highlightsStyle = style === 'highlights'
      ? '\nFocus only on the most memorable and highest-rated moments. Skip routine activities.\n'
      : '';

    const systemPrompt = `You are a travel writer creating a personal blog post. Return ONLY a JSON object with a "blocks" key containing an array of content blocks.`;

    const userPrompt = `Write an engaging first-person travel blog about a trip to ${trip.destination || 'a beautiful destination'}.

Trip: ${trip.name}
Destination: ${trip.destination || 'Unknown'}
Dates: ${tripDates || 'Recent trip'}
Duration: ${totalDays} days
Travelers: ${trip.travelers || 1}
${highlightsStyle}

Itinerary:
${daysContext || 'No detailed itinerary available.'}
${socialContext}

Guidelines:
1. Write in warm, conversational first person
2. Organize by day with day_divider blocks
3. Weave activities into narrative paragraphs (don't just list)
4. Use highlight blocks for standout moments
5. Include social_embed blocks where social links naturally fit
6. Add practical travel tips as tip blocks
7. End with a reflective conclusion
8. Keep between 800-2000 words total

Output a JSON object: { "blocks": [...] }
Block types:
- { "type": "heading", "text": "...", "level": 1|2|3 }
- { "type": "paragraph", "text": "..." }
- { "type": "highlight", "activity": "...", "description": "...", "rating": 1-5, "dayNumber": N }
- { "type": "social_embed", "platform": "instagram"|"tiktok"|"youtube"|"twitter", "url": "...", "caption": "..." }
- { "type": "tip", "text": "...", "category": "food|transport|lodging|activity|general" }
- { "type": "day_divider", "dayNumber": N, "date": "March 3", "city": "Paris" }
- { "type": "quote", "text": "...", "attribution": "..." }
- { "type": "note", "text": "...", "noteType": "memory|tip|discovery" }

Do NOT include photo blocks. Keep total length 800-2000 words.`;

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
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[generate-travel-blog] AI error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return jsonResponse({ error: 'AI rate limited, please try again shortly' }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: 'AI service payment required' }, 402);
      }
      return jsonResponse({ error: 'AI generation failed' }, 500);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '{}';
    
    let blocks: any[] = [];
    try {
      const parsed = JSON.parse(rawContent);
      blocks = parsed.blocks || parsed.content || [];
    } catch {
      console.error('[generate-travel-blog] Failed to parse AI response:', rawContent.slice(0, 500));
      blocks = [{ type: 'paragraph', text: 'Blog generation completed but content parsing failed. Please try again.' }];
    }

    // Generate title from AI or trip name
    const titleBlock = blocks.find((b: any) => b.type === 'heading' && b.level === 1);
    const title = titleBlock?.text || `My Trip to ${trip.destination || 'Adventure'}`;

    const slug = existingBlog?.slug || generateSlug(trip.destination || 'travel');

    // Upsert blog
    const blogData = {
      trip_id: tripId,
      user_id: userId,
      title,
      content: blocks,
      social_links: socialLinks || [],
      slug,
      status: 'draft' as const,
      destination: trip.destination,
      trip_dates: tripDates,
      traveler_count: trip.travelers || 1,
      trip_duration_days: totalDays,
      updated_at: new Date().toISOString(),
    };

    let blogId: string;

    if (existingBlog) {
      const { error: updateErr } = await supabase
        .from('trip_blogs')
        .update(blogData)
        .eq('id', existingBlog.id);
      if (updateErr) throw updateErr;
      blogId = existingBlog.id;
    } else {
      const { data: newBlog, error: insertErr } = await supabase
        .from('trip_blogs')
        .insert(blogData)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      blogId = newBlog.id;
    }

    return jsonResponse({ success: true, blogId, slug });
  } catch (err) {
    console.error('[generate-travel-blog] Error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
