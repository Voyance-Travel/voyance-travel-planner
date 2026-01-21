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
}

interface CleanedDestination {
  description: string;
  imageUrl: string;
  knownFor: string[];
  pointsOfInterest: string[];
  tags: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { batchSize = 10, offset = 0, dryRun = true } = await req.json();

    // Fetch destinations that need cleanup
    const { data: destinations, error: fetchError } = await supabase
      .from('destinations')
      .select('id, city, country, region, description, stock_image_url, tags, known_for, points_of_interest, cost_tier, timezone, currency_code')
      .order('city')
      .range(offset, offset + batchSize - 1);

    if (fetchError) throw fetchError;
    if (!destinations || destinations.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No more destinations to process',
        processed: 0,
        offset,
        complete: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: { id: string; city: string; status: string; changes?: object }[] = [];

    for (const dest of destinations) {
      try {
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

          // Improve known_for if empty or generic
          if (!dest.known_for || dest.known_for.length < 3) {
            updates.known_for = cleaned.knownFor;
            hasChanges = true;
          }

          // Improve points_of_interest if generic
          if (hasGenericPOIs(dest.points_of_interest)) {
            updates.points_of_interest = cleaned.pointsOfInterest;
            hasChanges = true;
          }

          if (hasChanges) {
            if (!dryRun) {
              const { error: updateError } = await supabase
                .from('destinations')
                .update(updates)
                .eq('id', dest.id);
              
              if (updateError) throw updateError;
            }
            
            results.push({
              id: dest.id,
              city: dest.city,
              status: dryRun ? 'would_update' : 'updated',
              changes: updates
            });
          } else {
            results.push({ id: dest.id, city: dest.city, status: 'no_changes_needed' });
          }
        }
      } catch (destError) {
        console.error(`Error processing ${dest.city}:`, destError);
        results.push({ 
          id: dest.id, 
          city: dest.city, 
          status: 'error',
          changes: { error: destError instanceof Error ? destError.message : 'Unknown error' }
        });
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${destinations.length} destinations`,
      dryRun,
      processed: destinations.length,
      offset,
      nextOffset: offset + batchSize,
      results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Cleanup error:', error);
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

function hasGenericPOIs(pois: string[] | null): boolean {
  if (!pois || pois.length === 0) return true;
  
  const genericPOIs = [
    'Cathedral Historic Old Town',
    'Central Market Square',
    'City Museum',
    'Municipal Park',
    'Plaza Mayor'
  ];
  
  // If most POIs are generic
  const genericCount = pois.filter(poi => 
    genericPOIs.some(generic => poi.includes(generic))
  ).length;
  
  return genericCount > pois.length / 2;
}

async function cleanDestinationWithAI(
  dest: Destination, 
  apiKey: string
): Promise<CleanedDestination | null> {
  const prompt = `You are a travel data specialist. Clean and improve this destination data for "${dest.city}, ${dest.country}".

Current data:
- Description: ${dest.description || 'Missing'}
- Known for: ${JSON.stringify(dest.known_for || [])}
- Points of interest: ${JSON.stringify(dest.points_of_interest || [])}

Please provide improved, accurate data. Return a JSON object with these fields:
1. "description": A compelling 2-3 sentence description that's unique to this specific destination (not generic). Mention what makes it special.
2. "knownFor": Array of 5-7 specific things this destination is actually known for (not generic like "culture" or "food")
3. "pointsOfInterest": Array of 5-7 real, specific attractions/landmarks in this destination
4. "imageSearchQuery": A specific search query to find a beautiful, iconic photo of this destination (e.g., "Eiffel Tower Paris sunset" not just "Paris")

Only return valid JSON, no markdown or explanation.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a travel data specialist. Always return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

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
      tags: dest.tags || []
    };
  } catch (error) {
    console.error(`AI cleanup failed for ${dest.city}:`, error);
    return null;
  }
}
