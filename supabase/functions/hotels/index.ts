import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  rooms?: number;
  priceRange?: { min?: number; max?: number };
  starRating?: number[];
  amenities?: string[];
}

// Cache for Amadeus access token
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const apiKey = Deno.env.get('AMADEUS_API_KEY');
  const apiSecret = Deno.env.get('AMADEUS_API_SECRET');

  if (!apiKey || !apiSecret) {
    throw new Error('Amadeus credentials not configured');
  }

  console.log('[Hotels] Fetching new Amadeus access token (TEST MODE)');
  
  // Using TEST environment for development
  const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
  });

  if (!response.ok) {
    throw new Error('Failed to get Amadeus access token');
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

// City code mapping for common destinations
const cityCodeMap: Record<string, string> = {
  'paris': 'PAR',
  'london': 'LON',
  'new york': 'NYC',
  'tokyo': 'TYO',
  'rome': 'ROM',
  'barcelona': 'BCN',
  'amsterdam': 'AMS',
  'dubai': 'DXB',
  'singapore': 'SIN',
  'sydney': 'SYD',
  'los angeles': 'LAX',
  'miami': 'MIA',
  'san francisco': 'SFO',
  'chicago': 'CHI',
  'berlin': 'BER',
  'madrid': 'MAD',
  'lisbon': 'LIS',
  'bangkok': 'BKK',
  'hong kong': 'HKG',
  'seoul': 'SEL',
};

function getCityCode(destination: string): string {
  const normalized = destination.toLowerCase().trim();
  
  // Check direct mapping
  if (cityCodeMap[normalized]) {
    return cityCodeMap[normalized];
  }
  
  // Check if destination contains a known city
  for (const [city, code] of Object.entries(cityCodeMap)) {
    if (normalized.includes(city)) {
      return code;
    }
  }
  
  // Use first 3 letters as fallback (may not work)
  return destination.substring(0, 3).toUpperCase();
}

function transformHotelOffer(hotel: any, offer: any): any {
  const nights = offer?.price?.variations?.changes?.length || 1;
  const totalPrice = parseFloat(offer?.price?.total || '0');
  
  return {
    id: hotel.hotelId || hotel.hotel?.hotelId,
    name: hotel.name || hotel.hotel?.name || 'Unknown Hotel',
    address: hotel.address?.lines?.join(', ') || hotel.hotel?.address?.lines?.join(', ') || '',
    city: hotel.address?.cityName || hotel.hotel?.address?.cityName || '',
    starRating: hotel.rating || hotel.hotel?.rating || 3,
    pricePerNight: totalPrice / nights,
    totalPrice: totalPrice,
    currency: offer?.price?.currency || 'USD',
    imageUrl: hotel.media?.[0]?.uri || null,
    amenities: hotel.amenities || [],
    roomType: offer?.room?.typeEstimated?.category || 'Standard Room',
    bedType: offer?.room?.typeEstimated?.beds || 1,
    description: offer?.room?.description?.text || '',
    cancellationPolicy: offer?.policies?.cancellation?.description?.text || 'See hotel policy',
    checkIn: offer?.checkInDate,
    checkOut: offer?.checkOutDate,
    latitude: hotel.geoCode?.latitude || hotel.hotel?.geoCode?.latitude,
    longitude: hotel.geoCode?.longitude || hotel.hotel?.geoCode?.longitude,
  };
}

async function searchHotels(params: HotelSearchParams): Promise<any[]> {
  const token = await getAmadeusToken();
  const cityCode = getCityCode(params.destination);
  
  console.log('[Hotels] Searching in:', cityCode, 'for', params.destination);

  // Step 1: Get hotels by city (TEST environment)
  const hotelsResponse = await fetch(
    `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}&radius=50&radiusUnit=KM&hotelSource=ALL`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!hotelsResponse.ok) {
    const error = await hotelsResponse.text();
    console.error('[Hotels] City search error:', error);
    return [];
  }

  const hotelsData = await hotelsResponse.json();
  const hotelIds = (hotelsData.data || []).slice(0, 20).map((h: any) => h.hotelId);

  if (hotelIds.length === 0) {
    console.log('[Hotels] No hotels found for city:', cityCode);
    return [];
  }

  console.log('[Hotels] Found', hotelIds.length, 'hotels, getting offers');

  // Step 2: Get offers for these hotels
  const offersParams = new URLSearchParams({
    hotelIds: hotelIds.join(','),
    checkInDate: params.checkIn,
    checkOutDate: params.checkOut,
    adults: String(params.guests || 1),
    roomQuantity: String(params.rooms || 1),
    currency: 'USD',
  });

  // Step 2: Get offers for these hotels (TEST environment)
  const offersResponse = await fetch(
    `https://test.api.amadeus.com/v3/shopping/hotel-offers?${offersParams}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!offersResponse.ok) {
    const error = await offersResponse.text();
    console.error('[Hotels] Offers error:', error);
    
    // Return basic hotel info without pricing
    return hotelsData.data.slice(0, 10).map((hotel: any) => ({
      id: hotel.hotelId,
      name: hotel.name,
      address: hotel.address?.lines?.join(', ') || '',
      city: params.destination,
      starRating: 3,
      pricePerNight: 150,
      totalPrice: 150,
      currency: 'USD',
      imageUrl: null,
      amenities: [],
    }));
  }

  const offersData = await offersResponse.json();
  console.log('[Hotels] Got offers for', offersData.data?.length || 0, 'hotels');

  return (offersData.data || []).map((hotelData: any) => 
    transformHotelOffer(hotelData.hotel || hotelData, hotelData.offers?.[0])
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      const action = body.action || 'search';
      
      if (action === 'search') {
        const hotels = await searchHotels(body);
        return new Response(JSON.stringify({ hotels, success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Hotels] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: message,
        hotels: [],
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
