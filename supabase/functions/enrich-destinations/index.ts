import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Destination {
  id: string;
  city: string;
  country: string;
  region: string;
  description: string | null;
  default_transport_modes: unknown[] | null;
  known_for: string[] | null;
  points_of_interest: string[] | null;
}

interface EnrichedData {
  description: string;
  transportModes: TransportMode[];
  localTips: string[];
  safetyTips: string[];
  knownFor: string[];
  pointsOfInterest: string[];
  gettingAround: string;
  bestNeighborhoods: string[];
  foodScene: string;
  nightlife: string;
  dressCode: string;
  tippingCustom: string;
  commonScams: string[];
  emergencyNumbers: { police: string; ambulance: string; tourist: string };
}

interface TransportMode {
  mode: string;
  recommended: boolean;
  notes: string;
  appName?: string;
  estimatedCost?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[enrich-destinations] Function started');

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { batchSize = 3, offset = 0, dryRun = true, priorityOnly = false } = await req.json();
    console.log(`[enrich-destinations] Processing batch: offset=${offset}, batchSize=${batchSize}, dryRun=${dryRun}`);

    // Fetch destinations needing transport/local knowledge enrichment
    let query = supabase
      .from('destinations')
      .select('id, city, country, region, description, default_transport_modes, known_for, points_of_interest')
      .or('default_transport_modes.is.null,default_transport_modes.eq.[]');
    
    // Optionally filter to only featured/high-tier destinations
    if (priorityOnly) {
      query = query.or('featured.eq.true,tier.lte.2');
    }
    
    const { data: destinations, error: fetchError } = await query
      .order('city')
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('[enrich-destinations] Fetch error:', fetchError);
      throw fetchError;
    }

    if (!destinations || destinations.length === 0) {
      console.log('[enrich-destinations] No more destinations to process');
      return new Response(JSON.stringify({ 
        message: 'No more destinations to process',
        processed: 0,
        offset,
        complete: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[enrich-destinations] Found ${destinations.length} destinations to enrich`);
    const results: { id: string; city: string; status: string; changes?: object }[] = [];

    for (const dest of destinations) {
      const destStartTime = Date.now();
      
      // Check if we're running low on time (45 second safety margin)
      if (Date.now() - startTime > 45000) {
        console.log(`[enrich-destinations] Time limit approaching, stopping early`);
        results.push({ id: dest.id, city: dest.city, status: 'skipped_timeout' });
        continue;
      }

      try {
        console.log(`[enrich-destinations] Enriching: ${dest.city}, ${dest.country}`);
        
        // Get comprehensive local knowledge from AI
        const enriched = await enrichWithLocalKnowledge(dest, LOVABLE_API_KEY);
        
        if (enriched) {
          const updates: Record<string, unknown> = {
            default_transport_modes: enriched.transportModes,
            updated_at: new Date().toISOString()
          };

          // Update description if current one is weak
          if (!dest.description || dest.description.length < 100) {
            updates.description = enriched.description;
          }

          // Enrich known_for if sparse
          if (!dest.known_for || dest.known_for.length < 5) {
            updates.known_for = enriched.knownFor;
          }

          // Enrich points_of_interest if sparse
          if (!dest.points_of_interest || dest.points_of_interest.length < 5) {
            updates.points_of_interest = enriched.pointsOfInterest;
          }

          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('destinations')
              .update(updates)
              .eq('id', dest.id);
            
            if (updateError) {
              console.error(`[enrich-destinations] Update error for ${dest.city}:`, updateError);
              throw updateError;
            }
          }
          
          const elapsed = Date.now() - destStartTime;
          console.log(`[enrich-destinations] ${dest.city}: enriched with ${enriched.transportModes.length} transport modes (${elapsed}ms)`);
          
          results.push({
            id: dest.id,
            city: dest.city,
            status: dryRun ? 'would_update' : 'updated',
            changes: {
              transportModes: enriched.transportModes,
              localTips: enriched.localTips,
              gettingAround: enriched.gettingAround
            }
          });
        } else {
          console.log(`[enrich-destinations] ${dest.city}: AI returned null`);
          results.push({ id: dest.id, city: dest.city, status: 'ai_failed' });
        }
      } catch (destError) {
        console.error(`[enrich-destinations] Error processing ${dest.city}:`, destError);
        results.push({ 
          id: dest.id, 
          city: dest.city, 
          status: 'error',
          changes: { error: destError instanceof Error ? destError.message : 'Unknown error' }
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[enrich-destinations] Batch complete: ${results.length} processed in ${totalTime}ms`);

    return new Response(JSON.stringify({
      message: `Enriched ${destinations.length} destinations with local knowledge`,
      dryRun,
      processed: destinations.length,
      offset,
      nextOffset: offset + batchSize,
      results,
      executionTimeMs: totalTime
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[enrich-destinations] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

async function enrichWithLocalKnowledge(
  dest: Destination, 
  apiKey: string
): Promise<EnrichedData | null> {
  const prompt = `You are an expert local travel guide for "${dest.city}, ${dest.country}". Provide practical, insider knowledge that helps travelers navigate like a local.

IMPORTANT: Be specific and accurate. Include real app names, actual prices, genuine local customs. Avoid generic advice.

Return a JSON object with:

1. "description": Compelling 3-4 sentence description highlighting what makes this destination unique. Be specific, evocative.

2. "transportModes": Array of transport options, each with:
   - "mode": Transport type (e.g., "Metro", "inDrive", "Grab", "Uber", "Petit taxi", "Tuk-tuk", "Cyclo")
   - "recommended": true/false - is this the BEST option for tourists?
   - "notes": Practical advice (e.g., "Insist on meter", "Download app before arrival", "Negotiate before boarding")
   - "appName": If app-based, the app name (e.g., "Grab", "Gojek", "inDrive", "Bolt")
   - "estimatedCost": Typical cost range (e.g., "$2-5 for city center", "€1.90 per ride")

3. "localTips": Array of 5-7 insider tips locals would tell friends visiting (NOT generic travel advice)

4. "safetyTips": Array of 3-5 safety considerations specific to this destination

5. "gettingAround": 2-3 sentence summary of best way to navigate the city

6. "knownFor": Array of 7-10 specific things this destination is famous for

7. "pointsOfInterest": Array of 8-12 must-visit specific attractions/landmarks

8. "bestNeighborhoods": Array of 4-6 neighborhoods for different traveler types (with brief description)

9. "foodScene": 2-3 sentences about the food culture and what to try

10. "nightlife": 1-2 sentences about nightlife scene

11. "dressCode": Local dress expectations/customs

12. "tippingCustom": Specific tipping guidance for this destination

13. "commonScams": Array of 2-4 scams tourists should watch for (if any)

14. "emergencyNumbers": Object with "police", "ambulance", "tourist" (tourist police or help line if exists)

Return ONLY valid JSON, no markdown or explanations.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash", // Use better model for quality local knowledge
        messages: [
          { role: "system", content: "You are an expert travel consultant with deep local knowledge. Always return valid JSON only. Be specific and practical, not generic." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) throw new Error("Rate limited");
      if (response.status === 402) throw new Error("Payment required");
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return null;

    // Parse JSON from response
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(jsonStr);
    
    return {
      description: parsed.description || '',
      transportModes: parsed.transportModes || [],
      localTips: parsed.localTips || [],
      safetyTips: parsed.safetyTips || [],
      knownFor: parsed.knownFor || [],
      pointsOfInterest: parsed.pointsOfInterest || [],
      gettingAround: parsed.gettingAround || '',
      bestNeighborhoods: parsed.bestNeighborhoods || [],
      foodScene: parsed.foodScene || '',
      nightlife: parsed.nightlife || '',
      dressCode: parsed.dressCode || '',
      tippingCustom: parsed.tippingCustom || '',
      commonScams: parsed.commonScams || [],
      emergencyNumbers: parsed.emergencyNumbers || { police: '', ambulance: '', tourist: '' }
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[enrich-destinations] AI timeout for ${dest.city}`);
    } else {
      console.error(`[enrich-destinations] AI enrichment failed for ${dest.city}:`, error);
    }
    return null;
  }
}
