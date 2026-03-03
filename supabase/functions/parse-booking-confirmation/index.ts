// Parse booking confirmation using AI — extracts ALL flight segments + intelligent analysis

/** Convert "HH:MM" or "H:MM" time string to minutes since midnight. Returns null if invalid. */
function timeToMinutes(time?: string): number | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

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

After extracting raw segments, analyze them against the trip context and produce an "intelligence" object.

CRITICAL: You MUST use EXACTLY these camelCase field names in the intelligence object. Do NOT use snake_case.

The intelligence object MUST have this EXACT structure:
{
  "route": {
    "display": "ATL → (MAD) → [PMI] → [MAD] → ATL",
    "homeAirport": "ATL",
    "destinationAirports": ["PMI", "MAD"],
    "layoverAirports": []
  },
  "missingLegs": [
    {
      "from": "PMI",
      "fromCity": "Mallorca",
      "to": "MAD",
      "toCity": "Madrid",
      "reason": "Need flight from Mallorca to Madrid",
      "suggestedDateRange": { "earliest": "2026-07-05", "latest": "2026-07-06" },
      "priority": "CRITICAL"
    }
  ],
  "destinationSchedule": [
    {
      "city": "Mallorca",
      "airport": "PMI",
      "arrivalDatetime": "2026-07-02T18:25:00",
      "departureDatetime": null,
      "availableFrom": "2026-07-02T21:25:00",
      "availableUntil": null,
      "fullDays": 3,
      "isFirstDestination": true,
      "isLastDestination": false,
      "notes": ["Missing outbound flight to Madrid"]
    }
  ],
  "layovers": [
    {
      "airport": "MAD",
      "city": "Madrid",
      "arrivalTime": "2026-07-02T12:15:00",
      "departureTime": "2026-07-02T17:05:00",
      "duration": "4h50m"
    }
  ],
  "warnings": [
    { "type": "MISSING_LEG", "message": "No flight from Mallorca to Madrid", "severity": "WARNING" }
  ],
  "summary": "Route: ATL → MAD → PMI → ??? → MAD → BOS → ATL. Missing: PMI→MAD leg."
}

Rules for classification:
a) CLASSIFY each segment:
   - "OUTBOUND": leaving the home/origin city toward the first destination
   - "RETURN": going back to the home/origin city
   - "CONNECTION": a layover — the traveler doesn't leave the airport. Identified when there's another flight departing from the same airport within 6 hours of arrival.
   - "INTER_DESTINATION": traveling between two non-home destinations
   A city can be BOTH a layover at one point and a destination at another — classify independently based on timing.

   For each segment, also set:
   - "isLayoverArrival": true if this segment arrives at a layover airport
   - "connectionGroup": integer grouping connected flights. null if standalone.

b) DETECT MISSING LEGS: Check if there's a flight between each consecutive destination. Flag missing legs using the EXACT field names shown above: "fromCity" (NOT "from_city"), "toCity" (NOT "to_city").

c) CALCULATE DESTINATION AVAILABILITY WINDOWS:
   - availableFrom = arrival time + 4 hours (international) or + 2 hours (domestic/short-haul under 4h)
   - availableUntil = departure time - 3.5 hours (international) or - 2.5 hours (domestic/short-haul)
   - If arrival/departure is unknown (missing leg), set to null

d) BUILD ROUTE SUMMARY in route.display: Show layovers in parentheses and destinations in brackets.

e) IDENTIFY LAYOVERS with "arrivalTime" and "departureTime" (NOT "arrival"/"departure")

f) GENERATE WARNINGS as objects with "type", "message", "severity" keys (NOT as plain strings)

g) GENERATE A SUMMARY text

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

    // --- SERVER-SIDE LAYOVER VALIDATION ---
    // Deterministic post-processing: if two consecutive segments share an airport
    // with < 6 hours gap, classify as a layover connection even if the AI missed it.
    if (parsedBooking.segments && parsedBooking.segments.length > 1) {
      for (let i = 0; i < parsedBooking.segments.length - 1; i++) {
        const current = parsedBooking.segments[i];
        const next = parsedBooking.segments[i + 1];
        if (current.destination_code && next.origin_code &&
            current.destination_code === next.origin_code) {
          const arrivalMins = timeToMinutes(current.end_time);
          const departureMins = timeToMinutes(next.start_time);
          if (arrivalMins !== null && departureMins !== null) {
            const sameDay = current.end_date === next.start_date;
            const gap = sameDay ? departureMins - arrivalMins : (departureMins + 1440) - arrivalMins;
            if (gap > 0 && gap < 360) { // Under 6 hours = layover
              current.isLayoverArrival = true;
              const group = current.connectionGroup || next.connectionGroup || (i + 1);
              current.connectionGroup = group;
              next.connectionGroup = group;
              console.log(`[LayoverValidation] ${current.destination_code} is a layover (${gap} min gap between segments ${i} and ${i+1})`);
            }
          }
        }
      }
    }

    // Normalize intelligence fields — remap snake_case / variant keys to canonical camelCase
    if (intelligence) {
      const raw: any = intelligence;

      // 1. Normalize route
      const routeRaw = raw.route || {};
      const isEmptyRoute = !routeRaw.display && Object.keys(routeRaw).length <= 0;
      if (isEmptyRoute) {
        const display = raw.route_summary || raw.routeDisplay || raw.route_display || '';
        intelligence.route = {
          display: display || routeRaw.display || '',
          homeAirport: routeRaw.homeAirport || routeRaw.home_airport || '',
          destinationAirports: routeRaw.destinationAirports || routeRaw.destination_airports || [],
          layoverAirports: routeRaw.layoverAirports || routeRaw.layover_airports || [],
        };
      } else {
        intelligence.route = {
          display: routeRaw.display || routeRaw.route_display || '',
          homeAirport: routeRaw.homeAirport || routeRaw.home_airport || '',
          destinationAirports: routeRaw.destinationAirports || routeRaw.destination_airports || [],
          layoverAirports: routeRaw.layoverAirports || routeRaw.layover_airports || [],
        };
      }

      // 2. Normalize destinationSchedule
      const schedRaw = raw.destinationSchedule || raw.destination_availability || raw.destination_schedule || [];
      intelligence.destinationSchedule = (Array.isArray(schedRaw) ? schedRaw : []).map((d: any) => ({
        city: d.city || d.destination || '',
        airport: d.airport || d.airport_code || d.airportCode || '',
        arrivalDatetime: d.arrivalDatetime || d.arrival_datetime || d.arrival || null,
        departureDatetime: d.departureDatetime || d.departure_datetime || d.departure || null,
        availableFrom: d.availableFrom || d.available_from || null,
        availableUntil: d.availableUntil || d.available_until || null,
        fullDays: d.fullDays ?? d.full_days ?? 0,
        isFirstDestination: d.isFirstDestination ?? d.is_first_destination ?? false,
        isLastDestination: d.isLastDestination ?? d.is_last_destination ?? false,
        notes: d.notes || [],
      }));

      // 3. Normalize missingLegs
      const legsRaw = raw.missingLegs || raw.missing_legs || [];
      intelligence.missingLegs = (Array.isArray(legsRaw) ? legsRaw : []).map((l: any) => ({
        from: l.from || l.from_code || '',
        fromCity: l.fromCity || l.from_city || l.fromLocation || '',
        to: l.to || l.to_code || '',
        toCity: l.toCity || l.to_city || l.toLocation || '',
        reason: l.reason || '',
        suggestedDateRange: l.suggestedDateRange || l.suggested_date_range || l.dateRange || {},
        priority: l.priority || 'WARNING',
      }));

      // 4. Normalize layovers
      const layRaw = raw.layovers || [];
      intelligence.layovers = (Array.isArray(layRaw) ? layRaw : []).map((lo: any) => ({
        airport: lo.airport || '',
        city: lo.city || '',
        arrivalTime: lo.arrivalTime || lo.arrival_time || lo.arrival || '',
        departureTime: lo.departureTime || lo.departure_time || lo.departure || '',
        duration: lo.duration || '',
      }));

      // 5. Normalize warnings — wrap strings into objects
      const warnRaw = raw.warnings || [];
      intelligence.warnings = (Array.isArray(warnRaw) ? warnRaw : []).map((w: any) => {
        if (typeof w === 'string') {
          return { type: 'GENERAL', message: w, severity: 'WARNING' as const };
        }
        return {
          type: w.type || 'GENERAL',
          message: w.message || '',
          severity: w.severity || 'WARNING',
        };
      });

      // 6. Normalize summary
      intelligence.summary = raw.summary || raw.route_summary || '';

      console.log('[normalize] destinationSchedule count:', intelligence.destinationSchedule.length);
      console.log('[normalize] missingLegs count:', intelligence.missingLegs.length);
      console.log('[normalize] route.display:', intelligence.route?.display);
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
