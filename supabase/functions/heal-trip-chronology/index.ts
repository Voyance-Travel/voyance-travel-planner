/**
 * heal-trip-chronology — one-shot per-trip (or batch) legacy chronology
 * backfill. Runs the canonical `validateChronology` over `trips.itinerary_data`
 * and persists the healed snapshot via the integrity-heal save path so
 * frozen-after-ready trips aren't blocked.
 *
 * Modes:
 *   • { tripId }  → heal a single trip (called lazily from TripDetail mount)
 *   • { batch:true, limit?:N } → service-role batch over recent ready trips
 *     (admin/cron use; capped to 50 by default)
 *
 * Always stamps `metadata.chronology_healed_at` so the lazy trigger never
 * re-fires for the same trip.
 *
 * See mem://constraints/itinerary/chronology-validator-three-gates.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { validateChronology } from '../_shared/chronology-validator.ts';

interface ReqBody {
  tripId?: string;
  batch?: boolean;
  limit?: number;
}

async function healOne(
  svc: ReturnType<typeof createClient>,
  tripId: string,
): Promise<{
  tripId: string;
  healed: boolean;
  sortedDays: number;
  dropped: number;
  criticalAfterHeal: boolean;
  skipped?: string;
}> {
  const { data: trip, error } = await svc
    .from('trips')
    .select('id, itinerary_data, metadata')
    .eq('id', tripId)
    .maybeSingle();
  if (error || !trip) {
    return { tripId, healed: false, sortedDays: 0, dropped: 0, criticalAfterHeal: false, skipped: 'not_found' };
  }
  const itin: any = trip.itinerary_data || {};
  const days = Array.isArray(itin?.days) ? itin.days : [];
  if (days.length === 0) {
    return { tripId, healed: false, sortedDays: 0, dropped: 0, criticalAfterHeal: false, skipped: 'no_days' };
  }

  const v = validateChronology(days, { site: 'heal-trip-chronology' });
  const meta = (trip.metadata as Record<string, any>) || {};
  const nextMeta = {
    ...meta,
    chronology_healed_at: new Date().toISOString(),
    chronology_heal_summary: {
      sortedDays: v.sortedDayCount,
      dropped: v.droppedCount,
      criticalAfterHeal: v.criticalAfterHeal,
      remaining: v.remainingIssues.length,
    },
  };

  if (!v.healed) {
    // Still stamp so we don't keep re-checking on every mount.
    await svc.from('trips').update({ metadata: nextMeta }).eq('id', tripId);
    return { tripId, healed: false, sortedDays: 0, dropped: 0, criticalAfterHeal: v.criticalAfterHeal };
  }

  const healedItin = { ...itin, days: v.days };

  // Direct service-role write — bypasses frozen-guard. Mirrors the
  // self-heal-chronology allowlist entry but at the edge boundary.
  const { error: upErr } = await svc
    .from('trips')
    .update({ itinerary_data: healedItin, metadata: nextMeta })
    .eq('id', tripId);
  if (upErr) {
    console.warn(`[heal-trip-chronology] persist failed trip=${tripId}:`, upErr);
    return { tripId, healed: false, sortedDays: v.sortedDayCount, dropped: v.droppedCount, criticalAfterHeal: v.criticalAfterHeal, skipped: 'persist_failed' };
  }

  console.log(
    `[heal-trip-chronology] trip=${tripId} sortedDays=${v.sortedDayCount} dropped=${v.droppedCount} criticalAfterHeal=${v.criticalAfterHeal}`,
  );
  return { tripId, healed: true, sortedDays: v.sortedDayCount, dropped: v.droppedCount, criticalAfterHeal: v.criticalAfterHeal };
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

    // Verify the caller is a real user (RLS-scoped to enforce trip access on
    // the single-trip path). Batch mode requires the same user auth — it's
    // simply scoped to trips the user already owns/collaborates on.
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

    const svc = createClient(supabaseUrl, serviceKey);

    if (body.batch === true) {
      const limit = Math.min(Math.max(body.limit ?? 25, 1), 50);
      // RLS-scoped list so a user can only batch-heal their own trips.
      const { data: trips, error: listErr } = await authClient
        .from('trips')
        .select('id, metadata, itinerary_status, updated_at')
        .in('itinerary_status', ['ready', 'generated'])
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const candidates = (trips || []).filter(
        (t: any) => !((t.metadata as any)?.chronology_healed_at),
      );
      const results = [];
      for (const t of candidates) {
        results.push(await healOne(svc, (t as any).id));
      }
      return new Response(
        JSON.stringify({ scanned: trips?.length ?? 0, processed: results.length, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
    if (!tripId || !/^[0-9a-f-]{36}$/i.test(tripId)) {
      return new Response(JSON.stringify({ error: 'invalid tripId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enforce trip access via RLS read before service-role write.
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

    const result = await healOne(svc, tripId);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[heal-trip-chronology] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
