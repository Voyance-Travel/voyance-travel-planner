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
  stock_image_url: string | null;
  tags: string[] | null;
  known_for: string[] | null;
  points_of_interest: string[] | null;
  cost_tier: string | null;
  timezone: string | null;
  currency_code: string | null;
  seasonality: string | null;
  best_time_to_visit: string | null;
  temperature_range: string | null;
}

interface CleanedDestination {
  description: string;
  imageUrl: string;
  knownFor: string[];
  pointsOfInterest: string[];
  tags: string[];
  currencyCode: string;
  seasonality: string;
  bestTimeToVisit: string;
  temperatureRange: string;
  costTier: string;
  timezone: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[cleanup-destinations] Function started');

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { batchSize = 3, offset = 0, dryRun = true } = await req.json();
    console.log(`[cleanup-destinations] Processing batch: offset=${offset}, batchSize=${batchSize}, dryRun=${dryRun}`);

    // Fetch destinations that NEED cleanup - skip those already processed
    // Priority: those missing currency_code, timezone, or cost_tier
    const { data: destinations, error: fetchError } = await supabase
      .from('destinations')
      .select('id, city, country, region, description, stock_image_url, tags, known_for, points_of_interest, cost_tier, timezone, currency_code, seasonality, best_time_to_visit, temperature_range')
      .or('currency_code.is.null,timezone.is.null,cost_tier.is.null')
      .order('city')
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('[cleanup-destinations] Fetch error:', fetchError);
      throw fetchError;
    }

    if (!destinations || destinations.length === 0) {
      console.log('[cleanup-destinations] No more destinations to process');
      return new Response(JSON.stringify({ 
        message: 'No more destinations to process',
        processed: 0,
        offset,
        complete: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[cleanup-destinations] Found ${destinations.length} destinations to process`);
    const results: { id: string; city: string; status: string; changes?: object }[] = [];

    for (const dest of destinations) {
      const destStartTime = Date.now();
      
      // Check if we're running low on time (45 second safety margin)
      if (Date.now() - startTime > 45000) {
        console.log(`[cleanup-destinations] Time limit approaching, stopping early`);
        results.push({ id: dest.id, city: dest.city, status: 'skipped_timeout' });
        continue;
      }

      try {
        console.log(`[cleanup-destinations] Processing: ${dest.city}, ${dest.country}`);
        
        // Analyze and clean with AI
        const cleaned = await cleanDestinationWithAI(dest, LOVABLE_API_KEY);
        
        if (cleaned) {
          const updates: Record<string, unknown> = {};
          let hasChanges = false;

          // Check if description needs update (generic/template descriptions)
          if (isGenericDescription(dest.description)) {
            updates.description = cleaned.description;
            hasChanges = true;
          }

          // Check if image URL needs fixing
          if (needsImageFix(dest.stock_image_url)) {
            updates.stock_image_url = cleaned.imageUrl;
            hasChanges = true;
          }

          // Improve known_for if empty or has few items
          if (!dest.known_for || (Array.isArray(dest.known_for) && dest.known_for.length < 3)) {
            updates.known_for = cleaned.knownFor;
            hasChanges = true;
          }

          // Improve points_of_interest if generic
          if (hasGenericPOIs(dest.points_of_interest)) {
            updates.points_of_interest = cleaned.pointsOfInterest;
            hasChanges = true;
          }

          // Fill in missing currency_code
          if (!dest.currency_code && cleaned.currencyCode) {
            updates.currency_code = cleaned.currencyCode;
            hasChanges = true;
          }

          // Fill in missing seasonality
          if (!dest.seasonality && cleaned.seasonality) {
            updates.seasonality = cleaned.seasonality;
            hasChanges = true;
          }

          // Fill in missing best_time_to_visit
          if (!dest.best_time_to_visit && cleaned.bestTimeToVisit) {
            updates.best_time_to_visit = cleaned.bestTimeToVisit;
            hasChanges = true;
          }

          // Fill in missing temperature_range
          if (!dest.temperature_range && cleaned.temperatureRange) {
            updates.temperature_range = cleaned.temperatureRange;
            hasChanges = true;
          }

          // Fill in missing cost_tier
          if (!dest.cost_tier && cleaned.costTier) {
            updates.cost_tier = cleaned.costTier;
            hasChanges = true;
          }

          // Fill in missing timezone
          if (!dest.timezone && cleaned.timezone) {
            updates.timezone = cleaned.timezone;
            hasChanges = true;
          }

          if (hasChanges) {
            if (!dryRun) {
              const { error: updateError } = await supabase
                .from('destinations')
                .update(updates)
                .eq('id', dest.id);
              
              if (updateError) {
                console.error(`[cleanup-destinations] Update error for ${dest.city}:`, updateError);
                throw updateError;
              }
            }
            
            const elapsed = Date.now() - destStartTime;
            console.log(`[cleanup-destinations] ${dest.city}: ${Object.keys(updates).length} fields updated (${elapsed}ms)`);
            
            results.push({
              id: dest.id,
              city: dest.city,
              status: dryRun ? 'would_update' : 'updated',
              changes: updates
            });
          } else {
            console.log(`[cleanup-destinations] ${dest.city}: no changes needed`);
            results.push({ id: dest.id, city: dest.city, status: 'no_changes_needed' });
          }
        } else {
          console.log(`[cleanup-destinations] ${dest.city}: AI returned null`);
          results.push({ id: dest.id, city: dest.city, status: 'ai_failed' });
        }
      } catch (destError) {
        console.error(`[cleanup-destinations] Error processing ${dest.city}:`, destError);
        results.push({ 
          id: dest.id, 
          city: dest.city, 
          status: 'error',
          changes: { error: destError instanceof Error ? destError.message : 'Unknown error' }
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cleanup-destinations] Batch complete: ${results.length} processed in ${totalTime}ms`);

    return new Response(JSON.stringify({
      message: `Processed ${destinations.length} destinations`,
      dryRun,
      processed: destinations.length,
      offset,
      nextOffset: offset + batchSize,
      results,
      executionTimeMs: totalTime
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[cleanup-destinations] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

function isGenericDescription(description: string | null): boolean {
  if (!description) return true;
  
  const genericPatterns = [
    /This .+ city embodies/i,
    /showcases .+ culture through its/i,
    /is a distinctive .+ destination/i,
    /offering cultural heritage/i,
    /historic architecture, and local traditions/i,
    /Central Market Square City Museum Municipal Park/i,
  ];
  
  return genericPatterns.some(pattern => pattern.test(description));
}

function needsImageFix(url: string | null): boolean {
  if (!url) return true;
  
  // Check for deprecated source.unsplash.com
  if (url.includes('source.unsplash.com')) return true;
  
  // Check for generic search queries
  if (url.includes('-historic') || url.includes('-famous')) return true;
  
  return false;
}

function hasGenericPOIs(pois: unknown): boolean {
  if (!pois || !Array.isArray(pois) || pois.length === 0) return true;
  
  const genericPOIs = [
    'Cathedral Historic Old Town',
    'Central Market Square',
    'City Museum',
    'Municipal Park',
    'Plaza Mayor'
  ];
  
  // If most POIs are generic
  const genericCount = pois.filter((poi: string) => 
    genericPOIs.some(generic => poi.includes(generic))
  ).length;
  
  return genericCount > pois.length / 2;
}

async function cleanDestinationWithAI(
  dest: Destination, 
  apiKey: string
): Promise<CleanedDestination | null> {
  const prompt = `You are a travel data specialist. Clean and improve this destination data for "${dest.city}, ${dest.country}" (Region: ${dest.region || 'Unknown'}).

Current data:
- Description: ${dest.description || 'Missing'}
- Known for: ${JSON.stringify(dest.known_for || [])}
- Points of interest: ${JSON.stringify(dest.points_of_interest || [])}
- Currency code: ${dest.currency_code || 'Missing'}
- Seasonality: ${dest.seasonality || 'Missing'}
- Best time to visit: ${dest.best_time_to_visit || 'Missing'}
- Temperature range: ${dest.temperature_range || 'Missing'}
- Cost tier: ${dest.cost_tier || 'Missing'}
- Timezone: ${dest.timezone || 'Missing'}

Please provide improved, accurate data. Return a JSON object with these fields:
1. "description": A compelling 2-3 sentence description that's unique to this specific destination (not generic). Mention what makes it special.
2. "knownFor": Array of 5-7 specific things this destination is actually known for (not generic like "culture" or "food")
3. "pointsOfInterest": Array of 5-7 real, specific attractions/landmarks in this destination
4. "imageSearchQuery": A specific search query to find a beautiful, iconic photo of this destination (e.g., "Eiffel Tower Paris sunset" not just "Paris")
5. "currencyCode": The ISO 4217 currency code for this country (e.g., "USD", "EUR", "KRW", "JPY")
6. "seasonality": Travel seasonality info in format "peak: month1,month2, shoulder: month3,month4, off: month5,month6,month7"
7. "bestTimeToVisit": Human-readable best time to visit (e.g., "March to May, September to November")
8. "temperatureRange": Typical temperature range (e.g., "15°C to 30°C (59°F to 86°F)")
9. "costTier": One of: "budget", "moderate", "expensive", "luxury"
10. "timezone": IANA timezone (e.g., "Asia/Seoul", "Europe/Paris", "America/New_York")

Only return valid JSON, no markdown or explanation.`;

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Use lite model for speed
        messages: [
          { role: "system", content: "You are a travel data specialist. Always return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5, // Lower temperature for more consistent results
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
    
    // Build proper Unsplash URL from search query
    const searchQuery = encodeURIComponent(parsed.imageSearchQuery || `${dest.city} ${dest.country} landmark`);
    const imageUrl = `https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=80&fm=jpg&search=${searchQuery}`;

    return {
      description: parsed.description,
      imageUrl,
      knownFor: parsed.knownFor || [],
      pointsOfInterest: parsed.pointsOfInterest || [],
      tags: dest.tags || [],
      currencyCode: parsed.currencyCode || '',
      seasonality: parsed.seasonality || '',
      bestTimeToVisit: parsed.bestTimeToVisit || '',
      temperatureRange: parsed.temperatureRange || '',
      costTier: parsed.costTier || '',
      timezone: parsed.timezone || ''
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[cleanup-destinations] AI timeout for ${dest.city}`);
    } else {
      console.error(`[cleanup-destinations] AI cleanup failed for ${dest.city}:`, error);
    }
    return null;
  }
}
