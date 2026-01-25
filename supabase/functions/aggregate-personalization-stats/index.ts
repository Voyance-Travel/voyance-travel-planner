import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Aggregate Personalization Stats Edge Function
 * 
 * Aggregates activity interaction data to update personalization_tag_stats table.
 * Run periodically (e.g., daily) or after significant user activity.
 */

interface TagAction {
  tag: string;
  destination: string | null;
  action: 'shown' | 'saved' | 'completed' | 'swapped' | 'skipped';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional auth check for manual triggers
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin');
        if (!roles || roles.length === 0) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const { sinceDays = 30 } = body;

    console.log(`📊 Aggregating personalization tag stats from last ${sinceDays} days...`);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDays);

    // 1. Get activity feedback with personalization tags
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('activity_feedback')
      .select('rating, personalization_tags, destination, activity_category')
      .gte('created_at', sinceDate.toISOString());

    if (feedbackError) throw feedbackError;

    // 2. Get user enrichment events (swaps, removals, saves)
    const { data: enrichmentData, error: enrichmentError } = await supabase
      .from('user_enrichment')
      .select('enrichment_type, action_type, feedback_tags, metadata')
      .in('enrichment_type', ['activity_save', 'activity_remove', 'activity_swap', 'activity_complete'])
      .gte('created_at', sinceDate.toISOString());

    if (enrichmentError) throw enrichmentError;

    // Aggregate by tag
    const tagStats = new Map<string, {
      tag: string;
      destination: string | null;
      shown: number;
      saved: number;
      completed: number;
      swapped: number;
      skipped: number;
    }>();

    const getOrCreate = (tag: string, destination: string | null) => {
      const key = `${tag}::${destination || 'global'}`;
      if (!tagStats.has(key)) {
        tagStats.set(key, { tag, destination, shown: 0, saved: 0, completed: 0, swapped: 0, skipped: 0 });
      }
      return tagStats.get(key)!;
    };

    // Process feedback data
    for (const fb of feedbackData || []) {
      const tags = fb.personalization_tags || [];
      const dest = fb.destination || null;
      
      for (const tag of tags) {
        const stat = getOrCreate(tag, dest);
        stat.shown++;
        
        if (fb.rating === 'loved' || fb.rating === 'liked') {
          stat.saved++;
        } else if (fb.rating === 'disliked') {
          stat.skipped++;
        }
      }
    }

    // Process enrichment events
    for (const ev of enrichmentData || []) {
      const tags = ev.feedback_tags || [];
      const metadata = ev.metadata as Record<string, unknown> | null;
      const dest = (metadata?.destination as string) || null;
      
      for (const tag of tags) {
        const stat = getOrCreate(tag, dest);
        stat.shown++;
        
        switch (ev.enrichment_type) {
          case 'activity_save':
            stat.saved++;
            break;
          case 'activity_complete':
            stat.completed++;
            break;
          case 'activity_swap':
            stat.swapped++;
            break;
          case 'activity_remove':
            stat.skipped++;
            break;
        }
      }
    }

    // Upsert aggregated stats
    let updated = 0;
    for (const stat of tagStats.values()) {
      const totalActions = stat.saved + stat.completed + stat.swapped + stat.skipped;
      const retentionRate = stat.shown > 0 ? (stat.saved + stat.completed) / stat.shown : 0;
      const rejectionRate = stat.shown > 0 ? (stat.swapped + stat.skipped) / stat.shown : 0;

      const { error: upsertError } = await supabase
        .from('personalization_tag_stats')
        .upsert({
          tag: stat.tag,
          destination: stat.destination,
          shown_count: stat.shown,
          saved_count: stat.saved,
          completed_count: stat.completed,
          swapped_count: stat.swapped,
          skipped_count: stat.skipped,
          retention_rate: retentionRate,
          rejection_rate: rejectionRate,
          last_updated_at: new Date().toISOString()
        }, {
          onConflict: 'tag,destination'
        });

      if (upsertError) {
        console.warn(`Failed to upsert tag ${stat.tag}:`, upsertError);
      } else {
        updated++;
      }
    }

    // Log to audit
    await supabase.from('audit_logs').insert({
      action: 'personalization_stats_aggregation',
      action_type: 'analytics',
      actor: 'system',
      metadata: {
        sinceDays,
        tagsProcessed: tagStats.size,
        tagsUpdated: updated,
        feedbackRecords: feedbackData?.length || 0,
        enrichmentRecords: enrichmentData?.length || 0
      }
    });

    console.log(`✅ Updated ${updated} tag stats from ${tagStats.size} unique tag/destination combinations`);

    // Return top performing and underperforming tags
    const { data: topTags } = await supabase
      .from('personalization_tag_stats')
      .select('tag, destination, retention_rate, shown_count')
      .order('retention_rate', { ascending: false })
      .limit(10);

    const { data: bottomTags } = await supabase
      .from('personalization_tag_stats')
      .select('tag, destination, rejection_rate, shown_count')
      .gt('shown_count', 5) // Only tags with enough data
      .order('rejection_rate', { ascending: false })
      .limit(10);

    return new Response(JSON.stringify({
      success: true,
      tagsProcessed: tagStats.size,
      tagsUpdated: updated,
      topPerformingTags: topTags,
      underperformingTags: bottomTags
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Aggregation error:', msg);
    return new Response(JSON.stringify({ error: msg }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
