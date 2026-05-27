/**
 * heal-trip-preferences
 *
 * Lazy backfill for legacy trips that have Step-3 preference metadata
 * (mustDoActivities / additionalNotes / perDayActivities / userAnchors /
 * userConstraints) but zero active `trip_day_intents` rows — i.e. the
 * "Canonical Preference Spine" seeder never ran for them.
 *
 * Owner-visit callable; safe to invoke repeatedly. Returns the seed audit
 * plus a small report of what was discovered. NEVER mutates `trips.itinerary_data`.
 *
 * Single-trip mode: { tripId }
 * Batch mode:       { batch: true, limit?: number }  (owner-only across THEIR trips)
 *
 * See mem://constraints/itinerary/canonical-preference-spine.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  hasPreferenceMetadata,
  seedDayIntentsFromMetadata,
} from '../_shared/day-intents-store.ts';

interface HealResult {
  tripId: string;
  skipped?: string;
  expectsRows?: boolean;
  existingActive?: number;
  audit?: unknown;
}

async function healOne(
  supabase: ReturnType<typeof createClient>,
  tripId: string,
  ownerId: string,
): Promise<HealResult> {
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, user_id, metadata, start_date, end_date')
    .eq('id', tripId)
    .maybeSingle();

  if (tripErr || !trip) return { tripId, skipped: 'trip_not_found' };
  if (trip.user_id !== ownerId) return { tripId, skipped: 'not_owner' };

  const expectsRows = hasPreferenceMetadata(trip.metadata as Record<string, unknown> | null);
  if (!expectsRows) return { tripId, skipped: 'no_preference_metadata', expectsRows: false };

  const { count: existingActive } = await supabase
    .from('trip_day_intents')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('status', 'active');

  if ((existingActive ?? 0) > 0) {
    return { tripId, skipped: 'already_seeded', expectsRows: true, existingActive: existingActive ?? 0 };
  }

  // Compute totalDays from start/end if available; default to 1.
  let totalDays = 1;
  if (trip.start_date && trip.end_date) {
    const s = new Date(String(trip.start_date)).getTime();
    const e = new Date(String(trip.end_date)).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
      totalDays = Math.max(1, Math.round((e - s) / 86400000) + 1);
    }
  }

  const audit = await seedDayIntentsFromMetadata(supabase, trip as any, totalDays, ownerId);
  console.log(`[heal-trip-preferences] trip=${tripId} totalDays=${totalDays} audit=${JSON.stringify(audit)}`);
  return { tripId, expectsRows: true, existingActive: 0, audit };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const ownerId = userRes.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({})) as { tripId?: string; batch?: boolean; limit?: number };

    if (body.batch === true) {
      const limit = Math.max(1, Math.min(50, body.limit ?? 10));
      const { data: trips } = await admin
        .from('trips')
        .select('id')
        .eq('user_id', ownerId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      const results: HealResult[] = [];
      for (const t of trips ?? []) {
        results.push(await healOne(admin, (t as { id: string }).id, ownerId));
      }
      return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.tripId) {
      return new Response(JSON.stringify({ error: 'tripId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await healOne(admin, body.tripId, ownerId);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[heal-trip-preferences] error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
