// Parse booking confirmation using AI — extracts ALL flight segments + intelligent analysis

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ParsedSegment {
  vendor_name?: string;
  flight_number?: string;
  origin?: string;
  origin_code?: string;
  destination?: string;
  destination_code?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  cabin_class?: string;
  net_cost_cents?: number;
  // Intelligence fields
  classification?: 'OUTBOUND' | 'RETURN' | 'CONNECTION' | 'INTER_DESTINATION';
  isLayoverArrival?: boolean;
  connectionGroup?: number | null;
}

interface ParsedBooking {
  segment_type: 'flight' | 'hotel' | 'car_rental' | 'rail' | 'tour' | 'cruise' | 'transfer' | 'insurance' | 'other';
  vendor_name?: string;
  confirmation_number?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  origin?: string;
  origin_code?: string;
  destination?: string;
  destination_code?: string;
  flight_number?: string;
  cabin_class?: string;
  room_type?: string;
  room_count?: number;
  notes?: string;
  net_cost_cents?: number;
  is_multi_segment?: boolean;
  segment_count?: number;
  segments?: ParsedSegment[];
}

interface TripContext {
  destinations?: string[];
  destinationAirports?: string[];
  tripDates?: { start?: string; end?: string };
  nightsPerCity?: Record<string, number>;
}

interface FlightIntelligence {
  route?: {
    display?: string;
    homeAirport?: string;
    destinationAirports?: string[];
    layoverAirports?: string[];
  };
  missingLegs?: Array<{
    from?: string;
    fromCity?: string;
    to?: string;
    toCity?: string;
    reason?: string;
    suggestedDateRange?: { earliest?: string; latest?: string };
    priority?: 'CRITICAL' | 'WARNING' | 'INFO';
  }>;
  destinationSchedule?: Array<{
    city?: string;
    airport?: string;
    arrivalDatetime?: string | null;
    departureDatetime?: string | null;
    availableFrom?: string | null;
    availableUntil?: string | null;
    fullDays?: number;
    isFirstDestination?: boolean;
    isLastDestination?: boolean;
    notes?: string[];
  }>;
  layovers?: Array<{
    airport?: string;
    city?: string;
    arrivalTime?: string;
    departureTime?: string;
    duration?: string;
  }>;
  warnings?: Array<{
    type?: string;
    message?: string;
    severity?: 'WARNING' | 'INFO' | 'ERROR';
  }>;
  summary?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { confirmationText, tripContext } = body as { confirmationText?: string; tripContext?: TripContext };

    if (!confirmationText || typeof confirmationText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'confirmationText is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build the trip context section for the prompt
    const hasTripContext = tripContext && tripContext.destinations && tripContext.destinations.length > 0;
    
    const tripContextPrompt = hasTripContext ? `

TRIP CONTEXT (use this to analyze flights intelligently):
- Destinations the traveler plans to visit: ${tripContext!.destinations!.join(', ')}
- Destination airport codes: ${(tripContext!.destinationAirports || []).join(', ')}
- Trip dates: ${tripContext!.tripDates?.start || 'unknown'} to ${tripContext!.tripDates?.end || 'unknown'}
- Nights per city: ${JSON.stringify(tripContext!.nightsPerCity || {})}
` : '';

    const intelligencePrompt = hasTripContext ? `

PHASE 2 — INTELLIGENT ANALYSIS (only if tripContext is provided above):

After extracting raw segments, analyze them against the trip context and produce an "intelligence" object:

a) CLASSIFY each segment:
   - "OUTBOUND": leaving the home/origin city toward the first destination
   - "RETURN": going back to the home/origin city
   - "CONNECTION": a layover — the traveler doesn't leave the airport. Identified when there's another flight departing from the same airport within 6 hours of arrival.
   - "INTER_DESTINATION": traveling between two non-home destinations
   A city can be BOTH a layover at one point and a destination at another — classify independently based on timing.

   For each segment, also set:
   - "isLayoverArrival": true if this segment arrives at a layover airport (where the traveler connects to another flight, not their actual destination)
   - "connectionGroup": integer grouping connected flights (e.g., flights 1 and 2 that form a single journey with a layover get the same group number). null if standalone.

b) DETECT MISSING LEGS: Check if there's a flight between each consecutive destination in the trip. If not, flag it as a missing leg with:
   - from/to airport codes and city names
   - reason: why this flight is needed
   - suggestedDateRange: { earliest, latest } in YYYY-MM-DD
   - priority: "CRITICAL" if the trip can't work without it, "WARNING" otherwise

c) CALCULATE DESTINATION AVAILABILITY WINDOWS for each actual destination (NOT layovers):
   - availableFrom = arrival time + 3 hours (international) or + 1.5 hours (domestic/short-haul under 4h)
   - availableUntil = departure time - 3.5 hours (international) or - 2.5 hours (domestic/short-haul)
   - If arrival/departure is unknown (missing leg), set to null
   - Include fullDays count, isFirstDestination, isLastDestination flags
   - Add notes array with scheduling advice

d) BUILD ROUTE SUMMARY: Show layovers in parentheses and destinations in brackets:
   e.g., "Dallas → (layover: Madrid) → [Mallorca] → [Madrid] → Dallas"

e) IDENTIFY LAYOVERS with airport, city, arrival/departure times, and duration

f) GENERATE WARNINGS for any issues (missing legs, tight connections, etc.)

g) GENERATE A SUMMARY text that shows:
   - The route
   - Which flights are provided (✓) and which are missing (✗)
   - Destination days breakdown

Include the intelligence object in your response.` : '';

    const prompt = `You are a travel booking parser. Extract booking details from the following confirmation email or text.
${tripContextPrompt}
PHASE 1 — EXTRACTION:

Extract ALL flight segments from this booking. If this is a multi-city or round-trip booking with multiple flights, extract EVERY segment.

Return a JSON object with these fields:
- segment_type: one of "flight", "hotel", "car_rental", "rail", "tour", "cruise", "transfer", "insurance", "other"
- vendor_name: airline name, hotel name, or company name
- confirmation_number: booking reference or confirmation code
- is_multi_segment: true if there are multiple flights
- segment_count: total number of flight segments

- segments: an ARRAY of flight segment objects, each with:
  - vendor_name: airline for this segment (if different from overall)
  - flight_number: like "UA 123" or "DL456"
  - origin: departure city/airport name
  - origin_code: 3-letter airport code like "JFK"
  - destination: arrival city/airport name
  - destination_code: 3-letter airport code
  - start_date: departure date in YYYY-MM-DD format
  - start_time: departure time in HH:MM 24-hour format
  - end_date: arrival date in YYYY-MM-DD format
  - end_time: arrival time in HH:MM 24-hour format
  - cabin_class: "economy", "premium_economy", "business", or "first"
  ${hasTripContext ? '- classification: one of "OUTBOUND", "RETURN", "CONNECTION", "INTER_DESTINATION"\n  - isLayoverArrival: boolean\n  - connectionGroup: integer or null' : ''}

Also include these top-level fields from the FIRST segment for backward compatibility:
- start_date, start_time, end_date, end_time, origin, origin_code, destination, destination_code, flight_number, cabin_class

- notes: any other relevant details like seat assignments, etc.
${intelligencePrompt}

IMPORTANT RULES:
- Do NOT invent or estimate any field values. If a value is not explicitly stated in the text, do NOT include it.
- Never hallucinate or guess values. If a price or fare is not explicitly stated, do NOT include a price/cost field.
- Sort all segments chronologically by departure datetime.
- Never delete or discard any flight data from the text. If a segment doesn't fit, include it and flag it.

Only return valid JSON, no markdown or explanations.${hasTripContext ? '\n\nThe response must have TWO top-level keys: "booking" (with all the extraction fields above) and "intelligence" (with the analysis from Phase 2).' : ''}

Confirmation text:
${confirmationText}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    let parsed: any;
    try {
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.slice(7);
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();

      parsed = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ 
          error: 'Could not parse booking details from the text',
          raw_response: content 
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle two response formats:
    // 1. With tripContext: { booking: {...}, intelligence: {...} }
    // 2. Without tripContext: { segment_type: ..., segments: [...] } (flat booking)
    let parsedBooking: ParsedBooking;
    let intelligence: FlightIntelligence | null = null;

    if (parsed.booking && typeof parsed.booking === 'object') {
      parsedBooking = parsed.booking;
      intelligence = parsed.intelligence || null;
    } else {
      parsedBooking = parsed;
    }

    // Validate segment_type
    const validTypes = ['flight', 'hotel', 'car_rental', 'rail', 'tour', 'cruise', 'transfer', 'insurance', 'other'];
    if (!parsedBooking.segment_type || !validTypes.includes(parsedBooking.segment_type)) {
      parsedBooking.segment_type = 'other';
    }

    // Ensure segments array exists (backward compat)
    if (!parsedBooking.segments || !Array.isArray(parsedBooking.segments) || parsedBooking.segments.length === 0) {
      if (parsedBooking.segment_type === 'flight') {
        parsedBooking.segments = [{
          vendor_name: parsedBooking.vendor_name,
          flight_number: parsedBooking.flight_number,
          origin: parsedBooking.origin,
          origin_code: parsedBooking.origin_code,
          destination: parsedBooking.destination,
          destination_code: parsedBooking.destination_code,
          start_date: parsedBooking.start_date,
          start_time: parsedBooking.start_time,
          end_date: parsedBooking.end_date,
          end_time: parsedBooking.end_time,
          cabin_class: parsedBooking.cabin_class,
        }];
      }
    }

    // Sort segments chronologically
    if (parsedBooking.segments && parsedBooking.segments.length > 1) {
      parsedBooking.segments.sort((a, b) => {
        const aKey = `${a.start_date || ''}T${a.start_time || '00:00'}`;
        const bKey = `${b.start_date || ''}T${b.start_time || '00:00'}`;
        return aKey.localeCompare(bKey);
      });
    }

    // Update segment_count and is_multi_segment
    if (parsedBooking.segments) {
      parsedBooking.segment_count = parsedBooking.segments.length;
      parsedBooking.is_multi_segment = parsedBooking.segments.length > 1;
    }

    // Validate intelligence block defaults
    if (intelligence) {
      intelligence.route = intelligence.route || {};
      intelligence.missingLegs = intelligence.missingLegs || [];
      intelligence.destinationSchedule = intelligence.destinationSchedule || [];
      intelligence.layovers = intelligence.layovers || [];
      intelligence.warnings = intelligence.warnings || [];
      intelligence.summary = intelligence.summary || '';
    }

    return new Response(
      JSON.stringify({ success: true, booking: parsedBooking, intelligence }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error parsing booking:', error);
    const message = error instanceof Error ? error.message : 'Failed to parse booking';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
