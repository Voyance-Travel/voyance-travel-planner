import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AI Preference Enrichment Layer
 * 
 * Takes raw user preferences (short answers) and "fluffs" them into 
 * rich, detailed context that the itinerary AI can use for deep personalization.
 * 
 * Example:
 * Input: dietary_restrictions: ["vegetarian", "nut_allergy"]
 * Output: "This traveler follows a vegetarian diet - no meat, poultry, or fish. 
 *         They also have a severe nut allergy which requires careful attention at 
 *         restaurants. Always recommend vegetarian-friendly restaurants with clear 
 *         allergen labeling. Avoid Thai, Southeast Asian, and certain dessert-focused 
 *         venues where nuts are commonly used in sauces and garnishes."
 */

interface RawPreferences {
  // Core
  interests?: string[];
  travel_pace?: string;
  budget_tier?: string;
  activity_level?: string;
  travel_vibes?: string[];
  traveler_type?: string;
  
  // Dietary (CRITICAL)
  dietary_restrictions?: string[];
  dining_style?: string;
  food_likes?: string[];
  food_dislikes?: string[];
  
  // Accessibility (CRITICAL)
  accessibility_needs?: string[];
  mobility_level?: string;
  mobility_needs?: string;
  
  // Climate (DIFFERENTIATOR)
  climate_preferences?: string[];
  weather_preferences?: string[];
  
  // Accommodation
  hotel_style?: string;
  accommodation_style?: string;
  
  // Flight
  flight_time_preference?: string;
  seat_preference?: string;
  direct_flights_only?: boolean;
  
  // Other
  eco_friendly?: boolean;
  preferred_regions?: string[];
}

interface EnrichedPreferences {
  traveler_persona: string;
  dietary_context: string;
  accessibility_context: string;
  climate_context: string;
  activity_context: string;
  accommodation_context: string;
  special_instructions: string[];
}

async function enrichWithAI(raw: RawPreferences, destination?: string): Promise<EnrichedPreferences> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.warn("No LOVABLE_API_KEY, using fallback enrichment");
    return fallbackEnrichment(raw);
  }

  const prompt = `You are a travel personalization expert. Transform these raw user preferences into rich, actionable context for an AI itinerary generator.

RAW PREFERENCES:
${JSON.stringify(raw, null, 2)}

${destination ? `DESTINATION: ${destination}` : ''}

Create enriched context that:
1. Expands brief answers into detailed guidance
2. Adds implicit preferences based on stated ones
3. Includes specific dos and don'ts
4. Provides venue/activity type recommendations
5. Highlights critical constraints (dietary, accessibility)

Return a JSON object with these fields:
- traveler_persona: 2-3 sentences describing this traveler's style and what makes them tick
- dietary_context: Detailed dietary guidance including restaurant types to seek/avoid, specific cuisine considerations
- accessibility_context: Comprehensive accessibility requirements, venue restrictions, transportation needs
- climate_context: Weather preferences translated to activity timing, indoor/outdoor balance, seasonal considerations
- activity_context: What activities to prioritize, pacing guidance, interests translated to specific venue types
- accommodation_context: Hotel preferences, amenities that matter, location priorities
- special_instructions: Array of 3-5 specific "always" or "never" rules for this traveler`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a travel personalization expert. Return ONLY valid JSON, no markdown or explanations." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("AI enrichment failed:", response.status);
      return fallbackEnrichment(raw);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as EnrichedPreferences;
    }
    
    return fallbackEnrichment(raw);
  } catch (error) {
    console.error("AI enrichment error:", error);
    return fallbackEnrichment(raw);
  }
}

function fallbackEnrichment(raw: RawPreferences): EnrichedPreferences {
  const specialInstructions: string[] = [];
  
  // Build traveler persona
  const personaTraits: string[] = [];
  if (raw.traveler_type) personaTraits.push(raw.traveler_type.replace(/_/g, ' '));
  if (raw.travel_pace) personaTraits.push(`${raw.travel_pace} pace traveler`);
  if (raw.travel_vibes?.length) personaTraits.push(`drawn to ${raw.travel_vibes.slice(0, 2).join(' and ')} atmospheres`);
  
  const traveler_persona = personaTraits.length > 0 
    ? `This is a ${personaTraits.join(', ')}. ${raw.eco_friendly ? 'They prioritize sustainable and eco-friendly options.' : ''}`
    : "A flexible traveler open to various experiences.";

  // Dietary context
  let dietary_context = "";
  if (raw.dietary_restrictions?.length) {
    const restrictions = raw.dietary_restrictions;
    dietary_context = `CRITICAL DIETARY REQUIREMENTS: ${restrictions.join(', ')}. `;
    
    if (restrictions.includes('vegetarian')) {
      dietary_context += "No meat, poultry, or fish. Recommend vegetarian-friendly restaurants with clear menu labeling. ";
      specialInstructions.push("ALWAYS verify vegetarian options before recommending any restaurant");
    }
    if (restrictions.includes('vegan')) {
      dietary_context += "No animal products whatsoever including dairy, eggs, and honey. Seek dedicated vegan establishments. ";
      specialInstructions.push("NEVER recommend restaurants without verified vegan options");
    }
    if (restrictions.some(r => r.includes('allergy') || r.includes('nut') || r.includes('shellfish'))) {
      dietary_context += "SEVERE ALLERGY - this is a safety concern. Only recommend restaurants with clear allergen protocols. ";
      specialInstructions.push("CRITICAL: Always warn about potential allergen exposure at food venues");
    }
    if (restrictions.includes('kosher')) {
      dietary_context += "Strictly kosher diet required. Seek certified kosher restaurants or vegetarian alternatives. ";
    }
    if (restrictions.includes('halal')) {
      dietary_context += "Halal meat required. Recommend halal-certified restaurants or vegetarian options. ";
    }
  } else {
    dietary_context = "No dietary restrictions. Free to recommend any cuisine.";
  }
  
  if (raw.dining_style) {
    dietary_context += ` Dining preference: ${raw.dining_style}.`;
  }

  // Accessibility context
  let accessibility_context = "";
  if (raw.mobility_level && raw.mobility_level !== 'full') {
    accessibility_context = `MOBILITY LEVEL: ${raw.mobility_level}. `;
    specialInstructions.push("ALWAYS verify wheelchair/mobility accessibility before recommending any venue");
  }
  
  if (raw.accessibility_needs?.length) {
    accessibility_context += `Required accommodations: ${raw.accessibility_needs.join(', ')}. `;
    accessibility_context += "All venues must be accessible. Avoid recommendations involving long walks, steep stairs, cobblestone streets, or inaccessible transportation.";
    specialInstructions.push("NEVER recommend venues without step-free access if mobility aids are needed");
  } else if (!accessibility_context) {
    accessibility_context = "No specific accessibility requirements. Full mobility assumed.";
  }

  // Climate context
  let climate_context = "";
  if (raw.climate_preferences?.length || raw.weather_preferences?.length) {
    const prefs = [...(raw.climate_preferences || []), ...(raw.weather_preferences || [])];
    climate_context = `Climate preferences: ${prefs.join(', ')}. `;
    
    if (prefs.includes('tropical') || prefs.includes('warm')) {
      climate_context += "Prefers warm weather. Schedule outdoor activities for optimal weather windows. Recommend shaded venues during peak heat. ";
    }
    if (prefs.includes('temperate') || prefs.includes('mild')) {
      climate_context += "Enjoys mild weather. Balance outdoor exploration with indoor cultural experiences. ";
    }
    if (prefs.includes('cold') || prefs.includes('cool')) {
      climate_context += "Comfortable in cooler temperatures. Can handle more outdoor time but include cozy indoor breaks. ";
    }
    
    climate_context += "Always have indoor backup options for weather-sensitive activities.";
  } else {
    climate_context = "Flexible about weather. Adaptable to various climate conditions.";
  }

  // Activity context
  let activity_context = "";
  if (raw.interests?.length) {
    activity_context = `Primary interests: ${raw.interests.join(', ')}. `;
    
    // Map interests to specific venue types
    if (raw.interests.includes('food') || raw.interests.includes('culinary')) {
      activity_context += "Prioritize unique dining experiences, food markets, cooking classes, and local culinary gems. ";
    }
    if (raw.interests.includes('art') || raw.interests.includes('culture')) {
      activity_context += "Include museums, galleries, cultural centers, and historically significant sites. ";
    }
    if (raw.interests.includes('nature') || raw.interests.includes('outdoors')) {
      activity_context += "Feature parks, gardens, hiking trails, and natural landmarks. ";
    }
    if (raw.interests.includes('adventure')) {
      activity_context += "Incorporate active experiences, unique adventures, and off-the-beaten-path discoveries. ";
    }
    if (raw.interests.includes('wellness') || raw.interests.includes('relaxation')) {
      activity_context += "Include spa time, meditation spots, yoga classes, or peaceful retreats. ";
    }
  }
  
  if (raw.activity_level) {
    activity_context += `Activity level: ${raw.activity_level}. `;
  }
  if (raw.travel_pace) {
    activity_context += `Pace: ${raw.travel_pace} - ${
      raw.travel_pace === 'relaxed' ? '1-2 activities per day with plenty of downtime' :
      raw.travel_pace === 'moderate' ? '3-4 activities with breaks' :
      '5+ activities, maximize every moment'
    }.`;
  }

  // Accommodation context
  let accommodation_context = "";
  if (raw.hotel_style) {
    accommodation_context = `Hotel style preference: ${raw.hotel_style}. `;
  }
  if (raw.accommodation_style) {
    accommodation_context += `Accommodation type: ${raw.accommodation_style}. `;
  }
  if (raw.eco_friendly) {
    accommodation_context += "Prefer eco-certified and sustainable properties. ";
  }
  
  if (!accommodation_context) {
    accommodation_context = "Open to various accommodation styles based on location and value.";
  }

  // Add general instructions
  if (raw.eco_friendly) {
    specialInstructions.push("PREFER eco-friendly and sustainable options when available");
  }
  if (raw.direct_flights_only) {
    specialInstructions.push("Only recommend travel involving direct transportation when possible");
  }

  return {
    traveler_persona,
    dietary_context,
    accessibility_context,
    climate_context,
    activity_context,
    accommodation_context,
    special_instructions: specialInstructions.length > 0 ? specialInstructions : ["No special constraints"]
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('enrich_preferences', 'google/gemini-3-flash-preview');

  try {
    const { preferences, destination, userId } = await req.json();

    if (!preferences) {
      return new Response(
        JSON.stringify({ error: "Preferences object required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userId) costTracker.setUserId(userId);

    console.log(`Enriching preferences for user ${userId || 'anonymous'}, destination: ${destination || 'unspecified'}`);

    const enriched = await enrichWithAI(preferences, destination);

    console.log("Enrichment complete:", {
      hasPersona: !!enriched.traveler_persona,
      hasDietary: !!enriched.dietary_context,
      hasAccessibility: !!enriched.accessibility_context,
      instructionCount: enriched.special_instructions?.length || 0
    });

    // Track AI usage (estimate tokens since we don't have response object here)
    costTracker.recordTokens(500, 800);
    await costTracker.save();

    return new Response(
      JSON.stringify({ 
        success: true, 
        enriched,
        raw: preferences // Include original for comparison
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Preference enrichment error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Preference enrichment failed", code: "ENRICHMENT_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
