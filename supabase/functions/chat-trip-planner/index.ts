import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { fetchTravelerDNA, buildCompactDNASummary } from "../_shared/traveler-dna.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Dynamic date context injected at runtime
const MIN_TRIP_YEAR = 2026;

function buildSystemPrompt(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const effectiveYear = Math.max(currentYear, MIN_TRIP_YEAR);
  const todayStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return `You are a friendly, conversational travel planning assistant for Voyance. Your job is to chat naturally with users about their trip and gather details through genuine conversation — not an interrogation.

TODAY'S DATE: ${todayStr}
CURRENT YEAR: ${currentYear}
MINIMUM PLANNING YEAR: ${effectiveYear}

CRITICAL DATE RULES:
- ALL trip dates MUST be in ${effectiveYear} or later. NEVER output dates in ${effectiveYear - 1} or earlier.
- When the user mentions an event without a year (e.g. "US Open", "Oktoberfest", "cherry blossom season"), resolve it to ${effectiveYear} or later.
- When the user says "next month", "in March", or any bare month/day, use ${effectiveYear} if that date is still in the future, otherwise ${effectiveYear + 1}.
- If the user explicitly says a past year like "2025", politely note that date has passed and suggest ${effectiveYear} instead.
- NEVER default to ${effectiveYear - 1}. This is a travel planning app — all trips are in the future.

You need to collect:
1. Destination (required)
2. Travel dates — specific start and end dates in YYYY-MM-DD format (required — DO NOT call the tool without these)
3. Number of travelers (required — though the UI may already have this)
4. Trip type/occasion (e.g. leisure, honeymoon, family, girls trip, bachelor/bachelorette, anniversary, birthday, business)
5. Budget (helpful but optional)
6. Hotel/accommodation details (optional)
7. Must-do activities or restrictions (optional)

Guidelines:
- Be warm, witty, and genuinely conversational. You're a friend helping plan a trip, not a form.
- Keep responses SHORT — 1-3 sentences max. No walls of text.
- React to what they say! Show enthusiasm, make suggestions, share quick tips. "Oh nice, Barcelona in October is perfect — fewer crowds and the weather is still gorgeous."
- If the user pastes in a block of research or notes, parse what you can and respond naturally.
- Don't ask for all details at once — guide naturally. One or two questions at a time.
- Never mention AI, ChatGPT, or any specific AI tool. You are Voyance.
- If they seem ready, don't over-ask — just extract and go.

USER INTENT CAPTURE — THIS IS THE MOST IMPORTANT THING YOU DO:
When the user describes their trip, your #1 job is to faithfully capture EVERYTHING they care about. Specifically:

1. **Full-day events**: If they say "whole day for the U.S. Open", "dedicate a day to Disney", "spend the entire day at the beach" — this means NO OTHER PLANNED ACTIVITIES that day. Capture as userConstraints with type "full_day_event" and allDay: true.

2. **Flights**: If they mention ANY flight details (airline, times, flight number, airports), capture ALL of it in flightDetails. Don't summarize or paraphrase — keep their exact details.

3. **Specific times**: "Dinner at 7:30", "we have reservations at 8pm", "the show starts at 2" — these are time-locked. Include the exact time in mustDoActivities AND in userConstraints with the time field.

4. **Preferences and avoids**: "We want authentic sushi", "no tourist traps", "hidden gems only", "we love craft cocktails" — these shape the ENTIRE itinerary. Include in userConstraints as type "preference" or "avoid".

5. **Don't drop anything**: If the user mentions it, it matters to them. When in doubt, include it in userConstraints rather than dropping it.

The mustDoActivities field should contain a RICH, DETAILED summary of everything the user wants, not just venue names. Include their reasoning, timing preferences, and constraints. Example:
  "Whole day at the U.S. Open (do NOT plan other activities this day). Dinner at Nobu at 7:30 PM (reservation confirmed). Want authentic sushi spots — no tourist restaurants. Flying Delta from JFK, arriving 3 PM on Day 1."

LANGUAGE & OUTPUT QUALITY — MANDATORY:
- ALL output MUST be in clean, fluent, correctly spelled English. Double-check spelling of common words.
- For non-Latin-script destinations (China, Japan, Korea, Thailand, Arabic countries, Russia), ALWAYS use standard English transliterations or well-known English names. Examples: "Beijing" not "北京", "Chongqing" not "重庆", "Shinjuku" not "新宿".
- NEVER output Chinese characters, Japanese kanji/kana, Korean hangul, Cyrillic, Thai, or Arabic script in ANY field.
- NEVER produce garbled, corrupted, or nonsensical text fragments. If uncertain about a word, use a simpler synonym.
- Proofread your response before sending — no misspellings, no sentence fragments, no gibberish.

PERSONALIZATION:
- If you know the traveler's preferences (provided below), use them to make suggestions OPINIONATED and SPECIFIC.
- "Since you're a foodie who loves omakase, Tokyo in October is *chef's kiss* — Michelin season just kicked off." Not: "Tokyo has great food."
- Reference their travel style naturally: "With your relaxed pace, I'd suggest at least 5 nights so you're not rushing."
- If they mention a destination, proactively surface relevant info: seasonal events, weather, things that match their interests.

AIRPORT vs CITY — CRITICAL:
- The "destination" field must ALWAYS be a CITY NAME, never an airport code.
- "LGA", "JFK", "LAX", "CDG", "LHR" etc. are AIRPORTS, not destinations.
- If the user says "flying into LGA, out of JFK", the destination is "New York", NOT "LGA, JFK".
- Airport codes go ONLY in arrivalAirport / departureAirport fields.

CRITICAL RULES FOR CALLING THE TOOL:
- You MUST have destination, start date, end date, AND number of travelers before calling extract_trip_details.
- If the user says vague dates like "next month" or "in October", ask for specific dates: "Love it! What exact dates are you thinking? Even rough ones work — I just need a start and end date to build your itinerary."
- NEVER say "I have everything I need" or "generating your trip now" unless you are simultaneously calling the tool with all required fields filled.
- If dates are missing, ask for them conversationally — don't pretend you have them.
- All dates MUST be in YYYY-MM-DD format. Use the current year or next year as appropriate.
MULTI-CITY DETECTION — CRITICAL (FAILURE TO FOLLOW = BROKEN TRIP):
- If the user mentions visiting MORE THAN ONE city in ANY form, this is a multi-city trip. Examples:
  - "Hong Kong then Shanghai then Beijing then Tokyo"
  - "I want to visit Rome, Barcelona, and Paris"
  - "flying into London, out of Edinburgh"
  - "London and Paris"
  - "3 days in Rome then 4 days in Barcelona"
  - Any mention of 2+ city names = multi-city
- For multi-city trips, you MUST ALWAYS populate the "cities" array. This is NON-NEGOTIABLE. If cities[] is empty, the system will only create a trip for one city and DROP all other cities entirely.
- The "destination" field should be a comma-separated summary: "London, Paris" or "Hong Kong, Shanghai, Beijing, Tokyo".
- NEVER put the route in additionalNotes instead of cities[]. The cities array is the ONLY field the system reads for multi-city routing.
- If the user doesn't specify nights per city, distribute evenly: total_days minus (num_cities - 1) travel days, divided among cities.
- Single-city trips: set cities to an empty array [].
- ALWAYS include BOTH the "destination" summary AND the "cities" array. Example for "London and Paris, 10 days, staying at The Ritz in London and Le Meurice in Paris":
  destination: "London, Paris"
  cities: [{name: "London", country: "United Kingdom", nights: 4, hotelName: "The Ritz London"}, {name: "Paris", country: "France", nights: 5, hotelName: "Le Meurice"}]
- When the user has MULTIPLE hotels in the SAME city, list them in the hotelName field with date ranges: hotelName: "Mandarin Oriental (Apr 10-11), Radisson Blu (Apr 11-15)"

SELF-CHECK BEFORE CALLING THE TOOL:
Before you call extract_trip_details, run this mental checklist:
1. Did the user mention 2 or more city/destination names at ANY point in the conversation?
2. If YES → the "cities" array MUST contain ALL of them with nights. If you leave cities empty, those cities are LOST FOREVER.
3. Does "destination" contain ALL city names comma-separated? "London, Paris" not just "London".
4. Do the nights in cities[] sum to approximately the total trip duration?
If any check fails, fix it before calling the tool.

DAY TRIP / NEARBY DESTINATION CAPTURE — CRITICAL:
When the user mentions a town, village, or destination that is NEAR one of their main cities but NOT a separate overnight stop, you MUST capture it in mustDoActivities as a day trip. Examples:
- User plans Catania (2 nights) and mentions Taormina → mustDoActivities: "Day trip to Taormina from Catania"
- User plans Paris (4 nights) and mentions Versailles → mustDoActivities: "Day trip to Versailles from Paris"
- User plans Tokyo (4 nights) and mentions Kamakura → mustDoActivities: "Day trip to Kamakura from Tokyo"
DO NOT add these as separate cities in the cities[] array — they don't have their own nights. Instead, treat them as must-do activities anchored to the nearest city.
RULE: If the user mentions ANY place name that you don't include in cities[], it MUST appear in mustDoActivities. No place the user mentions should be silently dropped.

EXTRACTION QUALITY — CRITICAL:
When calling extract_trip_details, you MUST extract EVERY specific detail the user mentioned:

1. ACTIVITIES & EVENTS: Put ALL specific activities, events, shows, matches, restaurants, and venues into mustDoActivities as a comma-separated list. Include time constraints.
   - "I want to go to the US Open from 9am to 6pm" → mustDoActivities: "US Open tennis 9am-6pm"
   - "comedy show Friday night" → mustDoActivities should include "comedy show Friday evening"
   - "dinner at a nice restaurant" → mustDoActivities should include "dinner at upscale restaurant"
   - Capture EVERY activity mentioned, no matter how casual. If the user said it, it matters to them.

2. FLIGHTS: If the user mentions ANY flight details, extract them into the dedicated fields:
   - "land at LaGuardia at 8:15am" → arrivalAirport: "LGA", arrivalTime: "8:15 AM"
   - "fly out of JFK" → departureAirport: "JFK"
   - "red eye back" → departureTime: "late evening"

3. HOTEL: Extract hotel name AND location/neighborhood:
   - "stay in Midtown Manhattan" → hotelAddress: "Midtown Manhattan"
   - "staying at The Ritz" → hotelName: "The Ritz"
   - "hotel near Times Square" → hotelAddress: "near Times Square"

4. PACING: Listen for pace indicators:
   - "relaxed trip", "take it easy", "slow mornings", "no rush" → pacing: "relaxed"
   - "see as much as possible", "packed schedule", "pack it in", "ambitious" → pacing: "packed"
   - Default to "balanced" if not mentioned

5. FIRST-TIME VISITOR: Listen for experience level:
   - "never been before", "first time in" → isFirstTimeVisitor: true
   - "been there before", "know the city well", "going back", "last time I was there" → isFirstTimeVisitor: false
   - Default to true if not mentioned

6. INTERESTS: Extract interest categories from what excites them:
   - "love food and nightlife" → interestCategories: ["food", "nightlife"]
   - "interested in history and architecture" → interestCategories: ["history", "architecture"]
   - "museums and culture" → interestCategories: ["history", "culture"]
   - "we love wine" or "vineyard tours" → interestCategories: ["wine"] (do NOT fold into "food")
   - Valid values: history, food, nightlife, art, nature, shopping, adventure, culture, relaxation, architecture, music, sports, photography, family, romance, wine

7. LOGISTICS & CONSTRAINTS: Put transport needs and constraints in additionalNotes:
   - "need to get from US Open to JFK" → additionalNotes
   - "traveling with elderly parent" → additionalNotes
   - "celebrating anniversary" → also set celebrationDay if a specific day is implied

8. CELEBRATION: If trip is for a birthday/anniversary/special occasion:
   - "birthday is on day 3" → celebrationDay: 3
   - "anniversary dinner" → capture in mustDoActivities AND set celebrationDay if day is known

PRE-PLANNED ITINERARY HANDLING — CRITICAL:
When a user pastes a DETAILED itinerary (with specific times, venues, restaurants, meetings, etc.):
1. Do NOT refuse or say "you already have everything planned." The user wants Voyance to BUILD this trip.
2. Do NOT ask follow-up questions about things already stated in their plan. Extract immediately.
3. CALL the extract_trip_details tool on your FIRST response. Do not wait for a second message.
4. Put ALL specific venues, restaurants, meetings, and timed events into mustDoActivities as a detailed comma-separated list. Include day numbers and times.
   Example: "Day 1 Breakfast Mandarin Oriental, Day 1 2pm Afternoon Tea, Day 1 Evening Dinner TBD, Day 2 Le Bistro Arabe 9:15pm, Day 3 9am-11:30am Company Visit, Day 3 Lunch 11:30am-1pm, Day 3 1:30pm-3:30pm Volunteering, Day 3 Dinner Jnane Tamsna 7pm-10pm"
5. Put meetings, presentations, orientations, and work sessions into userConstraints as time_block entries with specific times and day numbers.
6. For items marked "TBD" or with no specific venue, include them in mustDoActivities as-is (e.g., "Day 1 Evening Dinner TBD") — the generator will fill them in.
7. If the user provides hotels with date ranges, extract them into the cities array hotelName field.
8. Travelers defaults to 1 if not explicitly stated. Do NOT ask "how many travelers?" if the plan is otherwise complete.
9. If the plan spans multiple cities, ALWAYS populate the cities array with all cities, nights, and hotels.
10. NEVER refuse to generate. The user chose "Just Tell Us" because they want a VOYANCE trip built from their plan. Always call the tool.

CRITICAL — DAY-LEVEL EXTRACTION:
When a user provides activities organized by day (e.g., "April 10: breakfast, pool... April 11: transfer to Radisson..."), you MUST use the perDayActivities array, NOT just mustDoActivities.

For each day the user described, create one entry in perDayActivities with:
- dayNumber: the sequential day number (1, 2, 3...)
- activities: ALL activities for that day as a comma-separated string WITH times

This preserves day-level structure so the generator puts activities on the CORRECT day.

RULES FOR perDayActivities:
1. Include EVERYTHING the user specified — restaurants, hotels, meetings, presentations, volunteering, pool time, spa, drinks, ALL of it.
2. Include "TBD" items (e.g., "Evening Dinner TBD") — the generator will fill those in.
3. Include hotel transfers (e.g., "4PM Late checkout Mandarin Oriental, 4PM Transfer to Radisson Blu, 4:30PM Check-in Radisson Blu")
4. Include work events exactly as stated (e.g., "9AM-11:30AM Company Visit, 1:30PM-3:30PM Volunteering")
5. Do NOT rename, reinterpret, or upgrade user activities. "Pool" means pool, not "Rose Garden Stroll."
6. Do NOT add activities the user didn't mention for that day.
7. Do NOT move activities between days. If the user said "Day 2: Dinner Le Bistro Arabe 9:15PM" it goes in dayNumber 2, period.

IMPORTANT: When perDayActivities is populated, ALSO populate mustDoActivities as a flat fallback string with all venue names. Both fields should be filled.

CRITICAL TEMPORAL MAPPING RULES:
- When the user says "both days" or "every day" for an event, create a SEPARATE full_day_event constraint for EACH day it applies to, with explicit day numbers in the "day" field.
- When the user references a day of the week (e.g., "Friday night", "Saturday morning"), calculate which trip day number that corresponds to based on the start date, and set the "day" field accordingly.
  Example: Trip starts Wednesday Aug 26. User says "comedy show Friday night" → day: 3 (Friday is 2 days after Wednesday).
  Example: User says "US Open both days" on a 4-day trip → create constraints for day 1, day 2, day 3.
- The "day" field in userConstraints is CRITICAL. Without it, the itinerary generator cannot schedule the activity on the right day.
- ALWAYS set the "day" field when the user specifies or implies a day. Never leave it undefined if the day can be inferred.
- For mustDoActivities: expand multi-day references into per-day entries. Instead of "US Open both days", write "US Open 9am-6pm Day 1, US Open 9am-6pm Day 2, US Open 9am-6pm Day 3".

FAILURE TO EXTRACT = THE ITINERARY WON'T INCLUDE IT.
The generation engine can only use what you extract. If you skip a field, the user's request is silently dropped.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch traveler DNA for personalized chat
    let personalizationContext = '';
    try {
      const userId = claimsData.claims.sub as string;
      if (userId) {
        const dnaResult = await fetchTravelerDNA(supabase, userId);
        if (dnaResult.hasData) {
          const summary = buildCompactDNASummary(dnaResult.dna);
          const details: string[] = [];
          if (dnaResult.dna.preferredAirlines?.length) {
            details.push(`Preferred airlines: ${dnaResult.dna.preferredAirlines.join(', ')}`);
          }
          if (dnaResult.dna.preferredCabinClass) {
            details.push(`Cabin class: ${dnaResult.dna.preferredCabinClass}`);
          }
          if (dnaResult.dna.hotelBrandPreference) {
            details.push(`Hotel style: ${dnaResult.dna.hotelBrandPreference}`);
          }
          if (dnaResult.dna.budgetTier) {
            details.push(`Budget: ${dnaResult.dna.budgetTier}`);
          }
          if (dnaResult.dna.pastTrips?.length) {
            details.push(`Recent trips: ${dnaResult.dna.pastTrips.map(t => t.destination).join(', ')}`);
          }
          personalizationContext = `\n\n## TRAVELER PROFILE (use to personalize your responses)\n${summary}\n${details.join('\n')}\nUse this to make suggestions specific and opinionated. Reference their past trips and preferences naturally.`;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch traveler DNA:", err);
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: buildSystemPrompt() + personalizationContext },
            ...messages,
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_trip_details",
                description:
                  "Extract ALL trip details from the conversation, capturing every preference, constraint, flight detail, and specific time the user mentioned. Missing any detail the user cared about = broken trip. At minimum: destination, dates, travelers.",
                parameters: {
                  type: "object",
                  properties: {
                    destination: {
                      type: "string",
                      description: "For single-city: the city name. For multi-city: comma-separated summary like 'London, Paris' or 'Hong Kong, Shanghai, Beijing, Tokyo'. MUST list all cities.",
                    },
                    startDate: {
                      type: "string",
                      description: "Trip start date in YYYY-MM-DD format if known",
                    },
                    endDate: {
                      type: "string",
                      description: "Trip end date in YYYY-MM-DD format if known",
                    },
                    travelers: {
                      type: "number",
                      description: "Number of travelers",
                    },
                    tripType: {
                      type: "string",
                      enum: [
                        "leisure",
                        "honeymoon",
                        "anniversary",
                        "birthday",
                        "family",
                        "girls_trip",
                        "guys_trip",
                        "bachelor",
                        "bachelorette",
                        "business",
                        "solo",
                        "reunion",
                        "graduation",
                        "retirement",
                      ],
                      description: "Type/occasion of the trip",
                    },
                    budgetAmount: {
                      type: "number",
                      description:
                        "Total budget in USD if mentioned",
                    },
                    hotelName: {
                      type: "string",
                      description: "Hotel name if mentioned",
                    },
                    hotelAddress: {
                      type: "string",
                      description: "Hotel address, neighborhood, or area if mentioned (e.g., 'Midtown Manhattan', 'near Times Square', '123 Main St')",
                    },
                    arrivalAirport: {
                      type: "string",
                      description: "Arrival airport code or name if mentioned (e.g., 'LGA', 'LaGuardia', 'Heathrow')",
                    },
                    arrivalTime: {
                      type: "string",
                      description: "Flight arrival time at destination if mentioned (e.g., '8:15 AM', '08:15')",
                    },
                    departureAirport: {
                      type: "string",
                      description: "Departure airport code or name for the return flight if mentioned (e.g., 'JFK', 'Heathrow')",
                    },
                    departureTime: {
                      type: "string",
                      description: "Return flight departure time if mentioned (e.g., '6:00 PM', '18:00')",
                    },
                    mustDoActivities: {
                      type: "string",
                      description:
                        "Comma-separated list of SPECIFIC activities, events, venues, and experiences the user wants to do. Include time constraints when mentioned. IMPORTANT: Expand multi-day references into per-day entries with explicit day numbers. Instead of 'US Open tennis both days', write 'US Open tennis 9am-6pm Day 1, US Open tennis 9am-6pm Day 2, US Open tennis 9am-6pm Day 3'. Instead of 'comedy show Friday night', write 'comedy show Day 3 evening' (calculating the day number from the start date). Be exhaustive — capture EVERY specific activity, event, restaurant, show, or experience the user mentions. This is the MOST IMPORTANT field for itinerary quality. When the user provides a full day-by-day plan, extract ALL venue names, restaurants, and timed activities as 'Day N Time Activity' entries. This can be a very long string — that is fine. Capture EVERYTHING.",
                    },
                    additionalNotes: {
                      type: "string",
                      description:
                        "Logistical details, transport preferences, pace preferences, or constraints that don't fit other fields. Examples: 'need to get from US Open to JFK', 'want a slow-paced trip', 'traveling with elderly parent'. Do NOT put specific activities or events here — those go in mustDoActivities.",
                    },
                    flightDetails: {
                      type: "string",
                      description:
                        "Any flight information mentioned: airline, flight number, departure/arrival times, airports. Capture verbatim. Example: 'Flying Delta DL123, departing JFK 3:00 PM Aug 15, arriving LAX 6:30 PM'",
                    },
                    userConstraints: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: {
                            type: "string",
                            enum: ["full_day_event", "time_block", "avoid", "preference", "flight"],
                            description: "Type of constraint",
                          },
                          description: {
                            type: "string",
                            description: "What the user wants, in their own words",
                          },
                          day: {
                            type: "number",
                            description: "Which day number this applies to (if specified)",
                          },
                          time: {
                            type: "string",
                            description: "Start time if mentioned (e.g., '9:00 AM', '3:00 PM'). For time ranges like '9am to 5pm', this is the START time.",
                          },
                          endTime: {
                            type: "string",
                            description: "End time if the user specifies a range. For '9am to 5pm', time='9:00 AM' and endTime='5:00 PM'. For '9am-6pm', time='9:00 AM' and endTime='6:00 PM'. ALWAYS set this when a time range is mentioned.",
                          },
                          duration: {
                            type: "number",
                            description: "Duration in minutes if known and endTime is not set. For '9am to 5pm' prefer endTime over duration. Only use duration for cases like 'a 2-hour cooking class'.",
                          },
                          allDay: {
                            type: "boolean",
                            description: "True if user wants this to consume the ENTIRE day with no other planned activities",
                          },
                        },
                        required: ["type", "description"],
                      },
                      description:
                        "Structured list of user constraints, preferences, and requirements. CRITICAL: If the user says 'whole day for X' or 'dedicate the day to X' or 'don't plan anything else', create a full_day_event with allDay: true. If they mention specific times, include the time. If they mention flights, include as type 'flight'.",
                    },
                    pacing: {
                      type: "string",
                      enum: ["relaxed", "balanced", "packed"],
                      description: "Trip pacing inferred from conversation. 'relaxed' = slow pace, 2-3 activities/day. 'packed' = see as much as possible, 5+ activities/day. Default to 'balanced' if not mentioned.",
                    },
                    isFirstTimeVisitor: {
                      type: "boolean",
                      description: "True if user hasn't visited the destination before or doesn't mention prior visits. False if they mention returning or knowing the area.",
                    },
                    interestCategories: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: ["history", "food", "nightlife", "art", "nature", "shopping", "adventure", "culture", "relaxation", "architecture", "music", "sports", "photography", "family", "romance"],
                      },
                      description: "Interest categories inferred from conversation. E.g. 'we love food and nightlife' → ['food', 'nightlife']. Only include categories the user actually expressed interest in.",
                    },
                    celebrationDay: {
                      type: "number",
                      description: "If the trip is for a birthday, anniversary, or special occasion, which day number the celebration falls on (1-indexed). Only set if user specifies or implies a particular day.",
                    },
                    cities: {
                      type: "array",
                      description:
                        "REQUIRED for multi-city trips. Ordered list of cities with estimated nights and hotel details. If user mentions 2+ cities, this MUST be populated — without it only the first city gets planned. For single-city trips, use an empty array [].",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            description: "City name",
                          },
                          country: {
                            type: "string",
                            description: "Country name",
                          },
                          nights: {
                            type: "number",
                            description: "Number of nights in this city",
                          },
                          hotelName: {
                            type: "string",
                            description: "Hotel name for this city if mentioned. For multiple hotels in the same city, list them comma-separated with date ranges: 'Mandarin Oriental (Apr 10-11), Radisson Blu (Apr 11-15)'",
                          },
                        },
                        required: ["name", "nights"],
                      },
                    },
                    perDayActivities: {
                      type: "array",
                      description: "When the user provides a day-by-day plan, extract activities organized BY DAY. Each entry represents one day's scheduled activities in order. Use this INSTEAD OF (in addition to) mustDoActivities when the user provides day-level structure like 'Day 1: breakfast, pool... Day 2: transfer, dinner at X'. This preserves which activities belong to which day.",
                      items: {
                        type: "object",
                        properties: {
                          dayNumber: {
                            type: "number",
                            description: "Which day of the trip (1, 2, 3, etc.)"
                          },
                          activities: {
                            type: "string",
                            description: "Comma-separated list of that day's activities with times. Example: '6:30AM Breakfast, 9AM-11:30AM Company Visit, 11:30AM-1PM Lunch, 1:30PM-3:30PM Volunteering, 7PM-10PM Dinner at Jnane Tamsna'"
                          }
                        },
                        required: ["dayNumber", "activities"]
                      },
                    },
                  },
                  required: ["destination", "startDate", "endDate", "travelers", "cities"],
                },
              },
            },
          ],
          stream: true,
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-trip-planner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
