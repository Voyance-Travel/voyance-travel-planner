/**
 * Hotel API Service
 * Handles hotel search with mock data (ready for live API integration)
 */

export interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms?: number;
  budgetTier?: 'budget' | 'moderate' | 'premium' | 'luxury';
}

export interface HotelOption {
  id: string;
  name: string;
  description: string;
  address: string;
  neighborhood: string;
  stars: number;
  price: number;
  pricePerNight: number;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  amenities: string[];
  isRecommended?: boolean;
  rationale?: string[];
  cancellationPolicy?: 'free' | 'partial' | 'nonRefundable';
  roomType?: string;
  currency?: string;
  distance?: number;
}

// Hotel templates for mock data
const HOTEL_TEMPLATES = [
  {
    name: 'Grand Heritage Hotel',
    neighborhood: 'Historic Center',
    stars: 5,
    basePrice: 450,
    description: 'Elegant five-star hotel in a restored historic building with exceptional service.',
    amenities: ['Free WiFi', 'Pool', 'Spa', 'Gym', 'Restaurant', 'Bar', 'Concierge'],
  },
  {
    name: 'Boutique Maison',
    neighborhood: 'Arts District',
    stars: 4,
    basePrice: 280,
    description: 'Stylish boutique property with unique design and personalized guest experiences.',
    amenities: ['Free WiFi', 'Breakfast', 'Concierge', 'Room Service'],
  },
  {
    name: 'Urban Loft Hotel',
    neighborhood: 'Downtown',
    stars: 4,
    basePrice: 195,
    description: 'Contemporary hotel with modern amenities perfect for urban explorers.',
    amenities: ['Free WiFi', 'Gym', 'Restaurant', 'Business Center'],
  },
  {
    name: 'Seaside Retreat',
    neighborhood: 'Waterfront',
    stars: 5,
    basePrice: 520,
    description: 'Luxurious beachfront resort with spectacular ocean views.',
    amenities: ['Free WiFi', 'Pool', 'Spa', 'Beach Access', 'Restaurant', 'Bar'],
  },
  {
    name: 'City Center Inn',
    neighborhood: 'Central',
    stars: 3,
    basePrice: 145,
    description: 'Comfortable accommodation in the heart of the city.',
    amenities: ['Free WiFi', 'Breakfast', 'Business Center'],
  },
  {
    name: 'Garden Villa',
    neighborhood: 'Residential',
    stars: 4,
    basePrice: 320,
    description: 'Peaceful retreat surrounded by beautiful gardens.',
    amenities: ['Free WiFi', 'Garden', 'Restaurant', 'Spa'],
  },
];

// Hotel images
const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80',
];

/**
 * Calculate nights between dates
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Generate mock hotel options
 */
function generateMockHotels(params: HotelSearchParams): HotelOption[] {
  const nights = calculateNights(params.checkIn, params.checkOut);
  const budgetMultiplier = params.budgetTier === 'luxury' ? 1.5 :
                           params.budgetTier === 'premium' ? 1.2 :
                           params.budgetTier === 'budget' ? 0.7 : 1;

  return HOTEL_TEMPLATES.map((template, i) => {
    const priceVariation = 0.85 + Math.random() * 0.3;
    const pricePerNight = Math.round(template.basePrice * priceVariation * budgetMultiplier);
    const rating = 7 + Math.random() * 3;

    const rationales = [
      `Located in ${template.neighborhood} for easy access to attractions`,
      template.stars >= 4 ? 'High service standards match your preferences' : 'Good value without compromising comfort',
      template.amenities.includes('Breakfast') ? 'Included breakfast simplifies mornings' : 'Flexible dining options nearby',
    ];

    return {
      id: `hotel-${i + 1}`,
      name: template.name,
      description: template.description,
      address: `${100 + i * 25} ${template.neighborhood} Street`,
      neighborhood: template.neighborhood,
      stars: template.stars,
      price: pricePerNight * nights,
      pricePerNight,
      imageUrl: HOTEL_IMAGES[i % HOTEL_IMAGES.length],
      rating: Math.round(rating * 10) / 10,
      reviewCount: 50 + Math.floor(Math.random() * 450),
      amenities: template.amenities,
      isRecommended: i === 1 || i === 3,
      rationale: rationales,
      cancellationPolicy: (i < 3 ? 'free' : Math.random() > 0.5 ? 'partial' : 'nonRefundable') as 'free' | 'partial' | 'nonRefundable',
      roomType: i < 2 ? 'Deluxe Room' : 'Standard Room',
      currency: 'USD',
      distance: Math.round(Math.random() * 50) / 10,
    };
  }).sort((a, b) => b.rating - a.rating);
}

/**
 * Search for hotels
 */
export async function searchHotels(params: HotelSearchParams): Promise<HotelOption[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 700));
  
  // In future: Replace with actual API call
  // const response = await fetch('/api/hotels/search', { ... });
  
  return generateMockHotels(params);
}

/**
 * Get hotel details by ID
 */
export async function getHotelDetails(hotelId: string): Promise<HotelOption | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const template = HOTEL_TEMPLATES[0];
  
  return {
    id: hotelId,
    name: template.name,
    description: template.description,
    address: '100 Historic Center Street',
    neighborhood: template.neighborhood,
    stars: template.stars,
    price: 1350,
    pricePerNight: 450,
    imageUrl: HOTEL_IMAGES[0],
    rating: 9.2,
    reviewCount: 324,
    amenities: template.amenities,
    isRecommended: true,
    rationale: ['Excellent location', 'Top-rated service', 'Best value'],
    cancellationPolicy: 'free',
    roomType: 'Deluxe Suite',
    currency: 'USD',
    distance: 0.3,
  };
}

/**
 * Hotel API object for compatibility
 */
export const hotelAPI = {
  searchHotels,
  getHotelDetails,
};
