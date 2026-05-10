import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_LIMIT = 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Users with feedback in the last 7 days
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentFeedback, error: fbErr } = await supabase
      .from('activity_feedback')
      .select('user_id, created_at')
      .gte('created_at', sinceIso);

    if (fbErr) {
      console.error('[trait-drift-batch] feedback query failed', fbErr);
      return new Response(JSON.stringify({ error: 'feedback query failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Newest feedback per user
    const newestByUser = new Map<string, string>();
    for (const r of recentFeedback || []) {
      const cur = newestByUser.get(r.user_id);
      if (!cur || r.created_at > cur) newestByUser.set(r.user_id, r.created_at);
    }
    const userIds = [...newestByUser.keys()];
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ scanned: 0, invoked: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pull most recent drift run per user (1 query, in-memory dedupe)
    const { data: drifts } = await supabase
      .from('trait_drift_log')
      .select('user_id, ran_at')
      .in('user_id', userIds)
      .order('ran_at', { ascending: false });

    const lastDrift = new Map<string, string>();
    for (const d of drifts || []) {
      if (!lastDrift.has(d.user_id)) lastDrift.set(d.user_id, d.ran_at);
    }

    const targets = userIds
      .filter(uid => {
        const last = lastDrift.get(uid);
        const newest = newestByUser.get(uid)!;
        return !last || newest > last;
      })
      .slice(0, BATCH_LIMIT);

    let invoked = 0, succeeded = 0, failed = 0;
    const failures: Array<{ userId: string; status?: number; error?: string }> = [];

    for (const userId of targets) {
      invoked++;
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/recompute-trait-drift`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ userId }),
        });
        if (r.ok) succeeded++;
        else { failed++; failures.push({ userId, status: r.status }); }
      } catch (err) {
        failed++;
        failures.push({ userId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    console.log(`[trait-drift-batch] scanned=${userIds.length} targets=${targets.length} succeeded=${succeeded} failed=${failed}`);

    return new Response(
      JSON.stringify({ scanned: userIds.length, invoked, succeeded, failed, failures }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[trait-drift-batch] unexpected', err);
    return new Response(
      JSON.stringify({ error: 'unexpected', message: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
