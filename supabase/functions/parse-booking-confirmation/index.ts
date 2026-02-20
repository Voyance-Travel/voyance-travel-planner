// Parse booking confirmation using AI

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Use Lovable AI to parse the confirmation
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `You are a travel booking parser. Extract booking details from the following confirmation email or text.

IMPORTANT: If this confirmation contains MULTIPLE flights (multi-city, connections, or round-trip with multiple segments), set is_multi_segment to true and segment_count to the number of flights. For multi-segment bookings, extract ONLY the FIRST outbound flight segment details.

Return a JSON object with these fields (only include fields you can extract with confidence):
- segment_type: one of "flight", "hotel", "car_rental", "rail", "tour", "cruise", "transfer", "insurance", "other"
- vendor_name: airline name, hotel name, or company name
- confirmation_number: booking reference or confirmation code
- start_date: in YYYY-MM-DD format (for the FIRST flight segment only)
- start_time: in HH:MM format (24-hour, for the FIRST flight segment only)
- end_date: in YYYY-MM-DD format (arrival date of FIRST flight segment)
- end_time: in HH:MM format (24-hour, arrival time of FIRST flight segment)
- origin: departure city/airport for first flight
- origin_code: airport code like "JFK" or "LAX" for first flight
- destination: arrival city/airport for first flight
- destination_code: airport code for first flight arrival
- flight_number: like "UA 123" or "DL456" for the first flight
- cabin_class: "economy", "premium_economy", "business", or "first"
- is_multi_segment: true if there are multiple flights in this booking
- segment_count: total number of flight segments in this booking
- notes: any other relevant details like special requests, seat assignments, etc.

IMPORTANT: Do NOT invent or estimate any field values. If a price, cost, or fare is not explicitly stated in the text, do NOT include a price field. Only extract information that is clearly present in the confirmation text. Never hallucinate or guess values.

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

    // Parse the JSON from the AI response
    let parsedBooking: ParsedBooking;
    try {
      // Clean the response - remove markdown code blocks if present
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