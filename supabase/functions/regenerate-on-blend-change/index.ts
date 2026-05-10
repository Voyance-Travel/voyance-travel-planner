// Triggers a blended regeneration of an already-generated trip after a new
// collaborator joins. The joiner does not have a proof-of-charge row, so this
// function gates authorization itself, then chains into `generate-itinerary`
// with the trip owner's userId via service-role bypass (no extra credits charged).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Auth: validate caller JWT ───────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    // ── Body validation ─────────────────────────────────────────────────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const tripId = typeof body?.tripId === 'string' ? body.tripId : null;
    if (!tripId || !UUID_RE.test(tripId)) {
      return new Response(JSON.stringify({ error: 'tripId (uuid) required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Load trip ──────────────────────────────────────────────────────────
    const { data: trip, error: tripErr } = await admin
      .from('trips')
      .select('id, user_id, itinerary_status')
      .eq('id', tripId)
      .maybeSingle();

    if (tripErr || !trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Authorization: caller must be owner OR accepted collaborator ───────
    let authorized = trip.user_id === callerId;
    if (!authorized) {
      const { data: collab } = await admin
        .from('trip_collaborators')
        .select('user_id, accepted_at')
        .eq('trip_id', tripId)
        .eq('user_id', callerId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      authorized = !!collab;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Idempotency: only regenerate trips currently 'ready' ───────────────
    if (trip.itinerary_status !== 'ready') {
      console.log(`[regenerate-on-blend-change] Skip — itinerary_status=${trip.itinerary_status}`);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: trip.itinerary_status === 'generating' ? 'in_progress' : 'not_ready' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Flip to 'generating' immediately so the trip detail UI shows progress.
    await admin
      .from('trips')
      .update({ itinerary_status: 'generating' as any })
      .eq('id', tripId);

    // ── System-attributed proof-of-charge row (0 credits) ──────────────────
    // Belt-and-braces: handleGenerateTrip is called via service-role bypass
    // which already skips the gate, but recording the system action helps audit.
    await admin.from('pending_credit_charges').insert({
      user_id: trip.user_id,
      trip_id: tripId,
      action: 'trip_generation',
      credits_amount: 0,
      status: 'completed',
      resolved_at: new Date().toISOString(),
      metadata: { source: 'regenerate_on_blend_change', triggered_by: callerId } as any,
    } as any);

    console.log(`[regenerate-on-blend-change] Triggering regen tripId=${tripId} owner=${trip.user_id} triggeredBy=${callerId}`);

    // ── Chain to generate-itinerary via service-role bypass ─────────────────
    // Fire-and-forget: the upstream call runs to completion in its own
    // request lifecycle. We respond to the joiner immediately.
    const chainUrl = `${supabaseUrl}/functions/v1/generate-itinerary`;
    fetch(chainUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        action: 'generate-trip',
        tripId,
        userId: trip.user_id, // owner — group blending pulls collaborators automatically
        mode: 'regenerate',
      }),
    }).catch((err) => {
      console.error('[regenerate-on-blend-change] Chain invoke failed:', err);
    });

    return new Response(
      JSON.stringify({ ok: true, queued: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[regenerate-on-blend-change] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
