export type TripStatus = 'DRAFT' | 'SAVED' | 'BOOKED';

export interface Trip {
  id: string;
  userId: string;
  destinationId: string;
  startDate: string;
  endDate: string;
  travelersCount: number;
  departureCity: string;
  status: TripStatus;
  priceLockExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripSelections {
  id: string;
  tripId: string;
  flight?: FlightOption;
  hotel?: HotelOption;
}

export interface FlightOption {
  id: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: number;
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
  rationale: string[];
}

export interface HotelOption {
  id: string;
  name: string;
  neighborhood: string;
  stars: number;
  pricePerNight: number;
  totalPrice: number;
  amenities: string[];
  rationale: string[];
  imageUrl: string;
}

export interface Itinerary {
  id: string;
  tripId: string;
  summary: string;
  days: ItineraryDay[];
  createdAt: string;
  updatedAt: string;
}

export interface ItineraryDay {
  id: string;
  dayNumber: number;
  date: string;
  headline: string;
  rationale: string[];
  items: ItineraryItem[];
}

export interface ItineraryItem {
  id: string;
  type: 'ACTIVITY' | 'FOOD' | 'TRANSIT' | 'BREAK';
  title: string;
  neighborhood?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  rationale?: string[];
}

// NOTE: Flight search removed - platform uses manual flight entry only
// See AddBookingInline.tsx for the manual entry flow

// Mock hotel options generator
export function generateHotelOptions(destination: string, nights: number): HotelOption[] {
  const hotels = [
    { name: 'The Grand Heritage', neighborhood: 'Historic Center', stars: 5, base: 450, img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80' },
    { name: 'Boutique Maison', neighborhood: 'Arts District', stars: 4, base: 280, img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80' },
    { name: 'Urban Loft Hotel', neighborhood: 'Downtown', stars: 4, base: 195, img: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80' },
    { name: 'Seaside Retreat', neighborhood: 'Waterfront', stars: 5, base: 520, img: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&q=80' },
    { name: 'City Center Inn', neighborhood: 'Central', stars: 3, base: 145, img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80' },
    { name: 'Garden Villa', neighborhood: 'Residential', stars: 4, base: 320, img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80' },
  ];

  const allAmenities = ['Free WiFi', 'Breakfast included', 'Pool', 'Spa', 'Gym', 'Restaurant', 'Bar', 'Concierge', 'Room service', 'Airport shuttle'];

  return hotels.map((hotel, i) => {
    const priceVariation = 0.85 + Math.random() * 0.3;
    const pricePerNight = Math.round(hotel.base * priceVariation);
    const numAmenities = hotel.stars + Math.floor(Math.random() * 3);
    const amenities = allAmenities.slice(0, numAmenities);

    const rationales = [
      `Located in ${hotel.neighborhood} for easy access to key attractions`,
      hotel.stars >= 4 ? 'High service standards match your preferences' : 'Good value without compromising comfort',
      amenities.includes('Breakfast included') ? 'Included breakfast simplifies morning logistics' : 'Flexible dining options nearby',
    ];

    return {
      id: `hotel-${i}`,
      name: hotel.name,
      neighborhood: hotel.neighborhood,
      stars: hotel.stars,
      pricePerNight,
      totalPrice: pricePerNight * nights,
      amenities,
      rationale: rationales,
      imageUrl: hotel.img,
    };
  });
}

// Calculate days between dates
export function calculateTripDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// Format date for display
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Check if price lock is active
export function isPriceLockActive(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}

// Get remaining time in seconds
export function getPriceLockRemaining(expiresAt?: string): number {
  if (!expiresAt) return 0;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}
