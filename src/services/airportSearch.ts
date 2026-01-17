/**
 * Airport Search Utilities
 * Find airports by destination with distance calculations
 */

export interface Airport {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  isInternational?: boolean;
  isMajorHub?: boolean;
}

export interface AirportSearchResult extends Airport {
  distanceKm: number;
  transferTimeMins: number;
  isPrimary?: boolean;
  convenienceScore: number;
}

// Major airports database
const AIRPORTS: Airport[] = [
  { id: 'jfk', code: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'USA', latitude: 40.6413, longitude: -73.7781, isInternational: true, isMajorHub: true },
  { id: 'lax', code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'USA', latitude: 33.9416, longitude: -118.4085, isInternational: true, isMajorHub: true },
  { id: 'lhr', code: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'UK', latitude: 51.4700, longitude: -0.4543, isInternational: true, isMajorHub: true },
  { id: 'cdg', code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', latitude: 49.0097, longitude: 2.5479, isInternational: true, isMajorHub: true },
  { id: 'hnd', code: 'HND', name: 'Haneda Airport', city: 'Tokyo', country: 'Japan', latitude: 35.5494, longitude: 139.7798, isInternational: true, isMajorHub: true },
  { id: 'nrt', code: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'Japan', latitude: 35.7720, longitude: 140.3929, isInternational: true, isMajorHub: true },
  { id: 'kix', code: 'KIX', name: 'Kansai International', city: 'Osaka', country: 'Japan', latitude: 34.4320, longitude: 135.2304, isInternational: true, isMajorHub: false },
  { id: 'lis', code: 'LIS', name: 'Lisbon Portela Airport', city: 'Lisbon', country: 'Portugal', latitude: 38.7756, longitude: -9.1354, isInternational: true, isMajorHub: false },
  { id: 'bcn', code: 'BCN', name: 'Barcelona El Prat', city: 'Barcelona', country: 'Spain', latitude: 41.2974, longitude: 2.0833, isInternational: true, isMajorHub: false },
  { id: 'cpt', code: 'CPT', name: 'Cape Town International', city: 'Cape Town', country: 'South Africa', latitude: -33.9715, longitude: 18.6021, isInternational: true, isMajorHub: false },
  { id: 'sin', code: 'SIN', name: 'Changi Airport', city: 'Singapore', country: 'Singapore', latitude: 1.3644, longitude: 103.9915, isInternational: true, isMajorHub: true },
  { id: 'bkk', code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', latitude: 13.6900, longitude: 100.7501, isInternational: true, isMajorHub: true },
  { id: 'icn', code: 'ICN', name: 'Incheon International', city: 'Seoul', country: 'South Korea', latitude: 37.4602, longitude: 126.4407, isInternational: true, isMajorHub: true },
  { id: 'dxb', code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', latitude: 25.2532, longitude: 55.3657, isInternational: true, isMajorHub: true },
  { id: 'mex', code: 'MEX', name: 'Mexico City International', city: 'Mexico City', country: 'Mexico', latitude: 19.4363, longitude: -99.0721, isInternational: true, isMajorHub: true },
  { id: 'eze', code: 'EZE', name: 'Ezeiza International', city: 'Buenos Aires', country: 'Argentina', latitude: -34.8222, longitude: -58.5358, isInternational: true, isMajorHub: false },
];

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate transfer time based on distance
 */
function estimateTransferTime(distanceKm: number): number {
  // Rough estimate: 1.5 min per km for city transfers
  return Math.round(distanceKm * 1.5 + 15); // +15 min base
}

/**
 * Calculate convenience score (0-100)
 */
function calculateConvenienceScore(airport: Airport, distanceKm: number): number {
  let score = 100;
  
  // Distance penalty
  score -= Math.min(distanceKm * 0.5, 30);
  
  // Bonus for major hub
  if (airport.isMajorHub) score += 10;
  
  // Bonus for international
  if (airport.isInternational) score += 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Search for airports near a destination
 */
export async function searchAirportsNearDestination(
  destinationCity: string,
  maxDistanceKm = 200
): Promise<AirportSearchResult[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Find airports matching the city
  const cityLower = destinationCity.toLowerCase();
  
  return AIRPORTS
    .filter(airport => 
      airport.city.toLowerCase().includes(cityLower) ||
      cityLower.includes(airport.city.toLowerCase())
    )
    .map((airport, index) => {
      const distanceKm = 10 + Math.random() * 30; // Mock distance
      return {
        ...airport,
        distanceKm: Math.round(distanceKm * 10) / 10,
        transferTimeMins: estimateTransferTime(distanceKm),
        isPrimary: index === 0,
        convenienceScore: calculateConvenienceScore(airport, distanceKm),
      };
    })
    .filter(airport => airport.distanceKm <= maxDistanceKm)
    .sort((a, b) => b.convenienceScore - a.convenienceScore);
}

/**
 * Get airport by code
 */
export function getAirportByCode(code: string): Airport | undefined {
  return AIRPORTS.find(a => a.code.toUpperCase() === code.toUpperCase());
}

/**
 * Search airports by query
 */
export function searchAirports(query: string): Airport[] {
  const lowerQuery = query.toLowerCase();
  return AIRPORTS.filter(airport =>
    airport.code.toLowerCase().includes(lowerQuery) ||
    airport.name.toLowerCase().includes(lowerQuery) ||
    airport.city.toLowerCase().includes(lowerQuery)
  ).slice(0, 10);
}

/**
 * Get all major hub airports
 */
export function getMajorHubs(): Airport[] {
  return AIRPORTS.filter(a => a.isMajorHub);
}
