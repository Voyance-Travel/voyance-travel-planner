import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  local_tips: string[] | null;
  getting_around: string | null;
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

    const { batchSize = 10, offset = 0, dryRun = true, priorityOnly = false } = await req.json();
    console.log(`[enrich-destinations] Processing batch: offset=${offset}, batchSize=${batchSize}, dryRun=${dryRun}`);

    // Fetch destinations needing transport/local knowledge enrichment
    let query = supabase
      .from('destinations')
      .select('id, city, country, region, description, default_transport_modes, known_for, points_of_interest')
      .or('default_transport_modes.is.null,default_transport_modes.eq.[],local_tips.is.null,local_tips.eq.[]');
    
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

    // Process in parallel batches of 4 for speed
    const PARALLEL_SIZE = 4;
    for (let i = 0; i < destinations.length; i += PARALLEL_SIZE) {
      // Check if we're running low on time (50s safety margin)
      if (Date.now() - startTime > 50000) {
        console.log(`[enrich-destinations] Time limit approaching, stopping early`);
        for (let j = i; j < destinations.length; j++) {
          results.push({ id: destinations[j].id, city: destinations[j].city, status: 'skipped_timeout' });
        }
        break;
      }

      const batch = destinations.slice(i, i + PARALLEL_SIZE);
      const batchResults = await Promise.all(batch.map(async (dest) => {
        const destStartTime = Date.now();
        try {
          console.log(`[enrich-destinations] Enriching: ${dest.city}, ${dest.country}`);
          
          const enriched = await enrichWithLocalKnowledge(dest, LOVABLE_API_KEY);
          
          if (enriched) {
            const updates: Record<string, unknown> = {
              default_transport_modes: enriched.transportModes,
              local_tips: enriched.localTips,
              safety_tips: enriched.safetyTips,
              getting_around: enriched.gettingAround,
              best_neighborhoods: enriched.bestNeighborhoods,
              food_scene: enriched.foodScene,
              nightlife_info: enriched.nightlife,
              dress_code: enriched.dressCode,
              tipping_custom: enriched.tippingCustom,
              common_scams: enriched.commonScams,
              emergency_numbers: enriched.emergencyNumbers,
              last_local_knowledge_update: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            if (!dest.description || dest.description.length < 100) {
              updates.description = enriched.description;
            }
            if (!dest.known_for || dest.known_for.length < 5) {
              updates.known_for = enriched.knownFor;
            }
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
            
            return {
              id: dest.id,
              city: dest.city,
              status: dryRun ? 'would_update' : 'updated',
              changes: {
                transportModes: enriched.transportModes,
                localTips: enriched.localTips,
                gettingAround: enriched.gettingAround
              }
            };
          } else {
            console.log(`[enrich-destinations] ${dest.city}: AI returned null`);
            return { id: dest.id, city: dest.city, status: 'ai_failed' };
          }
        } catch (destError) {
          console.error(`[enrich-destinations] Error processing ${dest.city}:`, destError);
          return { 
            id: dest.id, 
            city: dest.city, 
            status: 'error',
            changes: { error: destError instanceof Error ? destError.message : 'Unknown error' }
          };
        }
      }));
      
      results.push(...batchResults);
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
  // Use existing data to ground the AI and reduce hallucinations
  const existingContext = `
EXISTING VERIFIED DATA (use this to ground your response):
- City: ${dest.city}
- Country: ${dest.country}
- Region: ${dest.region || 'Unknown'}
- Current description: ${dest.description || 'None'}
- Known for: ${JSON.stringify(dest.known_for || [])}
- Points of interest: ${JSON.stringify(dest.points_of_interest || [])}
`;

  const prompt = `You are an expert local travel guide for "${dest.city}, ${dest.country}". Provide practical, insider knowledge that helps travelers navigate like a local.

${existingContext}

CRITICAL INSTRUCTIONS TO AVOID HALLUCINATIONS:
1. ONLY provide information you are confident is accurate for THIS specific destination
2. For transport apps: Only mention apps that ACTUALLY operate in this country (e.g., Grab is Southeast Asia only, inDrive is popular in Middle East/Africa/Latin America, Bolt is Europe/Africa)
3. For emergency numbers: Use the REAL emergency numbers for this country (verify: most of Europe is 112, US is 911, etc.)
4. For scams: Only mention scams that are DOCUMENTED for this destination, not generic travel scams
5. If unsure about something specific, provide general but accurate regional guidance instead
6. DO NOT invent specific business names, addresses, or prices you're not sure about

Return a JSON object with:

1. "description": Compelling 3-4 sentence description highlighting what makes this destination unique. Build on existing description if available.

2. "transportModes": Array of transport options ACTUALLY AVAILABLE in ${dest.country}, each with:
   - "mode": Transport type (Metro, Bus, Taxi, Ride-share app name, Tuk-tuk, etc.)
   - "recommended": true/false - is this the BEST option for tourists?
   - "notes": Practical advice (be specific but accurate)
   - "appName": ONLY if a specific app operates here (Grab, Gojek, inDrive, Bolt, Uber, Lyft, Didi, etc.)
   - "estimatedCost": General cost range if known

3. "localTips": Array of 5-7 insider tips specific to ${dest.city} (NOT generic travel advice)

4. "safetyTips": Array of 3-5 safety considerations specific to this destination

5. "gettingAround": 2-3 sentence summary of best way to navigate the city

6. "knownFor": Array of 7-10 specific things this destination is famous for (build on existing if available)

7. "pointsOfInterest": Array of 8-12 REAL, VERIFIABLE attractions/landmarks (build on existing if available)

8. "bestNeighborhoods": Array of 4-6 REAL neighborhoods for different traveler types

9. "foodScene": 2-3 sentences about the food culture and what to try

10. "nightlife": 1-2 sentences about nightlife scene

11. "dressCode": Local dress expectations/customs

12. "tippingCustom": Accurate tipping guidance for ${dest.country}

13. "commonScams": Array of 2-4 DOCUMENTED scams for this destination (or empty array if none known)

14. "emergencyNumbers": Object with REAL numbers for ${dest.country}:
    - "police": National police number
    - "ambulance": Emergency medical number
    - "tourist": Tourist police or help line if exists (or "N/A")

Return ONLY valid JSON, no markdown or explanations.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Fast model for bulk processing
        messages: [
          { 
            role: "system", 
            content: "You are an expert travel consultant with deep local knowledge. CRITICAL: Only provide factual, verifiable information. If you're not sure about something, say so or provide general regional guidance. Never invent specific details. Always return valid JSON only." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.4, // Lower temperature for more factual responses
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
    
    // Validate transport modes - filter out obviously wrong apps for regions
    const validatedTransport = validateTransportModes(parsed.transportModes || [], dest.country);
    
    // Validate emergency numbers format
    const emergencyNumbers = validateEmergencyNumbers(parsed.emergencyNumbers, dest.country);
    
    return {
      description: parsed.description || '',
      transportModes: validatedTransport,
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
      emergencyNumbers
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

// Validate transport apps are actually available in the country
function validateTransportModes(modes: TransportMode[], country: string): TransportMode[] {
  // Regional app availability (simplified but helps catch obvious errors)
  const appRegions: Record<string, string[]> = {
    'Grab': ['Indonesia', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Singapore', 'Cambodia', 'Myanmar'],
    'Gojek': ['Indonesia', 'Singapore', 'Vietnam'],
    'inDrive': ['Morocco', 'Egypt', 'Nigeria', 'Kenya', 'South Africa', 'Colombia', 'Mexico', 'Brazil', 'Pakistan', 'India', 'Russia', 'Kazakhstan', 'Turkey'],
    'Bolt': ['Estonia', 'Latvia', 'Lithuania', 'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia', 'Slovakia', 'Austria', 'Germany', 'France', 'Spain', 'Portugal', 'Italy', 'UK', 'United Kingdom', 'Ireland', 'Sweden', 'Finland', 'Norway', 'Belgium', 'Netherlands', 'South Africa', 'Nigeria', 'Kenya', 'Ghana', 'Tanzania', 'Uganda'],
    'Uber': ['United States', 'USA', 'Canada', 'UK', 'United Kingdom', 'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Australia', 'New Zealand', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'Colombia', 'South Africa', 'India', 'Japan'],
    'Lyft': ['United States', 'USA', 'Canada'],
    'Didi': ['China', 'Mexico', 'Brazil', 'Chile', 'Colombia', 'Costa Rica', 'Dominican Republic', 'Ecuador', 'Panama', 'Peru'],
    'Careem': ['United Arab Emirates', 'UAE', 'Saudi Arabia', 'Egypt', 'Jordan', 'Pakistan', 'Qatar', 'Bahrain', 'Kuwait', 'Oman', 'Iraq', 'Morocco'],
    'Yandex': ['Russia', 'Kazakhstan', 'Belarus', 'Armenia', 'Georgia', 'Azerbaijan', 'Uzbekistan'],
  };
  
  return modes.map(mode => {
    if (mode.appName) {
      const validCountries = appRegions[mode.appName];
      if (validCountries && !validCountries.some(c => country.toLowerCase().includes(c.toLowerCase()))) {
        // App not available in this country - remove app name but keep mode
        console.log(`[validate] Removing ${mode.appName} from ${country} - not available in region`);
        return { ...mode, appName: undefined, notes: mode.notes + ' (App availability varies)' };
      }
    }
    return mode;
  });
}

// Validate and fix emergency numbers
function validateEmergencyNumbers(numbers: { police: string; ambulance: string; tourist: string } | undefined, country: string): { police: string; ambulance: string; tourist: string } {
  // Common emergency numbers by country/region
  const knownNumbers: Record<string, { police: string; ambulance: string }> = {
    'United States': { police: '911', ambulance: '911' },
    'USA': { police: '911', ambulance: '911' },
    'Canada': { police: '911', ambulance: '911' },
    'United Kingdom': { police: '999', ambulance: '999' },
    'UK': { police: '999', ambulance: '999' },
    'Australia': { police: '000', ambulance: '000' },
    'New Zealand': { police: '111', ambulance: '111' },
    // EU countries use 112
    'Germany': { police: '110', ambulance: '112' },
    'France': { police: '17', ambulance: '15' },
    'Spain': { police: '112', ambulance: '112' },
    'Italy': { police: '112', ambulance: '118' },
    'Netherlands': { police: '112', ambulance: '112' },
    'Belgium': { police: '112', ambulance: '112' },
    'Portugal': { police: '112', ambulance: '112' },
    'Greece': { police: '100', ambulance: '166' },
    // Asia
    'Japan': { police: '110', ambulance: '119' },
    'China': { police: '110', ambulance: '120' },
    'India': { police: '100', ambulance: '102' },
    'Thailand': { police: '191', ambulance: '1669' },
    'Indonesia': { police: '110', ambulance: '118' },
    'Malaysia': { police: '999', ambulance: '999' },
    'Singapore': { police: '999', ambulance: '995' },
    'Vietnam': { police: '113', ambulance: '115' },
    'Philippines': { police: '117', ambulance: '911' },
    // Middle East & Africa
    'UAE': { police: '999', ambulance: '998' },
    'United Arab Emirates': { police: '999', ambulance: '998' },
    'Morocco': { police: '19', ambulance: '15' },
    'Egypt': { police: '122', ambulance: '123' },
    'South Africa': { police: '10111', ambulance: '10177' },
    // Americas
    'Mexico': { police: '911', ambulance: '911' },
    'Brazil': { police: '190', ambulance: '192' },
    'Argentina': { police: '911', ambulance: '107' },
  };
  
  const defaults = knownNumbers[country] || { police: '112', ambulance: '112' }; // 112 is international standard
  
  if (!numbers) {
    return { ...defaults, tourist: 'N/A' };
  }
  
  return {
    police: numbers.police || defaults.police,
    ambulance: numbers.ambulance || defaults.ambulance,
    tourist: numbers.tourist || 'N/A'
  };
}
