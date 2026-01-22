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

interface ProcessResult {
  id: string;
  name: string;
  status: string;
  changes?: object;
}

// Process a single attraction with AI
async function processAttraction(
  attraction: Attraction,
  destinationMap: Map<string, Destination>,
  supabase: any,
  apiKey: string,
  dryRun: boolean
): Promise<ProcessResult> {
  try {
    const locationHint = attraction.address || attraction.name.split(' ').slice(-2).join(' ');
    
    let matchedDestination: Destination | null = null;
    if (attraction.address) {
      for (const dest of destinationMap.values()) {
        if (attraction.address.toLowerCase().includes(dest.city.toLowerCase())) {
          matchedDestination = dest;
          break;
        }
      }
    }

    const cleaned = await cleanAttractionWithAI(attraction, locationHint, matchedDestination, apiKey);
    
    if (!cleaned) {
      return { id: attraction.id, name: attraction.name, status: 'ai_failed' };
    }

    const updates: Record<string, unknown> = {};
    let hasChanges = false;

    // Check if description is generic (case-insensitive)
    const isGenericDescription =
      typeof attraction.description === 'string' &&
      /^popular\s/i.test(attraction.description.trimStart());

    if (isGenericDescription) {
      const nextDescription =
        typeof cleaned.description === 'string' && /^popular\s/i.test(cleaned.description.trimStart())
          ? `${attraction.name} is ${cleaned.description.replace(/^popular\s+/i, '').trim()}`
          : cleaned.description;

      updates.description = nextDescription;
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
      updates.updated_at = new Date().toISOString();
      
      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('attractions')
          .update(updates as any)
          .eq('id', attraction.id);
        
        if (updateError) {
          console.error(`[cleanup-attractions] Update error for ${attraction.name}:`, updateError);
          return { id: attraction.id, name: attraction.name, status: 'error', changes: { error: updateError.message } };
        }
      }
      
      return {
        id: attraction.id,
        name: attraction.name,
        status: dryRun ? 'would_update' : 'updated',
        changes: updates
      };
    } else {
      return { id: attraction.id, name: attraction.name, status: 'no_changes_needed' };
    }
  } catch (error) {
    console.error(`[cleanup-attractions] Error processing ${attraction.name}:`, error);
    return { 
      id: attraction.id, 
      name: attraction.name, 
      status: 'error',
      changes: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

// Process attractions in parallel chunks
async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  
  return results;
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

    // Increased default batch size for faster processing
    const { batchSize = 15, offset = 0, dryRun = true } = await req.json();
    console.log(`[cleanup-attractions] Processing batch: offset=${offset}, batchSize=${batchSize}, dryRun=${dryRun}`);

    // Fetch attractions that need cleanup
    const { data: attractions, error: fetchError } = await supabase
      .from('attractions')
      .select('id, name, description, address, latitude, longitude, category, subcategory, destination_id, visit_duration_mins, average_rating')
      .or('description.ilike.Popular %,and(latitude.lt.1,latitude.gt.-1,longitude.lt.1,longitude.gt.-1)')
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

    console.log(`[cleanup-attractions] Found ${attractions.length} attractions to process in parallel`);

    // Process 4 attractions in parallel at a time
    const CONCURRENCY = 4;
    const results: ProcessResult[] = [];
    
    for (let i = 0; i < attractions.length; i += CONCURRENCY) {
      // Check time limit before starting next parallel chunk
      if (Date.now() - startTime > 50000) {
        console.log(`[cleanup-attractions] Time limit approaching, stopping after ${results.length} items`);
        break;
      }
      
      const chunk = attractions.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(attr => processAttraction(attr, destinationMap, supabase, LOVABLE_API_KEY, dryRun))
      );
      results.push(...chunkResults);
      
      console.log(`[cleanup-attractions] Processed ${results.length}/${attractions.length} (chunk ${Math.floor(i / CONCURRENCY) + 1})`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cleanup-attractions] Batch complete: ${results.length} processed in ${totalTime}ms`);

    return new Response(JSON.stringify({
      message: `Processed ${results.length} attractions`,
      dryRun,
      processed: results.length,
      offset,
      nextOffset: offset + results.length,
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

  // Shorter, more focused prompt for faster responses
  const prompt = `Clean this attraction data for "${attraction.name}" in "${locationContext}".

Current: ${attraction.description || 'Missing description'}, coords: ${attraction.latitude},${attraction.longitude}

Return JSON with:
- description: 2 compelling sentences about this specific place
- address: realistic street address
- latitude: accurate decimal (e.g., 48.8584)
- longitude: accurate decimal (e.g., 2.2945)
- category: museum|landmark|park|entertainment|religious|nature|shopping|food|nightlife|sports
- subcategory: specific type
- visit_duration_mins: integer
- average_rating: 3.5-5.0

Return ONLY valid JSON.`;

  try {
    const controller = new AbortController();
    // 20s timeout - balanced for reliability
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Use fastest model for bulk cleanup
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Travel data specialist. Return valid JSON only. Use real coordinates, never 0 or placeholders." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3, // Lower for more consistent outputs
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
