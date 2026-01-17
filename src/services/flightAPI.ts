/**
 * Flight API Service
 * Handles flight search with mock data (ready for live API integration)
 */

export interface FlightSegment {
  departure: {
    airport: string;
    time: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    time: string;
    terminal?: string;
  };
  carrier: string;
  flightNumber: string;
  duration: string;
  aircraft?: string;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface FlightOption {
  id: string;
  airline: string;
  airlineLogo?: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  duration: number; // in minutes
  price: number;
  origin: string;
  destination: string;
  cabinClass: string;
  stops: number;
  isRecommended?: boolean;
  amenities?: string[];
  rationale?: string[];
  currency?: string;
  segments?: FlightSegment[];
}

// Airline data
const AIRLINES = [
  { code: 'DL', name: 'Delta', logo: '✈️' },
  { code: 'AA', name: 'American', logo: '✈️' },
  { code: 'UA', name: 'United', logo: '✈️' },
  { code: 'BA', name: 'British Airways', logo: '✈️' },
  { code: 'LH', name: 'Lufthansa', logo: '✈️' },
  { code: 'AF', name: 'Air France', logo: '✈️' },
  { code: 'KL', name: 'KLM', logo: '✈️' },
  { code: 'EK', name: 'Emirates', logo: '✈️' },
];

/**
 * Generate mock flight options
 */
function generateMockFlights(params: FlightSearchParams): FlightOption[] {
  const flights: FlightOption[] = [];
  const basePrice = params.cabinClass === 'business' ? 2500 :
                    params.cabinClass === 'premium_economy' ? 1200 :
                    params.cabinClass === 'first' ? 5000 : 450;

  for (let i = 0; i < 8; i++) {
    const airline = AIRLINES[i % AIRLINES.length];
    const stops = i < 2 ? 0 : i < 5 ? 1 : 2;
    const baseDuration = 480 + Math.floor(Math.random() * 240); // 8-12 hours base
    const duration = baseDuration + stops * 90; // Add 90min per stop
    const priceVariation = 0.8 + Math.random() * 0.6; // ±40% variation
    const price = Math.round(basePrice * priceVariation * (1 - stops * 0.1));

    const departureHour = 6 + (i * 2) % 18;
    const departureDate = new Date(params.departureDate);
    departureDate.setHours(departureHour, Math.floor(Math.random() * 60));

    const arrivalDate = new Date(departureDate.getTime() + duration * 60000);

    const rationales = [
      stops === 0 ? 'Direct flight minimizes travel fatigue' : `${stops} stop(s) offers better pricing`,
      departureHour < 10 ? 'Morning departure maximizes first day' : 
        departureHour > 18 ? 'Evening flight allows full work day' : 
        'Midday departure balances rest and arrival time',
      price < basePrice ? 'Excellent value for this route' : 'Premium service quality',
    ];

    flights.push({
      id: `flight-${i + 1}`,
      airline: airline.name,
      airlineLogo: airline.logo,
      flightNumber: `${airline.code}${1000 + Math.floor(Math.random() * 9000)}`,
      departureTime: departureDate.toISOString(),
      arrivalTime: arrivalDate.toISOString(),
      duration,
      price,
      origin: params.origin,
      destination: params.destination,
      cabinClass: params.cabinClass || 'economy',
      stops,
      isRecommended: i === 2,
      amenities: stops === 0 ? ['WiFi', 'Power', 'Entertainment'] : ['WiFi'],
      rationale: rationales,
      currency: 'USD',
      segments: [{
        departure: {
          airport: params.origin,
          time: departureDate.toISOString(),
          terminal: `T${Math.floor(Math.random() * 4) + 1}`,
        },
        arrival: {
          airport: params.destination,
          time: arrivalDate.toISOString(),
          terminal: `T${Math.floor(Math.random() * 4) + 1}`,
        },
        carrier: airline.name,
        flightNumber: `${airline.code}${1000 + i}`,
        duration: formatDuration(duration),
        aircraft: 'Boeing 787',
      }],
    });
  }

  return flights.sort((a, b) => a.price - b.price);
}

/**
 * Format duration in minutes to readable string
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Search for flights
 */
export async function searchFlights(params: FlightSearchParams): Promise<FlightOption[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // In future: Replace with actual API call
  // const response = await fetch('/api/flights/search', { ... });
  
  return generateMockFlights(params);
}

/**
 * Get flight details by ID
 */
export async function getFlightDetails(flightId: string): Promise<FlightOption | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Generate a sample flight
  return {
    id: flightId,
    airline: 'Delta',
    airlineLogo: '✈️',
    flightNumber: 'DL1234',
    departureTime: new Date().toISOString(),
    arrivalTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    duration: 480,
    price: 650,
    origin: 'JFK',
    destination: 'CDG',
    cabinClass: 'economy',
    stops: 0,
    isRecommended: true,
    amenities: ['WiFi', 'Power', 'Entertainment', 'Meals'],
    rationale: ['Direct flight', 'Excellent timing', 'Premium service'],
    currency: 'USD',
  };
}

/**
 * Flight API object for compatibility
 */
export const flightAPI = {
  searchFlights,
  getFlightDetails,
};
