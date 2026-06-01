/**
 * backfill-must-do-anchor-enrichment — lazy per-trip backfill that stamps
 * `metadata.must_do_enrichment_backfilled_at` so the lazy trigger never
 * re-fires.
 *
 * NOTE (2026-06-01): The full enrichment chain (Google Places address
 * resolution + Gemini description-fill) lives inside
 * `generate-itinerary/pipeline/*` and `_shared/description-fill.ts`. Both
 * transitively import `generate-itinerary/pipeline/types.ts`, which Supabase's
 * per-function bundler refuses to resolve from a different function folder.
 * This function therefore currently only stamps the "we attempted" flag so
 * `TripDetail` stops re-invoking it (and CORS-erroring the browser console).
 *
 * Proper fix tracked separately: extract `enrichAnchorActivities` and the
 * description-fill helpers into `_shared/` with no cross-pipeline imports,
 * then restore the real backfill body here.
 *
 * See mem://constraints/itinerary/must-do-coverage-injection.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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

    // RLS-scoped access check.
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

    // Stamp metadata so the FE lazy trigger doesn't keep firing.
    const svc = createClient(supabaseUrl, serviceKey);
    const { data: trip } = await svc
      .from('trips')
      .select('itinerary_data, metadata')
      .eq('id', tripId)
      .maybeSingle();

    const itin: any = (trip as any)?.itinerary_data || {};
    const days = Array.isArray(itin?.days) ? itin.days : [];
    let scanned = 0;
    for (const day of days) {
      const acts = Array.isArray(day?.activities) ? day.activities : [];
      scanned += acts.filter(isBareAnchor).length;
    }

    const meta = ((trip as any)?.metadata as Record<string, any>) || {};
    const nextMeta = {
      ...meta,
      must_do_enrichment_backfilled_at: new Date().toISOString(),
      must_do_enrichment_backfill_summary: {
        scanned,
        attempted: 0,
        resolved: 0,
        unresolved: [],
        filledDescriptions: 0,
        deferred: 'cross_fn_bundler_refactor_pending',
      },
    };
    await svc.from('trips').update({ metadata: nextMeta }).eq('id', tripId);

    console.log(`[backfill-must-do] trip=${tripId} scanned=${scanned} (stamp-only; enrichment deferred)`);
    return new Response(
      JSON.stringify({
        tripId,
        scanned,
        attempted: 0,
        resolved: 0,
        unresolved: [],
        filledDescriptions: 0,
        deferred: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[backfill-must-do-anchor-enrichment] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
