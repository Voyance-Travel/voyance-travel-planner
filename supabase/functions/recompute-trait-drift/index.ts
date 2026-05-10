import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Per-trait cap on a single drift cycle.
const PER_TRAIT_CAP = 0.05;
// How much each rated row contributes (loved/disliked are multiplied by this).
const SIGNAL_WEIGHT = 0.01;
// Below this many rated rows, do not apply drift.
const MIN_SAMPLE = 5;

const RATING_WEIGHT: Record<string, number> = {
  loved: 1.0,
  liked: 0.5,
  neutral: 0,
  disliked: -1.0,
  hated: -1.5,
};

// Map activity_category / activity_type → traits to nudge.
// Keys are matched lowercase as substrings.
const CATEGORY_TRAIT_MAP: Array<{ match: string; traits: string[] }> = [
  { match: 'museum',       traits: ['cultural_depth', 'art_focus', 'learning_focus'] },
  { match: 'gallery',      traits: ['art_focus', 'cultural_depth'] },
  { match: 'culture',      traits: ['cultural_depth', 'learning_focus'] },
  { match: 'sightseeing',  traits: ['cultural_depth', 'photo_focus'] },
  { match: 'history',      traits: ['cultural_depth', 'learning_focus'] },
  { match: 'dining',       traits: ['food_focus'] },
  { match: 'food',         traits: ['food_focus'] },
  { match: 'restaurant',   traits: ['food_focus'] },
  { match: 'nightlife',    traits: ['social_energy', 'novelty_seeking'] },
  { match: 'bar',          traits: ['social_energy', 'novelty_seeking'] },
  { match: 'adventure',    traits: ['adventure', 'nature_orientation'] },
  { match: 'outdoor',      traits: ['adventure', 'nature_orientation'] },
  { match: 'hike',         traits: ['adventure', 'nature_orientation'] },
  { match: 'hiking',       traits: ['adventure', 'nature_orientation'] },
  { match: 'sport',        traits: ['adventure'] },
  { match: 'wellness',     traits: ['restoration_need', 'healing_focus'] },
  { match: 'spa',          traits: ['restoration_need', 'healing_focus'] },
  { match: 'shopping',     traits: ['status_seeking'] },
  { match: 'nature',       traits: ['nature_orientation'] },
  { match: 'park',         traits: ['nature_orientation'] },
  { match: 'beach',        traits: ['restoration_need', 'nature_orientation'] },
  { match: 'entertainment',traits: ['novelty_seeking', 'social_energy'] },
  { match: 'relaxation',   traits: ['restoration_need'] },
];

// Categories we explicitly ignore (no signal for traits).
const IGNORED = ['transport', 'logistics', 'transit', 'flight', 'accommodation', 'hotel'];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lookupTraits(category?: string | null, type?: string | null): string[] {
  const hay = `${(category || '').toLowerCase()} ${(type || '').toLowerCase()}`;
  if (!hay.trim()) return [];
  if (IGNORED.some(k => hay.includes(k))) return [];
  const hits = new Set<string>();
  for (const { match, traits } of CATEGORY_TRAIT_MAP) {
    if (hay.includes(match)) traits.forEach(t => hits.add(t));
  }
  return [...hits];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, dryRun } = await req.json().catch(() => ({}));
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Load activity_feedback (last 12 months)
    const sinceIso = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: feedback, error: fbErr } = await supabase
      .from('activity_feedback')
      .select('rating, activity_type, activity_category')
      .eq('user_id', userId)
      .gte('created_at', sinceIso);

    if (fbErr) {
      console.error('[trait-drift] feedback fetch failed', fbErr);
      return new Response(
        JSON.stringify({ error: 'feedback fetch failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sampleSize = feedback?.length ?? 0;
    if (sampleSize === 0) {
      return new Response(
        JSON.stringify({ skipped: 'no_feedback', userId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (sampleSize < MIN_SAMPLE) {
      return new Response(
        JSON.stringify({ skipped: 'insufficient_signal', userId, sampleSize }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2-3. Aggregate raw deltas per trait, then cap.
    const rawDeltas: Record<string, number> = {};
    for (const row of feedback) {
      const w = RATING_WEIGHT[(row.rating || '').toLowerCase()] ?? 0;
      if (w === 0) continue;
      const traits = lookupTraits(row.activity_category, row.activity_type);
      for (const t of traits) {
        rawDeltas[t] = (rawDeltas[t] || 0) + w * SIGNAL_WEIGHT;
      }
    }
    const cappedDeltas: Record<string, number> = {};
    for (const [t, v] of Object.entries(rawDeltas)) {
      cappedDeltas[t] = clamp(v, -PER_TRAIT_CAP, PER_TRAIT_CAP);
    }

    // 4. Read current profile
    const { data: profile, error: profErr } = await supabase
      .from('travel_dna_profiles')
      .select('id, trait_scores, derivation_source')
      .eq('user_id', userId)
      .maybeSingle();

    if (profErr) {
      console.error('[trait-drift] profile fetch failed', profErr);
      return new Response(
        JSON.stringify({ error: 'profile fetch failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!profile) {
      return new Response(
        JSON.stringify({ skipped: 'no_profile', userId, sampleSize, deltas: cappedDeltas }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const before: Record<string, unknown> = (profile.trait_scores as Record<string, unknown>) || {};
    const after: Record<string, unknown> = { ...before };

    // 5. Apply deltas (numeric only; never touch life_stage / strings)
    let appliedCount = 0;
    for (const [t, delta] of Object.entries(cappedDeltas)) {
      const cur = before[t];
      if (typeof cur !== 'number') continue; // skip if trait not on profile or non-numeric (e.g. life_stage)
      const next = clamp(cur + delta, 0, 1);
      if (next !== cur) {
        after[t] = next;
        appliedCount++;
      }
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          userId, sampleSize, deltas: cappedDeltas, beforeScores: before, afterScores: after,
          dryRun: true, applied: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (appliedCount === 0) {
      return new Response(
        JSON.stringify({ skipped: 'no_change', userId, sampleSize, deltas: cappedDeltas }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6. Write profile + log
    const { error: upErr } = await supabase
      .from('travel_dna_profiles')
      .update({
        trait_scores: after,
        derivation_source: 'drift',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (upErr) {
      console.error('[trait-drift] profile update failed', upErr);
      return new Response(
        JSON.stringify({ error: 'profile update failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('trait_drift_log').insert({
      user_id: userId,
      sample_size: sampleSize,
      deltas: cappedDeltas,
      before_scores: before,
      after_scores: after,
    });

    console.log(`[trait-drift] user=${userId} sample=${sampleSize} applied=${appliedCount}`);

    return new Response(
      JSON.stringify({
        userId, sampleSize, deltas: cappedDeltas,
        beforeScores: before, afterScores: after,
        applied: appliedCount,
        // archetype recalc deferred — TS matchArchetypes is the canonical matcher;
        // it runs on the next quiz/conversation save or via client-side recalculateArchetype.
        archetypeRecalced: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[trait-drift] unexpected', err);
    return new Response(
      JSON.stringify({ error: 'unexpected', message: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
