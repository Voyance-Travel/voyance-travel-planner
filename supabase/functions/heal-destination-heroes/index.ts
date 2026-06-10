/**
 * heal-destination-heroes
 * ----------------------------------------------------------------------------
 * One-shot (re-runnable) backfill that repairs `destinations.hero_image_url`
 * rows left pointing at the dead OLD Lovable host (or NULL) after the Supabase
 * migration. For each destination needing a hero, it invokes the
 * `destination-images` function (which fetches a POI photo via Google Places and
 * stores it on the NEW host), then writes the returned new-host URL back to
 * `destinations.hero_image_url`. Idempotent: a healed row no longer matches the
 * filter, so re-running only processes what's still broken.
 *
 * POST body (all optional):
 *   { mode?: 'oldhost' | 'null',   // 'oldhost' (default): the visibly-broken
 *                                   //   old-host rows (~33). 'null': backfill
 *                                   //   rows with no hero yet (~2k).
 *     cities?: string[],           // explicit city list (overrides mode)
 *     limit?: number,              // rows per run (default 30, max 100)
 *     dryRun?: boolean }           // report only, don't write
 *
 * Deploy:  supabase functions deploy heal-destination-heroes --no-verify-jwt
 * Run:     invoke with {} to heal the old-host batch; repeat until processed=0.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OLD_HOST = 'jsxplunjjvxuejeouwob';

// A hero URL we can actually keep: not the dead old host, not raw Unsplash
// (the policy rejects it), not a data:-URI gradient fallback.
function isHealedUrl(url: unknown): url is string {
  if (!url || typeof url !== 'string') return false;
  if (url.includes(OLD_HOST)) return false;
  if (/images\.unsplash\.com|source\.unsplash\.com/i.test(url)) return false;
  if (url.startsWith('data:')) return false;
  return /^https?:\/\//i.test(url);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    // skipCache forces a live Google+Unsplash fetch+upload per city (~3-8s), so
    // keep batches small — a big batch overruns the edge wall-clock and the
    // function gets killed mid-loop (opaque 500). Default 5; hard cap 25.
    const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 25);
    const startedAt = Date.now();
    const TIME_BUDGET_MS = 110_000;
    const cities = Array.isArray(body.cities) ? (body.cities as string[]) : null;
    const mode = (body.mode === 'null' ? 'null' : 'oldhost') as 'oldhost' | 'null';
    const dryRun = !!body.dryRun;

    // Pick the rows that still need a hero.
    let query = supabase.from('destinations').select('id, city, hero_image_url').limit(limit);
    if (cities && cities.length) query = query.in('city', cities);
    else if (mode === 'null') query = query.is('hero_image_url', null);
    else query = query.ilike('hero_image_url', `%${OLD_HOST}%`);

    const { data: rows, error: selErr } = await query;
    if (selErr) throw selErr;

    let healed = 0, skipped = 0, failed = 0;
    const results: Array<Record<string, unknown>> = [];

    let timedOut = false;
    for (const row of rows || []) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
      const city = String((row as any).city || '').trim();
      if (!city) { skipped++; continue; }
      try {
        // skipCache: bypass any stale curated/negative-cache row (e.g. Seoul's
        // `curated → null`) so the loosened live tiers fetch a fresh image.
        const { data, error } = await supabase.functions.invoke('destination-images', {
          body: { destination: city, imageType: 'hero', limit: 1, skipCache: true },
        });
        if (error) { failed++; results.push({ city, status: 'invoke_error', error: error.message }); continue; }

        const img = (data?.images || [])[0];
        const url = img?.url;
        const source = data?.source || img?.source;

        // Only persist a genuinely usable, new-host image — never the gradient fallback.
        if (source === 'fallback' || !isHealedUrl(url)) {
          skipped++; results.push({ city, status: 'no_trusted_image', source, url: url || null });
          continue;
        }

        if (!dryRun) {
          const { error: updErr } = await supabase
            .from('destinations').update({ hero_image_url: url }).eq('id', (row as any).id);
          if (updErr) { failed++; results.push({ city, status: 'update_error', error: updErr.message }); continue; }
        }
        healed++; results.push({ city, status: dryRun ? 'would_heal' : 'healed', source, url });
      } catch (e) {
        failed++; results.push({ city, status: 'exception', error: String((e as any)?.message || e) });
      }
    }

    const moreRemain = timedOut || (rows?.length || 0) === limit;
    return new Response(JSON.stringify({
      success: true, mode, dryRun, timedOut,
      processed: (healed + skipped + failed), selected: rows?.length || 0, healed, skipped, failed,
      hint: moreRemain ? 're-run: more rows remain' : 'batch complete',
      results,
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
