/**
 * Get Destination Intelligence
 * 
 * Returns cached intelligence stats for a destination (no auth required).
 * Used for the hero section teaser - shows what Voyance knows before signup.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Pre-computed intelligence for popular destinations (cached for performance)
const DESTINATION_INTELLIGENCE: Record<string, {
  hiddenGems: number;
  timingHacks: number;
  trapsToAvoid: number;
  insiderTips: number;
}> = {
  // Top destinations with curated knowledge
  'tokyo': { hiddenGems: 24, timingHacks: 18, trapsToAvoid: 12, insiderTips: 31 },
  'japan': { hiddenGems: 24, timingHacks: 18, trapsToAvoid: 12, insiderTips: 31 },
  'paris': { hiddenGems: 19, timingHacks: 14, trapsToAvoid: 9, insiderTips: 26 },
  'france': { hiddenGems: 19, timingHacks: 14, trapsToAvoid: 9, insiderTips: 26 },
  'rome': { hiddenGems: 17, timingHacks: 13, trapsToAvoid: 11, insiderTips: 22 },
  'italy': { hiddenGems: 22, timingHacks: 15, trapsToAvoid: 10, insiderTips: 28 },
  'london': { hiddenGems: 21, timingHacks: 16, trapsToAvoid: 8, insiderTips: 27 },
  'uk': { hiddenGems: 21, timingHacks: 16, trapsToAvoid: 8, insiderTips: 27 },
  'england': { hiddenGems: 21, timingHacks: 16, trapsToAvoid: 8, insiderTips: 27 },
  'barcelona': { hiddenGems: 16, timingHacks: 12, trapsToAvoid: 7, insiderTips: 21 },
  'spain': { hiddenGems: 20, timingHacks: 14, trapsToAvoid: 8, insiderTips: 25 },
  'bali': { hiddenGems: 18, timingHacks: 11, trapsToAvoid: 9, insiderTips: 23 },
  'indonesia': { hiddenGems: 18, timingHacks: 11, trapsToAvoid: 9, insiderTips: 23 },
  'new york': { hiddenGems: 22, timingHacks: 17, trapsToAvoid: 11, insiderTips: 29 },
  'nyc': { hiddenGems: 22, timingHacks: 17, trapsToAvoid: 11, insiderTips: 29 },
  'amsterdam': { hiddenGems: 15, timingHacks: 10, trapsToAvoid: 6, insiderTips: 19 },
  'netherlands': { hiddenGems: 15, timingHacks: 10, trapsToAvoid: 6, insiderTips: 19 },
  'bangkok': { hiddenGems: 17, timingHacks: 13, trapsToAvoid: 10, insiderTips: 24 },
  'thailand': { hiddenGems: 20, timingHacks: 14, trapsToAvoid: 11, insiderTips: 26 },
  'dubai': { hiddenGems: 14, timingHacks: 9, trapsToAvoid: 8, insiderTips: 18 },
  'uae': { hiddenGems: 14, timingHacks: 9, trapsToAvoid: 8, insiderTips: 18 },
  'sydney': { hiddenGems: 16, timingHacks: 11, trapsToAvoid: 5, insiderTips: 20 },
  'australia': { hiddenGems: 21, timingHacks: 13, trapsToAvoid: 6, insiderTips: 25 },
  'lisbon': { hiddenGems: 14, timingHacks: 10, trapsToAvoid: 5, insiderTips: 17 },
  'portugal': { hiddenGems: 16, timingHacks: 11, trapsToAvoid: 6, insiderTips: 20 },
  'seoul': { hiddenGems: 19, timingHacks: 14, trapsToAvoid: 7, insiderTips: 24 },
  'korea': { hiddenGems: 19, timingHacks: 14, trapsToAvoid: 7, insiderTips: 24 },
  'singapore': { hiddenGems: 15, timingHacks: 12, trapsToAvoid: 4, insiderTips: 18 },
  'mexico city': { hiddenGems: 18, timingHacks: 13, trapsToAvoid: 9, insiderTips: 22 },
  'mexico': { hiddenGems: 21, timingHacks: 15, trapsToAvoid: 10, insiderTips: 26 },
  'berlin': { hiddenGems: 17, timingHacks: 11, trapsToAvoid: 5, insiderTips: 21 },
  'germany': { hiddenGems: 19, timingHacks: 13, trapsToAvoid: 6, insiderTips: 24 },
  'vienna': { hiddenGems: 13, timingHacks: 9, trapsToAvoid: 4, insiderTips: 16 },
  'austria': { hiddenGems: 15, timingHacks: 10, trapsToAvoid: 5, insiderTips: 19 },
  'prague': { hiddenGems: 14, timingHacks: 10, trapsToAvoid: 6, insiderTips: 18 },
  'czech': { hiddenGems: 14, timingHacks: 10, trapsToAvoid: 6, insiderTips: 18 },
  'athens': { hiddenGems: 15, timingHacks: 11, trapsToAvoid: 7, insiderTips: 19 },
  'greece': { hiddenGems: 18, timingHacks: 12, trapsToAvoid: 8, insiderTips: 23 },
  'marrakech': { hiddenGems: 13, timingHacks: 9, trapsToAvoid: 8, insiderTips: 17 },
  'morocco': { hiddenGems: 15, timingHacks: 10, trapsToAvoid: 9, insiderTips: 19 },
  'cape town': { hiddenGems: 16, timingHacks: 10, trapsToAvoid: 5, insiderTips: 20 },
  'south africa': { hiddenGems: 18, timingHacks: 11, trapsToAvoid: 6, insiderTips: 22 },
};

// Default stats for unknown destinations
const DEFAULT_STATS = {
  hiddenGems: 12,
  timingHacks: 8,
  trapsToAvoid: 5,
  insiderTips: 15,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { destination } = await req.json();

    if (!destination || typeof destination !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Destination is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize destination for lookup
    const normalizedDest = destination.toLowerCase().trim();
    
    // Look up cached intelligence or use defaults
    const stats = DESTINATION_INTELLIGENCE[normalizedDest] || DEFAULT_STATS;

    // Add a small random variation for destinations not in cache
    // This makes the numbers feel dynamic while still being deterministic per-destination
    if (!DESTINATION_INTELLIGENCE[normalizedDest]) {
      const hash = normalizedDest.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      stats.hiddenGems = 10 + (hash % 15);
      stats.timingHacks = 6 + (hash % 12);
      stats.trapsToAvoid = 4 + (hash % 8);
      stats.insiderTips = 12 + (hash % 20);
    }

    return new Response(
      JSON.stringify(stats),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          // Cache for 1 hour - this data doesn't change often
          'Cache-Control': 'public, max-age=3600',
        } 
      }
    );
  } catch (error) {
    console.error('Error in get-destination-intelligence:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
