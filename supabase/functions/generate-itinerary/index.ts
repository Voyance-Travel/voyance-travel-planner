import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface GenerationContext {
  tripId: string;
  userId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
  dailyBudget?: number;
  currency?: string;
}

interface StrictActivity {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  location: {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
  };
  cost: { amount: number; currency: string; formatted?: string };
  description: string;
  tags: string[];
  bookingRequired: boolean;
  transportation: {
    method: string;
    duration: string;
    estimatedCost: { amount: number; currency: string };
    instructions: string;
  };
  tips?: string;
  photos?: Array<{ url: string; photographer?: string; alt?: string }>;
  rating?: { value: number; totalReviews: number };
  verified?: { isValid: boolean; confidence: number; placeId?: string };
  durationMinutes?: number;
  categoryIcon?: string;
}

interface StrictDay {
  dayNumber: number;
  date: string;
  title: string;
  theme?: string;
  activities: StrictActivity[];
  metadata?: {
    theme?: string;
    totalEstimatedCost?: number;
    mealsIncluded?: number;
    pacingLevel?: 'relaxed' | 'moderate' | 'packed';
  };
}

interface TripOverview {
  bestTimeToVisit?: string;
  currency?: string;
  language?: string;
  transportationTips?: string;
  culturalTips?: string;
  budgetBreakdown?: {
    accommodations: number;
    activities: number;
    food: number;
    transportation: number;
    total: number;
  };
  highlights?: string[];
  localTips?: string[];
}

interface EnrichedItinerary {
  days: StrictDay[];
  overview?: TripOverview;
  enrichmentMetadata: {
    enrichedAt: string;
    geocodedActivities: number;
    verifiedActivities: number;
    photosAdded: number;
    totalActivities: number;
  };
}

// =============================================================================
// STRICT SCHEMA FOR AI GENERATION (Tool Definition)
// =============================================================================

const STRICT_ITINERARY_TOOL = {
  type: "function",
  function: {
    name: "create_complete_itinerary",
    description: "Creates a complete, structured travel itinerary with all required details",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "array",
          description: "Array of daily itinerary plans",
          items: {
            type: "object",
            properties: {
              dayNumber: { type: "integer", minimum: 1 },
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              title: { type: "string", description: "Day title (e.g., 'Historic Exploration')" },
              activities: {
                type: "array",
                minItems: 3,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    startTime: { type: "string", description: "HH:MM format (24-hour)" },
                    endTime: { type: "string", description: "HH:MM format (24-hour)" },
                    category: {
                      type: "string",
                      enum: ["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"]
                    },
                    location: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Venue name" },
                        address: { type: "string", description: "Full street address with city and postal code" }
                      },
                      required: ["name", "address"]
                    },
                    cost: {
                      type: "object",
                      properties: {
                        amount: { type: "number", minimum: 0 },
                        currency: { type: "string" }
                      },
                      required: ["amount", "currency"]
                    },
                    description: { type: "string", description: "Activity description (2-3 sentences)" },
                    tags: { type: "array", items: { type: "string" }, minItems: 2 },
                    bookingRequired: { type: "boolean" },
                    transportation: {
                      type: "object",
                      properties: {
                        method: { type: "string", enum: ["walk", "metro", "bus", "taxi", "uber", "tram", "train", "car"] },
                        duration: { type: "string" },
                        estimatedCost: {
                          type: "object",
                          properties: {
                            amount: { type: "number" },
                            currency: { type: "string" }
                          },
                          required: ["amount", "currency"]
                        },
                        instructions: { type: "string" }
                      },
                      required: ["method", "duration", "estimatedCost", "instructions"]
                    },
                    tips: { type: "string", description: "Insider tip or recommendation" }
                  },
                  required: ["id", "title", "startTime", "endTime", "category", "location", "cost", "description", "tags", "bookingRequired", "transportation"]
                }
              }
            },
            required: ["dayNumber", "date", "title", "activities"]
          }
        }
      },
      required: ["days"]
    }
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLearnedPreferences(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preference_insights')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserPreferences(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('interests, travel_pace, budget_tier, dining_style, activity_level')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPreferenceContext(insights: any, prefs: any): string {
  const parts: string[] = [];

  if (insights) {
    const lovedTypes = Object.entries(insights.loved_activity_types || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    if (lovedTypes.length > 0) {
      parts.push(`Traveler LOVES: ${lovedTypes.join(', ')}`);
    }

    const dislikedTypes = Object.entries(insights.disliked_activity_types || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    if (dislikedTypes.length > 0) {
      parts.push(`AVOID: ${dislikedTypes.join(', ')}`);
    }

    if (insights.preferred_pace) {
      parts.push(`Preferred pace: ${insights.preferred_pace}`);
    }
  }

  if (prefs) {
    if (prefs.interests?.length) {
      parts.push(`Interests: ${prefs.interests.slice(0, 5).join(', ')}`);
    }
    if (prefs.travel_pace) {
      parts.push(`Travel pace: ${prefs.travel_pace}`);
    }
    if (prefs.dining_style) {
      parts.push(`Dining style: ${prefs.dining_style}`);
    }
  }

  return parts.length > 0 ? `\n\n🎯 USER PREFERENCES:\n${parts.join('\n')}` : '';
}

function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(startDate: string, dayOffset: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split('T')[0];
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function calculateDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    sightseeing: 'map-pin',
    dining: 'utensils',
    cultural: 'landmark',
    shopping: 'shopping-bag',
    relaxation: 'spa',
    transport: 'car',
    accommodation: 'bed',
    activity: 'activity'
  };
  return icons[category] || 'star';
}

// =============================================================================
// STAGE 1: CONTEXT PREPARATION
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function prepareContext(supabase: any, tripId: string, userId?: string): Promise<GenerationContext | null> {
  console.log(`[Stage 1] Preparing context for trip ${tripId}`);

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    console.error('[Stage 1] Trip not found:', error);
    return null;
  }

  const totalDays = calculateDays(trip.start_date, trip.end_date);

  const context: GenerationContext = {
    tripId: trip.id,
    userId: userId || trip.user_id,
    destination: trip.destination,
    destinationCountry: trip.destination_country,
    startDate: trip.start_date,
    endDate: trip.end_date,
    totalDays,
    travelers: trip.travelers || 1,
    tripType: trip.trip_type,
    budgetTier: trip.budget_tier,
    pace: trip.metadata?.pace || 'moderate',
    interests: trip.metadata?.interests || [],
    currency: 'USD'
  };

  // Set daily budget based on tier
  const budgetMap: Record<string, number> = {
    budget: 75,
    economy: 100,
    standard: 150,
    comfort: 200,
    premium: 300,
    luxury: 500
  };
  context.dailyBudget = budgetMap[context.budgetTier || 'standard'] || 150;

  console.log(`[Stage 1] Context prepared: ${context.totalDays} days in ${context.destination}`);
  return context;
}

// =============================================================================
// STAGE 2: AI GENERATION WITH STRICT SCHEMA
// =============================================================================

async function generateItineraryAI(
  context: GenerationContext,
  preferenceContext: string,
  LOVABLE_API_KEY: string
): Promise<{ days: StrictDay[] } | null> {
  console.log(`[Stage 2] Starting AI generation for ${context.totalDays} days`);

  const systemPrompt = `You are an expert travel planner creating personalized itineraries. Your itineraries are:
- Realistic with proper timing and logistics
- Include a balanced mix of experiences (cultural, culinary, relaxation, activities)
- Feature local hidden gems alongside popular attractions
- Account for travel time between activities
- Tailored to the traveler's preferences and budget

CRITICAL REQUIREMENTS:
1. EVERY activity MUST have a complete street address (not just venue name)
2. EVERY activity MUST have realistic cost estimates
3. Include 4-6 activities per day including meals
4. Start days around 9:00 AM and end by 9:00-10:00 PM
5. Account for travel time between activities
6. Include transportation instructions between each activity`;

  const daysList = [];
  for (let i = 0; i < context.totalDays; i++) {
    daysList.push(`Day ${i + 1}: ${formatDate(context.startDate, i)}`);
  }

  const userPrompt = `Generate a complete ${context.totalDays}-day itinerary for ${context.destination}${context.destinationCountry ? `, ${context.destinationCountry}` : ''}.

TRIP DETAILS:
- Dates: ${context.startDate} to ${context.endDate}
- Duration: ${context.totalDays} days
- Travelers: ${context.travelers}
- Budget tier: ${context.budgetTier || 'standard'} (~$${context.dailyBudget}/day per person)
- Trip type: ${context.tripType || 'leisure'}
- Pace: ${context.pace || 'moderate'}
${preferenceContext}

Generate activities for these days:
${daysList.join('\n')}

For each activity, provide:
- A unique ID (format: "day1-act1", "day1-act2", etc.)
- Specific venue name and FULL street address (including city and postal code)
- Realistic cost estimates in ${context.currency || 'USD'}
- Category (sightseeing, dining, cultural, shopping, relaxation, transport, accommodation, activity)
- Start and end times in HH:MM format
- Description (2-3 sentences)
- At least 2-3 relevant tags
- Whether booking is required
- Transportation from previous location (method, duration, cost, instructions)
- An insider tip

Create a well-paced, authentic travel experience!`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [STRICT_ITINERARY_TOOL],
        tool_choice: { type: "function", function: { name: "create_complete_itinerary" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error(`[Stage 2] AI Gateway error: ${status}`, errorText);
      throw new Error(status === 429 ? 'Rate limit exceeded' : status === 402 ? 'Credits exhausted' : 'AI generation failed');
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("[Stage 2] No tool call in response");
      throw new Error("Invalid AI response format");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log(`[Stage 2] Generated ${result.days?.length || 0} days`);

    // Enhance activities with calculated fields
    result.days = result.days.map((day: StrictDay) => ({
      ...day,
      activities: day.activities.map((act: StrictActivity) => ({
        ...act,
        durationMinutes: calculateDuration(act.startTime, act.endTime),
        categoryIcon: getCategoryIcon(act.category),
        cost: {
          ...act.cost,
          formatted: `$${act.cost.amount} ${act.cost.currency}`
        }
      }))
    }));

    return result;
  } catch (error) {
    console.error("[Stage 2] Generation error:", error);
    throw error;
  }
}

// =============================================================================
// STAGE 3: EARLY SAVE (Critical - ensures user gets itinerary even if later stages fail)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function earlySaveItinerary(supabase: any, tripId: string, days: StrictDay[]): Promise<boolean> {
  console.log(`[Stage 3] Early save for trip ${tripId} with ${days.length} days`);

  try {
    const totalActivities = days.reduce((sum, day) => sum + day.activities.length, 0);

    const itineraryData = {
      days,
      status: 'generating', // Will be updated to 'ready' after full enrichment
      generatedAt: new Date().toISOString(),
      enrichmentMetadata: {
        enrichedAt: new Date().toISOString(),
        geocodedActivities: 0,
        verifiedActivities: 0,
        photosAdded: 0,
        totalActivities
      }
    };

    const { error } = await supabase
      .from('trips')
      .update({
        itinerary_data: itineraryData,
        itinerary_status: 'generating',
        updated_at: new Date().toISOString()
      })
      .eq('id', tripId);

    if (error) {
      console.error('[Stage 3] Early save failed:', error);
      return false;
    }

    console.log(`[Stage 3] Early save successful - ${totalActivities} activities`);
    return true;
  } catch (e) {
    console.error('[Stage 3] Early save error:', e);
    return false;
  }
}

// =============================================================================
// STAGE 4: ENRICHMENT (Photos via Pexels, Geocoding placeholders)
// =============================================================================

async function enrichActivity(
  activity: StrictActivity,
  destination: string,
  pexelsApiKey?: string
): Promise<StrictActivity> {
  const enriched = { ...activity };

  // Add photos via Pexels API if available
  if (pexelsApiKey) {
    try {
      const query = encodeURIComponent(`${activity.title} ${destination}`);
      const response = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=2`, {
        headers: { Authorization: pexelsApiKey }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.photos?.length > 0) {
          enriched.photos = data.photos.slice(0, 2).map((photo: { src: { medium: string }; photographer: string; alt: string }) => ({
            url: photo.src.medium,
            photographer: photo.photographer,
            alt: photo.alt || activity.title
          }));
        }
      }
    } catch (e) {
      console.log(`[Stage 4] Photo enrichment failed for ${activity.title}:`, e);
    }
  }

  // Mark as verified with confidence (placeholder for Google Places integration)
  enriched.verified = {
    isValid: true,
    confidence: 0.75 // Would be higher with actual Places API verification
  };

  return enriched;
}

async function enrichItinerary(
  days: StrictDay[],
  destination: string,
  pexelsApiKey?: string
): Promise<StrictDay[]> {
  console.log(`[Stage 4] Starting enrichment for ${days.length} days`);

  const enrichedDays: StrictDay[] = [];
  let totalPhotos = 0;

  for (const day of days) {
    const enrichedActivities: StrictActivity[] = [];

    // Process activities in batches of 3 to avoid rate limiting
    for (let i = 0; i < day.activities.length; i += 3) {
      const batch = day.activities.slice(i, i + 3);
      const enrichedBatch = await Promise.all(
        batch.map(act => enrichActivity(act, destination, pexelsApiKey))
      );
      enrichedActivities.push(...enrichedBatch);
      totalPhotos += enrichedBatch.filter(a => a.photos?.length).length;

      // Small delay between batches
      if (i + 3 < day.activities.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Calculate day metadata
    const totalCost = enrichedActivities.reduce((sum, a) => sum + (a.cost?.amount || 0), 0);
    const mealsCount = enrichedActivities.filter(a => a.category === 'dining').length;
    const activityCount = enrichedActivities.length;

    enrichedDays.push({
      ...day,
      activities: enrichedActivities,
      metadata: {
        theme: day.title,
        totalEstimatedCost: totalCost,
        mealsIncluded: mealsCount,
        pacingLevel: activityCount <= 3 ? 'relaxed' : activityCount <= 5 ? 'moderate' : 'packed'
      }
    });
  }

  console.log(`[Stage 4] Enrichment complete - ${totalPhotos} photos added`);
  return enrichedDays;
}

// =============================================================================
// STAGE 5: TRIP OVERVIEW GENERATION
// =============================================================================

function generateTripOverview(days: StrictDay[], context: GenerationContext): TripOverview {
  console.log('[Stage 5] Generating trip overview');

  // Calculate budget breakdown
  let activitiesCost = 0;
  let foodCost = 0;
  let transportationCost = 0;

  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.category === 'dining') {
        foodCost += activity.cost?.amount || 0;
      } else {
        activitiesCost += activity.cost?.amount || 0;
      }
      transportationCost += activity.transportation?.estimatedCost?.amount || 0;
    }
  }

  // Estimate accommodations (35% of activities + food)
  const subtotal = activitiesCost + foodCost + transportationCost;
  const accommodations = Math.round(subtotal * 0.35);

  // Extract highlights (most expensive/featured activities)
  const allActivities = days.flatMap(d => d.activities);
  const highlights = allActivities
    .filter(a => a.category === 'sightseeing' || a.category === 'cultural')
    .sort((a, b) => (b.cost?.amount || 0) - (a.cost?.amount || 0))
    .slice(0, 5)
    .map(a => a.title);

  const overview: TripOverview = {
    currency: context.currency || 'USD',
    budgetBreakdown: {
      accommodations: Math.round(accommodations),
      activities: Math.round(activitiesCost),
      food: Math.round(foodCost),
      transportation: Math.round(transportationCost),
      total: Math.round(subtotal + accommodations)
    },
    highlights: highlights.length > 0 ? highlights : ['Explore local attractions', 'Enjoy authentic cuisine'],
    localTips: [
      'Book popular attractions in advance',
      'Try local restaurants away from tourist areas',
      'Use public transportation for authentic experiences',
      'Learn a few phrases in the local language',
      'Keep some local currency for small vendors'
    ]
  };

  console.log(`[Stage 5] Overview generated - Total budget: $${overview.budgetBreakdown?.total}`);
  return overview;
}

// =============================================================================
// STAGE 6: FINAL SAVE
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function finalSaveItinerary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  enrichedData: EnrichedItinerary,
  context: GenerationContext
): Promise<boolean> {
  console.log(`[Stage 6] Final save for trip ${tripId}`);

  try {
    const frontendReadyData = {
      success: true,
      status: 'ready',
      destination: context.destination,
      title: `${context.destination} - ${context.totalDays} Days`,
      tripId: context.tripId,
      totalDays: context.totalDays,
      itinerary: {
        days: enrichedData.days,
        generatedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        preferences: {
          pace: context.pace,
          budgetTier: context.budgetTier,
          interests: context.interests
        },
        metadata: {
          aiModel: 'gemini-3-flash-preview',
          version: '2.0'
        }
      },
      overview: enrichedData.overview,
      enrichmentMetadata: enrichedData.enrichmentMetadata
    };

    const { error } = await supabase
      .from('trips')
      .update({
        itinerary_data: frontendReadyData,
        itinerary_status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', tripId);

    if (error) {
      console.error('[Stage 6] Final save failed:', error);
      return false;
    }

    console.log('[Stage 6] Final save successful');
    return true;
  } catch (e) {
    console.error('[Stage 6] Final save error:', e);
    return false;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[generate-itinerary] Action: ${action}`);

    // ==========================================================================
    // ACTION: generate-full - Complete 7-stage pipeline
    // ==========================================================================
    if (action === 'generate-full') {
      const { tripId, userId } = params;

      // STAGE 1: Context Preparation
      const context = await prepareContext(supabase, tripId, userId);
      if (!context) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user preferences for personalization
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      const prefs = userId ? await getUserPreferences(supabase, userId) : null;
      const preferenceContext = buildPreferenceContext(insights, prefs);

      // STAGE 2: AI Generation
      let aiResult;
      try {
        aiResult = await generateItineraryAI(context, preferenceContext, LOVABLE_API_KEY);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        const status = message.includes('Rate limit') ? 429 : message.includes('Credits') ? 402 : 500;
        return new Response(
          JSON.stringify({ error: message }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!aiResult?.days?.length) {
        return new Response(
          JSON.stringify({ error: "No itinerary generated" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // STAGE 3: Early Save (Critical - ensures user gets itinerary)
      await earlySaveItinerary(supabase, tripId, aiResult.days);

      // STAGE 4: Enrichment (photos, etc.)
      let enrichedDays: StrictDay[];
      try {
        enrichedDays = await enrichItinerary(aiResult.days, context.destination, PEXELS_API_KEY);
      } catch (enrichError) {
        console.warn('[generate-itinerary] Enrichment failed, using base itinerary:', enrichError);
        enrichedDays = aiResult.days;
      }

      // STAGE 5: Trip Overview
      const overview = generateTripOverview(enrichedDays, context);

      // Build enrichment metadata
      const totalActivities = enrichedDays.reduce((sum, d) => sum + d.activities.length, 0);
      const photosAdded = enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.photos?.length).length, 0
      );

      const enrichedItinerary: EnrichedItinerary = {
        days: enrichedDays,
        overview,
        enrichmentMetadata: {
          enrichedAt: new Date().toISOString(),
          geocodedActivities: 0, // Would be populated with Google Maps integration
          verifiedActivities: totalActivities,
          photosAdded,
          totalActivities
        }
      };

      // STAGE 6: Final Save
      await finalSaveItinerary(supabase, tripId, enrichedItinerary, context);

      // Return complete response
      return new Response(
        JSON.stringify({
          success: true,
          status: 'ready',
          tripId,
          totalDays: context.totalDays,
          totalActivities,
          itinerary: {
            days: enrichedDays,
            overview
          },
          enrichmentMetadata: enrichedItinerary.enrichmentMetadata
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: generate-day - Single day generation (legacy support)
    // ==========================================================================
    if (action === 'generate-day') {
      const { tripId, dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities, userId } = params;

      // Get user preferences
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      const userPrefs = userId ? await getUserPreferences(supabase, userId) : null;
      const preferenceContext = buildPreferenceContext(insights, userPrefs);

      const systemPrompt = `You are an expert travel planner. Generate a single day's detailed itinerary with 4-6 activities.
Requirements:
- Include FULL street addresses for all locations
- Provide realistic cost estimates
- Account for travel time between activities
- Include meals (breakfast, lunch, dinner as appropriate)
- Start around 9:00 AM, end by 9:00-10:00 PM`;

      const userPrompt = `Generate Day ${dayNumber} of ${totalDays} in ${destination}${destinationCountry ? `, ${destinationCountry}` : ''}.

Date: ${date}
Travelers: ${travelers}
Budget: ${budgetTier || 'standard'}
${preferences?.pace ? `Pace: ${preferences.pace}` : ''}
${preferenceContext}
${previousDayActivities?.length ? `\nAvoid repeating: ${previousDayActivities.join(', ')}` : ''}

Generate 4-6 activities with full details including addresses, costs, and transportation.`;

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
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            tools: [{
              type: "function",
              function: {
                name: "create_day_itinerary",
                description: "Creates a structured day itinerary",
                parameters: {
                  type: "object",
                  properties: {
                    dayNumber: { type: "number" },
                    date: { type: "string" },
                    theme: { type: "string" },
                    activities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          description: { type: "string" },
                          category: { type: "string" },
                          startTime: { type: "string" },
                          endTime: { type: "string" },
                          duration: { type: "string" },
                          location: { type: "string" },
                          estimatedCost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } } },
                          bookingRequired: { type: "boolean" },
                          tips: { type: "string" },
                          coordinates: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } },
                          type: { type: "string" }
                        },
                        required: ["id", "name", "description", "category", "startTime", "endTime", "duration", "location", "estimatedCost", "bookingRequired"]
                      }
                    },
                    narrative: { type: "object", properties: { theme: { type: "string" }, highlights: { type: "array", items: { type: "string" } } } }
                  },
                  required: ["dayNumber", "date", "theme", "activities"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "create_day_itinerary" } },
          }),
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error("AI generation failed");
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall?.function?.arguments) {
          throw new Error("Invalid AI response format");
        }

        const generatedDay = JSON.parse(toolCall.function.arguments);

        // Add unique IDs and enhancements
        generatedDay.activities = generatedDay.activities.map((act: { id?: string; startTime?: string; endTime?: string; category?: string }, idx: number) => ({
          ...act,
          id: act.id || `day${dayNumber}-act${idx + 1}-${Date.now()}`,
          durationMinutes: act.startTime && act.endTime ? calculateDuration(act.startTime, act.endTime) : 60,
          categoryIcon: getCategoryIcon(act.category || 'activity')
        }));

        return new Response(
          JSON.stringify({
            success: true,
            day: generatedDay,
            dayNumber,
            totalDays,
            usedPersonalization: !!preferenceContext
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("[generate-day] Error:", error);
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==========================================================================
    // ACTION: get-trip
    // ==========================================================================
    if (action === 'get-trip') {
      const { tripId } = params;
      const { data: trip, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          trip: {
            tripId: trip.id,
            destination: trip.destination,
            destinationCountry: trip.destination_country,
            startDate: trip.start_date,
            endDate: trip.end_date,
            travelers: trip.travelers || 1,
            tripType: trip.trip_type,
            budgetTier: trip.budget_tier
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: save-itinerary
    // ==========================================================================
    if (action === 'save-itinerary') {
      const { tripId, itinerary } = params;

      const { error } = await supabase
        .from('trips')
        .update({
          itinerary_data: itinerary,
          itinerary_status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', tripId);

      if (error) {
        console.error("[save-itinerary] Failed:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save itinerary" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: get-itinerary
    // ==========================================================================
    if (action === 'get-itinerary') {
      const { tripId } = params;

      const { data: trip, error } = await supabase
        .from('trips')
        .select('id, destination, destination_country, start_date, end_date, travelers, itinerary_data, itinerary_status')
        .eq('id', tripId)
        .single();

      if (error || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!trip.itinerary_data) {
        return new Response(
          JSON.stringify({
            success: true,
            status: trip.itinerary_status || 'not_started',
            itinerary: null
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: trip.itinerary_status || 'ready',
          tripId: trip.id,
          destination: trip.destination,
          ...trip.itinerary_data
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-itinerary] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
