// Parse booking confirmation using AI — extracts ALL flight segments

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
}

interface ParsedBooking {
  segment_type: 'flight' | 'hotel' | 'car_rental' | 'rail' | 'tour' | 'cruise' | 'transfer' | 'insurance' | 'other';
  vendor_name?: string;
  confirmation_number?: string;
  // Legacy single-segment fields (populated from first segment for backward compat)
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
  // NEW: all segments
  segments?: ParsedSegment[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { confirmationText } = await req.json();

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

    const prompt = `You are a travel booking parser. Extract booking details from the following confirmation email or text.

IMPORTANT: Extract ALL flight segments from this booking. If this is a multi-city or round-trip booking with multiple flights, extract EVERY segment.

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

Also include these top-level fields from the FIRST segment for backward compatibility:
- start_date, start_time, end_date, end_time, origin, origin_code, destination, destination_code, flight_number, cabin_class

- notes: any other relevant details like seat assignments, etc.

IMPORTANT: Do NOT invent or estimate any field values. If a value is not explicitly stated in the text, do NOT include it. Never hallucinate or guess values. If a price or fare is not explicitly stated, do NOT include a price/cost field.

Only return valid JSON, no markdown or explanations.

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

    let parsedBooking: ParsedBooking;
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

      parsedBooking = JSON.parse(cleanedContent);
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

    // Validate segment_type
    const validTypes = ['flight', 'hotel', 'car_rental', 'rail', 'tour', 'cruise', 'transfer', 'insurance', 'other'];
    if (!parsedBooking.segment_type || !validTypes.includes(parsedBooking.segment_type)) {
      parsedBooking.segment_type = 'other';
    }

    // Ensure segments array exists (backward compat: build from top-level fields if AI didn't return segments)
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

    // Update segment_count and is_multi_segment based on actual segments
    if (parsedBooking.segments) {
      parsedBooking.segment_count = parsedBooking.segments.length;
      parsedBooking.is_multi_segment = parsedBooking.segments.length > 1;
    }

    return new Response(
      JSON.stringify({ success: true, booking: parsedBooking }),
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
