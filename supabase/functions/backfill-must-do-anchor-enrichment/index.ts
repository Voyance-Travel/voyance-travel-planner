/**
 * backfill-must-do-anchor-enrichment — lazy per-trip backfill that resolves
 * bare must-do anchor cards (source:'must-do-injection' + empty address +
 * empty description) using the same Google Places + description-fill chain
 * that fresh generation now runs post-injection.
 *
 * Called once-per-trip-per-session from TripDetail.tsx on mount when a trip
 * carries any bare injected anchor. Stamps
 * `metadata.must_do_enrichment_backfilled_at` so the lazy trigger never
 * re-fires.
 *
 * Mirrors `heal-trip-chronology/index.ts` shape: user-auth check, RLS-scoped
 * access check, service-role write that bypasses Frozen-After-Ready.
 *
 * See mem://constraints/itinerary/must-do-coverage-injection.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { fillMissingDescriptions } from '../_shared/description-fill.ts';

// NOTE: Cross-function imports (../generate-itinerary/pipeline/enrich-day.ts)
// don't survive Supabase's per-function bundler — only `_shared/*` is portable.
// This backfill therefore handles the description-fill half only (the most
// user-visible symptom of bare must-do anchors). Google-Places address
// resolution requires extracting `enrichAnchorActivities` into `_shared` and
// is tracked as follow-up work.

interface ReqBody {
  tripId?: string;
}

function isBareAnchor(a: any): boolean {
  const src = String(a?.source || '').toLowerCase();
  if (src !== 'must-do-injection') return false;
  const addr = String(a?.location?.address || '').trim();
  const desc = String(a?.description || '').trim();
  return addr.length === 0 && desc.length === 0;
}

async function backfillOne(
  svc: ReturnType<typeof createClient>,
  tripId: string,
  env: { gMapsKey: string; lovableKey: string; supaUrl: string; supaKey: string },
): Promise<{
  tripId: string;
  scanned: number;
  attempted: number;
  resolved: number;
  unresolved: string[];
  filledDescriptions: number;
  skipped?: string;
}> {
  const { data: trip, error } = await svc
    .from('trips')
    .select('id, destination, itinerary_data, metadata, hotel_selection')
    .eq('id', tripId)
    .maybeSingle();
  if (error || !trip) {
    return { tripId, scanned: 0, attempted: 0, resolved: 0, unresolved: [], filledDescriptions: 0, skipped: 'not_found' };
  }
  const itin: any = trip.itinerary_data || {};
  const days = Array.isArray(itin?.days) ? itin.days : [];
  if (days.length === 0) {
    return { tripId, scanned: 0, attempted: 0, resolved: 0, unresolved: [], filledDescriptions: 0, skipped: 'no_days' };
  }

  let totalScanned = 0;
  let totalAttempted = 0;
  let totalResolved = 0;
  const unresolved: string[] = [];
  let totalFilledDesc = 0;

  const destination = String((trip as any).destination || '');
  const hotelSel: any = (trip as any).hotel_selection || {};
  const hotelCoords =
    hotelSel?.coordinates && typeof hotelSel.coordinates.lat === 'number'
      ? { lat: hotelSel.coordinates.lat, lng: hotelSel.coordinates.lng }
      : undefined;

  for (const day of days) {
    const acts = Array.isArray(day?.activities) ? day.activities : [];
    const bareCount = acts.filter(isBareAnchor).length;
    if (bareCount === 0) continue;
    totalScanned += bareCount;

    // Google-Places address resolution is deferred (see top-of-file note).
    // Fill descriptions for bare anchors — biggest visible win.
    try {
      const before = acts.filter(
        (a: any) =>
          String(a?.source || '') === 'must-do-injection' &&
          !(a?.description || '').trim(),
      ).length;
      totalAttempted += before;
      await fillMissingDescriptions(acts, destination, env.lovableKey || undefined, Number(day?.dayNumber) || 0);
      const after = acts.filter(
        (a: any) =>
          String(a?.source || '') === 'must-do-injection' &&
          !(a?.description || '').trim(),
      ).length;
      const filled = Math.max(0, before - after);
      totalFilledDesc += filled;
      totalResolved += filled;
      // Track titles still bare for telemetry
      for (const a of acts) {
        if (
          String(a?.source || '') === 'must-do-injection' &&
          !(a?.description || '').trim()
        ) {
          const title = String(a?.title || a?.name || '').trim();
          if (title) unresolved.push(title);
        }
      }
    } catch (descErr) {
      console.warn(`[backfill-must-do] description-fill failed day=${day?.dayNumber}:`, descErr instanceof Error ? descErr.message : String(descErr));
    }
  }

  const meta = ((trip as any).metadata as Record<string, any>) || {};
  const nextMeta = {
    ...meta,
    must_do_enrichment_backfilled_at: new Date().toISOString(),
    must_do_enrichment_backfill_summary: {
      scanned: totalScanned,
      attempted: totalAttempted,
      resolved: totalResolved,
      unresolved,
      filledDescriptions: totalFilledDesc,
    },
  };

  // Only write itinerary_data if anything actually changed — otherwise just
  // stamp metadata so we never re-fire.
  if (totalResolved > 0 || totalFilledDesc > 0) {
    const healedItin = { ...itin, days };
    const { error: upErr } = await svc
      .from('trips')
      .update({ itinerary_data: healedItin, metadata: nextMeta })
      .eq('id', tripId);
    if (upErr) {
      console.warn(`[backfill-must-do] persist failed trip=${tripId}:`, upErr);
      return { tripId, scanned: totalScanned, attempted: totalAttempted, resolved: totalResolved, unresolved, filledDescriptions: totalFilledDesc, skipped: 'persist_failed' };
    }
  } else {
    await svc.from('trips').update({ metadata: nextMeta }).eq('id', tripId);
  }

  console.log(
    `[backfill-must-do] trip=${tripId} scanned=${totalScanned} attempted=${totalAttempted} resolved=${totalResolved} filledDesc=${totalFilledDesc} unresolved=${unresolved.length}`,
  );
  return { tripId, scanned: totalScanned, attempted: totalAttempted, resolved: totalResolved, unresolved, filledDescriptions: totalFilledDesc };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const gMapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
    const lovableKey = Deno.env.get('LOVABLE_API_KEY') || '';

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authUser } = await authClient.auth.getUser();
    if (!authUser?.user?.id) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
    if (!tripId || !/^[0-9a-f-]{36}$/i.test(tripId)) {
      return new Response(JSON.stringify({ error: 'invalid tripId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RLS-scoped access check before service-role write.
    const { data: accessOk, error: accessErr } = await authClient
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .maybeSingle();
    if (accessErr || !accessOk) {
      return new Response(JSON.stringify({ error: 'trip not found or no access' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const svc = createClient(supabaseUrl, serviceKey);
    const result = await backfillOne(svc, tripId, {
      gMapsKey,
      lovableKey,
      supaUrl: supabaseUrl,
      supaKey: serviceKey,
    });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[backfill-must-do-anchor-enrichment] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
