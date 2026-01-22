import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Attraction {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  subcategory: string | null;
  destination_id: string | null;
  visit_duration_mins: number | null;
  average_rating: number | null;
}

interface Destination {
  id: string;
  city: string;
  country: string;
}

interface CleanedAttraction {
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  subcategory: string;
  visit_duration_mins: number;
  average_rating: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[cleanup-attractions] Function started');

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { batchSize = 5, offset = 0, dryRun = true } = await req.json();
    console.log(`[cleanup-attractions] Processing batch: offset=${offset}, batchSize=${batchSize}, dryRun=${dryRun}`);

    // Fetch attractions that need cleanup:
    // - Generic descriptions (starting with "Popular")
    // - Near-zero coordinates (invalid)
    // - Orphaned destination_ids
    const { data: attractions, error: fetchError } = await supabase
      .from('attractions')
      .select('id, name, description, address, latitude, longitude, category, subcategory, destination_id, visit_duration_mins, average_rating')
      .or('description.ilike.Popular %,and(latitude.lt.1,latitude.gt.-1)')
      .order('name')
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('[cleanup-attractions] Fetch error:', fetchError);
      throw fetchError;
    }

    if (!attractions || attractions.length === 0) {
      console.log('[cleanup-attractions] No more attractions to process');
      return new Response(JSON.stringify({ 
        message: 'No more attractions to process',
        processed: 0,
        offset,
        complete: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch all destinations for lookup
    const { data: destinations } = await supabase
      .from('destinations')
      .select('id, city, country');
    
    const destinationMap = new Map<string, Destination>();
    (destinations || []).forEach(d => destinationMap.set(d.id, d));

    console.log(`[cleanup-attractions] Found ${attractions.length} attractions to process`);
    const results: { id: string; name: string; status: string; changes?: object }[] = [];

    for (const attraction of attractions) {
      const attrStartTime = Date.now();
      
      // Check if we're running low on time (45 second safety margin)
      if (Date.now() - startTime > 45000) {
        console.log(`[cleanup-attractions] Time limit approaching, stopping early`);
        results.push({ id: attraction.id, name: attraction.name, status: 'skipped_timeout' });
        continue;
      }

      try {
        // Extract location from address or name for AI context
        const locationHint = attraction.address || attraction.name.split(' ').slice(-2).join(' ');
        
        // Find a valid destination to link to based on address
        let matchedDestination: Destination | null = null;
        if (attraction.address) {
          for (const dest of destinationMap.values()) {
            if (attraction.address.toLowerCase().includes(dest.city.toLowerCase())) {
              matchedDestination = dest;
              break;
            }
          }
        }

        console.log(`[cleanup-attractions] Processing: ${attraction.name} (${locationHint})`);
        
        // Analyze and clean with AI
        const cleaned = await cleanAttractionWithAI(
          attraction, 
          locationHint,
          matchedDestination,
          LOVABLE_API_KEY
        );
        
        if (cleaned) {
          const updates: Record<string, unknown> = {};
          let hasChanges = false;

          // Check if description is generic
          if (attraction.description?.startsWith('Popular ')) {
            updates.description = cleaned.description;
            hasChanges = true;
          }

          // Fix near-zero coordinates
          if (Math.abs(attraction.latitude || 0) < 1 && Math.abs(attraction.longitude || 0) < 1) {
            updates.latitude = cleaned.latitude;
            updates.longitude = cleaned.longitude;
            hasChanges = true;
          }

          // Update address if it's just a city name
          if (attraction.address && !attraction.address.includes(',') && cleaned.address) {
            updates.address = cleaned.address;
            hasChanges = true;
          }

          // Link to valid destination if orphaned
          if (attraction.destination_id && !destinationMap.has(attraction.destination_id) && matchedDestination) {
            updates.destination_id = matchedDestination.id;
            hasChanges = true;
          }

          if (hasChanges) {
            // Always set updated_at when making changes
            updates.updated_at = new Date().toISOString();
            
            if (!dryRun) {
              const { error: updateError } = await supabase
                .from('attractions')
                .update(updates)
                .eq('id', attraction.id);
              
              if (updateError) {
                console.error(`[cleanup-attractions] Update error for ${attraction.name}:`, updateError);
                throw updateError;
              }
            }
            
            const elapsed = Date.now() - attrStartTime;
            console.log(`[cleanup-attractions] ${attraction.name}: ${Object.keys(updates).length} fields updated (${elapsed}ms)`);
            
            results.push({
              id: attraction.id,
              name: attraction.name,
              status: dryRun ? 'would_update' : 'updated',
              changes: updates
            });
          } else {
            console.log(`[cleanup-attractions] ${attraction.name}: no changes needed`);
            results.push({ id: attraction.id, name: attraction.name, status: 'no_changes_needed' });
          }
        } else {
          console.log(`[cleanup-attractions] ${attraction.name}: AI returned null`);
          results.push({ id: attraction.id, name: attraction.name, status: 'ai_failed' });
        }
      } catch (attrError) {
        console.error(`[cleanup-attractions] Error processing ${attraction.name}:`, attrError);
        results.push({ 
          id: attraction.id, 
          name: attraction.name, 
          status: 'error',
          changes: { error: attrError instanceof Error ? attrError.message : 'Unknown error' }
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cleanup-attractions] Batch complete: ${results.length} processed in ${totalTime}ms`);

    return new Response(JSON.stringify({
      message: `Processed ${attractions.length} attractions`,
      dryRun,
      processed: attractions.length,
      offset,
      nextOffset: offset + batchSize,
      results,
      executionTimeMs: totalTime
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[cleanup-attractions] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

async function cleanAttractionWithAI(
  attraction: Attraction,
  locationHint: string,
  matchedDestination: Destination | null,
  apiKey: string
): Promise<CleanedAttraction | null> {
  const locationContext = matchedDestination 
    ? `${matchedDestination.city}, ${matchedDestination.country}`
    : locationHint;

  const prompt = `You are a travel data specialist. Clean and improve this attraction data for "${attraction.name}" located in/near "${locationContext}".

Current data:
- Name: ${attraction.name}
- Description: ${attraction.description || 'Missing'}
- Address: ${attraction.address || 'Missing'}
- Coordinates: ${attraction.latitude}, ${attraction.longitude}
- Category: ${attraction.category || 'Missing'}
- Subcategory: ${attraction.subcategory || 'Missing'}

Please provide improved, accurate data. Return a JSON object with these fields:
1. "description": A compelling 2-3 sentence description that's unique to this specific attraction. Mention what makes it special, its history, or why tourists visit.
2. "address": A realistic street address for this attraction (or best approximation if it's a natural landmark)
3. "latitude": Accurate latitude coordinate (decimal degrees, e.g., 48.8584)
4. "longitude": Accurate longitude coordinate (decimal degrees, e.g., 2.2945)
5. "category": One of: museum, landmark, park, entertainment, religious, nature, shopping, food, nightlife, sports
6. "subcategory": A more specific subcategory (e.g., "art museum", "historic church", "botanical garden")
7. "visit_duration_mins": Recommended visit duration in minutes (integer)
8. "average_rating": A realistic rating between 3.5 and 5.0

IMPORTANT: Provide real, accurate coordinates for the actual location. Do NOT use placeholder or zero coordinates.

Only return valid JSON, no markdown or explanation.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a travel data specialist. Always return valid JSON only. For coordinates, provide real accurate values - never use 0 or placeholder values." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
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

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(jsonStr);
    
    // Validate coordinates are reasonable
    if (Math.abs(parsed.latitude) < 1 && Math.abs(parsed.longitude) < 1) {
      console.log(`[cleanup-attractions] AI returned near-zero coords for ${attraction.name}, rejecting`);
      return null;
    }

    return {
      description: parsed.description || attraction.description,
      address: parsed.address || attraction.address || '',
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      category: parsed.category || attraction.category || 'landmark',
      subcategory: parsed.subcategory || attraction.subcategory || '',
      visit_duration_mins: parsed.visit_duration_mins || attraction.visit_duration_mins || 60,
      average_rating: parsed.average_rating || attraction.average_rating || 4.0
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[cleanup-attractions] AI timeout for ${attraction.name}`);
    } else {
      console.error(`[cleanup-attractions] AI cleanup failed for ${attraction.name}:`, error);
    }
    return null;
  }
}
