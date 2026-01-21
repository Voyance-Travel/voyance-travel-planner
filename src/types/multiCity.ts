/**
 * Multi-City Trip Types
 * 
 * Types for planning trips that span multiple destinations
 */

export interface TripDestination {
  id: string;
  city: string;
  country?: string;
  nights: number;
  order: number;
  arrivalDate?: string;
  departureDate?: string;
  airportCode?: string;
  timezone?: string;
}

export interface InterCityTransport {
  id: string;
  fromCity: string;
  toCity: string;
  type: 'flight' | 'train' | 'bus' | 'ferry' | 'car';
  departureDate: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  estimatedPrice?: number;
  currency?: string;
  bookingUrl?: string;
  isBooked?: boolean;
  confirmationNumber?: string;
  notes?: string;
}

export interface MultiCityTrip {
  isMultiCity: boolean;
  destinations: TripDestination[];
  transports: InterCityTransport[];
  totalNights: number;
}

export interface PopularRoute {
  id: string;
  name: string;
  slug: string;
  region: string;
  description: string;
  destinations: Array<{
    city: string;
    country: string;
    recommendedNights: number;
    highlights: string[];
  }>;
  totalDays: number;
  bestFor: string[];
  imageUrl?: string;
  popularity: number;
}

// Popular pre-built routes for quick selection
export const POPULAR_ROUTES: PopularRoute[] = [
  {
    id: 'classic-europe',
    name: 'Classic Europe',
    slug: 'classic-europe',
    region: 'Europe',
    description: 'Experience the best of Western Europe: iconic landmarks, world-class art, and incredible cuisine.',
    destinations: [
      { city: 'London', country: 'United Kingdom', recommendedNights: 3, highlights: ['Big Ben', 'British Museum', 'Tower of London'] },
      { city: 'Paris', country: 'France', recommendedNights: 4, highlights: ['Eiffel Tower', 'Louvre', 'Montmartre'] },
      { city: 'Rome', country: 'Italy', recommendedNights: 3, highlights: ['Colosseum', 'Vatican', 'Trevi Fountain'] },
    ],
    totalDays: 10,
    bestFor: ['First-timers', 'Culture lovers', 'History buffs'],
    imageUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800',
    popularity: 95,
  },
  {
    id: 'italian-grand-tour',
    name: 'Italian Grand Tour',
    slug: 'italian-grand-tour',
    region: 'Europe',
    description: 'From the canals of Venice to the ruins of Rome, discover Italy\'s timeless beauty.',
    destinations: [
      { city: 'Rome', country: 'Italy', recommendedNights: 3, highlights: ['Colosseum', 'Vatican City', 'Roman Forum'] },
      { city: 'Florence', country: 'Italy', recommendedNights: 3, highlights: ['Uffizi Gallery', 'Duomo', 'Ponte Vecchio'] },
      { city: 'Venice', country: 'Italy', recommendedNights: 2, highlights: ['St. Mark\'s Square', 'Grand Canal', 'Murano Island'] },
    ],
    totalDays: 8,
    bestFor: ['Art lovers', 'Foodies', 'Romantics'],
    imageUrl: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=800',
    popularity: 90,
  },
  {
    id: 'southeast-asia-explorer',
    name: 'Southeast Asia Explorer',
    slug: 'southeast-asia-explorer',
    region: 'Asia',
    description: 'Temples, beaches, and vibrant street food across three incredible countries.',
    destinations: [
      { city: 'Bangkok', country: 'Thailand', recommendedNights: 3, highlights: ['Grand Palace', 'Chatuchak Market', 'Street Food'] },
      { city: 'Siem Reap', country: 'Cambodia', recommendedNights: 3, highlights: ['Angkor Wat', 'Ta Prohm', 'Floating Villages'] },
      { city: 'Ho Chi Minh City', country: 'Vietnam', recommendedNights: 3, highlights: ['Cu Chi Tunnels', 'Ben Thanh Market', 'Mekong Delta'] },
    ],
    totalDays: 9,
    bestFor: ['Adventure seekers', 'Budget travelers', 'Food lovers'],
    imageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800',
    popularity: 88,
  },
  {
    id: 'japan-golden-route',
    name: 'Japan Golden Route',
    slug: 'japan-golden-route',
    region: 'Asia',
    description: 'The essential Japan experience: ultra-modern Tokyo to ancient Kyoto.',
    destinations: [
      { city: 'Tokyo', country: 'Japan', recommendedNights: 4, highlights: ['Shibuya Crossing', 'Senso-ji Temple', 'Tsukiji Market'] },
      { city: 'Kyoto', country: 'Japan', recommendedNights: 3, highlights: ['Fushimi Inari', 'Arashiyama Bamboo', 'Gion District'] },
      { city: 'Osaka', country: 'Japan', recommendedNights: 2, highlights: ['Dotonbori', 'Osaka Castle', 'Street Food'] },
    ],
    totalDays: 9,
    bestFor: ['Culture enthusiasts', 'Foodies', 'Tech lovers'],
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    popularity: 92,
  },
  {
    id: 'iberian-adventure',
    name: 'Iberian Adventure',
    slug: 'iberian-adventure',
    region: 'Europe',
    description: 'Sun-soaked cities, flamenco, and tapas through Spain and Portugal.',
    destinations: [
      { city: 'Barcelona', country: 'Spain', recommendedNights: 3, highlights: ['Sagrada Familia', 'Park Güell', 'La Rambla'] },
      { city: 'Madrid', country: 'Spain', recommendedNights: 3, highlights: ['Prado Museum', 'Retiro Park', 'Tapas Crawl'] },
      { city: 'Lisbon', country: 'Portugal', recommendedNights: 3, highlights: ['Belém Tower', 'Alfama', 'Sintra Day Trip'] },
    ],
    totalDays: 9,
    bestFor: ['Nightlife lovers', 'Art enthusiasts', 'Beach seekers'],
    imageUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800',
    popularity: 85,
  },
  {
    id: 'central-europe',
    name: 'Central Europe Gems',
    slug: 'central-europe',
    region: 'Europe',
    description: 'Fairy-tale cities, classical music, and imperial grandeur.',
    destinations: [
      { city: 'Prague', country: 'Czech Republic', recommendedNights: 3, highlights: ['Charles Bridge', 'Prague Castle', 'Old Town Square'] },
      { city: 'Vienna', country: 'Austria', recommendedNights: 3, highlights: ['Schönbrunn Palace', 'Belvedere', 'Coffee Houses'] },
      { city: 'Budapest', country: 'Hungary', recommendedNights: 3, highlights: ['Thermal Baths', 'Parliament', 'Ruin Bars'] },
    ],
    totalDays: 9,
    bestFor: ['History buffs', 'Architecture lovers', 'Budget travelers'],
    imageUrl: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800',
    popularity: 82,
  },
];

// Helper functions
export function calculateTotalNights(destinations: TripDestination[]): number {
  return destinations.reduce((total, dest) => total + dest.nights, 0);
}

export function generateDestinationDates(
  destinations: TripDestination[],
  startDate: string
): TripDestination[] {
  let currentDate = new Date(startDate);
  
  return destinations.map((dest, index) => {
    const arrivalDate = currentDate.toISOString().split('T')[0];
    currentDate.setDate(currentDate.getDate() + dest.nights);
    const departureDate = currentDate.toISOString().split('T')[0];
    
    return {
      ...dest,
      order: index + 1,
      arrivalDate,
      departureDate,
    };
  });
}

export function getRouteBySlug(slug: string): PopularRoute | undefined {
  return POPULAR_ROUTES.find(route => route.slug === slug);
}

export function getRoutesByRegion(region: string): PopularRoute[] {
  return POPULAR_ROUTES.filter(route => route.region === region);
}
