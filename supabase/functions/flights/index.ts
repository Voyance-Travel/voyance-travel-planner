import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: number;
  cabinClass?: string;
  directOnly?: boolean;
  maxStops?: number;
}

// Cache for Amadeus access token
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const apiKey = Deno.env.get('AMADEUS_API_KEY');
  const apiSecret = Deno.env.get('AMADEUS_API_SECRET');

  if (!apiKey || !apiSecret) {
    throw new Error('Amadeus credentials not configured');
  }

  console.log('[Flights] Fetching new Amadeus access token (TEST MODE)');
  
  // Using TEST environment for development
  const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Flights] Token error:', error);
    throw new Error('Failed to get Amadeus access token');
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

function transformFlightOffer(offer: any): any {
  const outbound = offer.itineraries[0];
  const returnItinerary = offer.itineraries[1];
  
  const firstSegment = outbound.segments[0];
  const lastOutboundSegment = outbound.segments[outbound.segments.length - 1];
  
  return {
    id: offer.id,
    airline: firstSegment.carrierCode,
    airlineName: firstSegment.carrierCode, // Would need airline lookup
    flightNumber: `${firstSegment.carrierCode}${firstSegment.number}`,
    origin: firstSegment.departure.iataCode,
    destination: lastOutboundSegment.arrival.iataCode,
    departureTime: firstSegment.departure.at,
    arrivalTime: lastOutboundSegment.arrival.at,
    duration: outbound.duration,
    stops: outbound.segments.length - 1,
    stopLocations: outbound.segments.slice(0, -1).map((s: any) => s.arrival.iataCode),
    price: parseFloat(offer.price.total),
    currency: offer.price.currency,
    cabinClass: offer.travelerPricings[0]?.fareDetailsBySegment[0]?.cabin || 'ECONOMY',
    seatsAvailable: offer.numberOfBookableSeats || 9,
    segments: outbound.segments.map((seg: any) => ({
      flightNumber: `${seg.carrierCode}${seg.number}`,
      departure: seg.departure,
      arrival: seg.arrival,
      duration: seg.duration,
      aircraft: seg.aircraft?.code,
    })),
    returnFlight: returnItinerary ? {
      departureTime: returnItinerary.segments[0].departure.at,
      arrivalTime: returnItinerary.segments[returnItinerary.segments.length - 1].arrival.at,
      duration: returnItinerary.duration,
      stops: returnItinerary.segments.length - 1,
      segments: returnItinerary.segments.map((seg: any) => ({
        flightNumber: `${seg.carrierCode}${seg.number}`,
        departure: seg.departure,
        arrival: seg.arrival,
        duration: seg.duration,
      })),
    } : null,
    rawOffer: offer, // Keep for booking
  };
}

async function searchFlights(params: FlightSearchParams): Promise<any[]> {
  const token = await getAmadeusToken();
  
  const searchParams = new URLSearchParams({
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.departureDate,
    adults: String(params.passengers || 1),
    max: '20',
    currencyCode: 'USD',
  });

  if (params.returnDate) {
    searchParams.set('returnDate', params.returnDate);
  }

  if (params.cabinClass) {
    const cabinMap: Record<string, string> = {
      'economy': 'ECONOMY',
      'premium_economy': 'PREMIUM_ECONOMY', 
      'business': 'BUSINESS',
      'first': 'FIRST',
    };
    searchParams.set('travelClass', cabinMap[params.cabinClass.toLowerCase()] || 'ECONOMY');
  }

  if (params.directOnly) {
    searchParams.set('nonStop', 'true');
  }

  console.log('[Flights] Searching:', Object.fromEntries(searchParams));

  // Using TEST environment for development
  const response = await fetch(
    `https://test.api.amadeus.com/v2/shopping/flight-offers?${searchParams}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Flights] Search error:', error);
    
    // Return empty array instead of throwing for graceful degradation
    if (response.status === 400) {
      console.log('[Flights] Invalid search parameters, returning empty');
      return [];
    }
    throw new Error(`Flight search failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('[Flights] Found', data.data?.length || 0, 'offers');
  
  return (data.data || []).map(transformFlightOffer);
}

async function getFlightDetails(offerId: string): Promise<any | null> {
  // For now, return null - would need to store offers in cache/DB
  console.log('[Flights] Get details for:', offerId);
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Route: POST /flights or /flights/search
    if (req.method === 'POST') {
      const body = await req.json();
      const action = body.action || 'search';
      
      if (action === 'search') {
        const flights = await searchFlights(body);
        return new Response(JSON.stringify({ flights, success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Route: GET /flights/:id
    if (req.method === 'GET' && pathParts.length > 0) {
      const flightId = pathParts[pathParts.length - 1];
      const flight = await getFlightDetails(flightId);
      
      if (!flight) {
        return new Response(JSON.stringify({ error: 'Flight not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ flight }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Flights] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: message,
        flights: [],
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
