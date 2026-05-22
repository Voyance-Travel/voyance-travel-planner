/**
 * backfill-trip-intents — one-shot per-trip backfill of `trip_day_intents`
 * from legacy `trips.metadata.{mustDoActivities,perDayActivities,userAnchors,
 * additionalNotes,userConstraints}`.
 *
 * Trips generated before `seedDayIntentsFromMetadata` was wired into the
 * server-chain path have an empty `trip_day_intents` table even though their
 * start-form must-dos sit in metadata. Without intents:
 *   - compile-prompt skips USER WISHES injection
 *   - ledger-check can't flag missing_user_intent_soft
 *   - any future regen / chat-action will silently re-drop the must-dos
 *
 * Triggered lazily from `TripDetail.tsx` on mount, gated by a one-time
 * `metadata.intents_backfilled_at` stamp so it never runs twice. Authed via
 * the caller's user JWT; ownership/collaborator-membership enforced via RLS
 * on both `trip_day_intents` and `trips`.
 *
 * Returns `{ seeded: N, alreadyHadRows: K, skipped: bool }`.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { seedDayIntentsFromMetadata, reconcileFulfillment } from '../_shared/day-intents-store.ts';

interface ReqBody {
  tripId: string;
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

    const body = (await req.json().catch(() => ({}))) as Partial<ReqBody>;
    const tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
    if (!tripId || !/^[0-9a-f-]{36}$/i.test(tripId)) {
      return new Response(JSON.stringify({ error: 'invalid tripId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authed client to enforce the caller actually has access to this trip
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

    // Ownership / membership read via RLS-scoped client
    const { data: trip, error: tripErr } = await authClient
      .from('trips')
      .select('id, user_id, metadata, start_date, end_date, destination, itinerary_data')
      .eq('id', tripId)
      .maybeSingle();
    if (tripErr || !trip) {
      return new Response(JSON.stringify({ error: 'trip not found or no access' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const meta = (trip.metadata as Record<string, any>) || {};
    if (meta.intents_backfilled_at) {
      return new Response(JSON.stringify({ skipped: true, reason: 'already backfilled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role for trip_day_intents writes (table is owner-scoped)
    const svc = createClient(supabaseUrl, serviceKey);

    const { count: existingCount } = await svc
      .from('trip_day_intents')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId);

    let seeded = 0;
    if ((existingCount ?? 0) === 0) {
      const days = Array.isArray((trip.itinerary_data as any)?.days)
        ? (trip.itinerary_data as any).days
        : [];
      const totalDays = days.length || 1;
      seeded = await seedDayIntentsFromMetadata(svc, trip as any, totalDays, trip.user_id);

      // Mark fulfilled intents by scanning persisted activities
      if (seeded > 0 && days.length > 0) {
        try {
          const daysWithActivities = days.map((d: any, i: number) => ({
            dayNumber: i + 1,
            activities: Array.isArray(d?.activities) ? d.activities : [],
          }));
          await reconcileFulfillment(svc, tripId, daysWithActivities);
        } catch (e) {
          console.warn('[backfill-trip-intents] reconcile failed (non-blocking):', String(e));
        }
      }
    }

    // Stamp so we never re-run, even when no rows seeded (metadata was empty)
    await svc
      .from('trips')
      .update({
        metadata: {
          ...meta,
          intents_backfilled_at: new Date().toISOString(),
          intents_backfill_seeded: seeded,
        },
      })
      .eq('id', tripId);

    console.log(`[backfill-trip-intents] trip=${tripId} existing=${existingCount} seeded=${seeded}`);

    return new Response(
      JSON.stringify({ seeded, alreadyHadRows: existingCount ?? 0, skipped: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[backfill-trip-intents] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
