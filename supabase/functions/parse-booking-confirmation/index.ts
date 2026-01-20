// Parse booking confirmation using AI

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Return a JSON object with these fields (only include fields you can extract with confidence):
- segment_type: one of "flight", "hotel", "car_rental", "rail", "tour", "cruise", "transfer", "insurance", "other"
- vendor_name: airline name, hotel name, or company name
- confirmation_number: booking reference or confirmation code
- start_date: in YYYY-MM-DD format
- start_time: in HH:MM format (24-hour)
- end_date: in YYYY-MM-DD format
- end_time: in HH:MM format (24-hour)
- origin: departure city/airport for flights, pickup location for cars
- origin_code: airport code like "JFK" or "LAX"
- destination: arrival city/airport for flights, hotel city
- destination_code: airport code
- flight_number: like "UA 123" or "DL456"
- cabin_class: "economy", "premium_economy", "business", or "first"
- room_type: hotel room type like "Deluxe King"
- room_count: number of rooms (integer)
- net_cost_cents: total price in cents (e.g., $150.00 = 15000)
- notes: any other relevant details like special requests, seat assignments, etc.

Only return valid JSON, no markdown or explanations.

Confirmation text:
${confirmationText}`;

    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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