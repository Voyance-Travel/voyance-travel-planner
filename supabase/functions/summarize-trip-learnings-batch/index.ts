import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_LIMIT = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find candidate trips:
    //   end_date < now() - 1 day  AND  trip_learnings.lessons_summary IS NULL
    // We left-join via two queries to keep it simple: fetch trip_learnings rows
    // that have no summary, then validate trip end_date >= cutoff.
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: learnings, error: lErr } = await supabase
      .from('trip_learnings')
      .select('trip_id, trips!inner(id, end_date)')
      .is('lessons_summary', null)
      .lt('trips.end_date', cutoffIso)
      .order('trip_id', { ascending: false })
      .limit(BATCH_LIMIT);

    if (lErr) {
      console.error('[summarize-batch] candidate query failed', lErr);
      return new Response(JSON.stringify({ error: lErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candidates = (learnings ?? []) as Array<{ trip_id: string }>;
    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ tripId: string; error: string }> = [];

    for (const row of candidates) {
      try {
        const { error } = await supabase.functions.invoke('summarize-trip-learnings', {
          body: { tripId: row.trip_id },
        });
        if (error) {
          failed++;
          failures.push({ tripId: row.trip_id, error: String(error.message || error) });
          console.error(`[summarize-batch] invoke failed for trip ${row.trip_id}`, error);
        } else {
          succeeded++;
        }
      } catch (err) {
        failed++;
        failures.push({ tripId: row.trip_id, error: String((err as Error)?.message || err) });
        console.error(`[summarize-batch] invoke threw for trip ${row.trip_id}`, err);
      }
    }

    const result = {
      scanned: candidates.length,
      invoked: candidates.length,
      succeeded,
      failed,
      failures: failures.slice(0, 10),
    };
    console.log('[summarize-batch] done', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[summarize-batch] fatal', err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
