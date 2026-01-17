/**
 * Voyance Hotel API
 * 
 * Hotel search and booking endpoints:
 * - POST /api/v1/hotels/search - Search hotels
 * - GET /api/v1/hotels/preload - Preload hotels for destination
 * - POST /api/v1/hotels/batch-search - Batch search
 * - GET /api/v1/hotels/:id - Get hotel details
 * - POST /api/v1/hotels/hold - Create price lock
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms?: number;
  budgetTier?: 'budget' | 'moderate' | 'premium' | 'luxury';
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  amenities?: string[];
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
  images?: string[];
  rating: number;
  reviewCount: number;
  amenities: string[];
  isRecommended?: boolean;
  rationale?: string[];
  cancellationPolicy?: 'free' | 'partial' | 'nonRefundable';
  roomType?: string;
  currency?: string;
  distance?: number;
  featured?: boolean;
  breakfast?: boolean;
}

export interface HotelDestination {
  id: string;
  city: string;
  country: string;
  slug: string;
  description?: string;
  currencyCode: string;
  timezone: string;
}

export interface HotelSearchResponse {
  success: boolean;
  data?: {
    destination: HotelDestination;
    hotels: HotelOption[];
    filters: Record<string, unknown>;
    totalResults: number;
    recommendations?: HotelOption[];
  };
  // Legacy fields for backward compatibility
  hotels?: HotelOption[];
  error?: string;
}

export interface HotelDetailResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    description: string;
    address: string;
    rating: number;
    images: string[];
    amenities: string[];
    rooms: Array<{
      id: string;
      name: string;
      price: number;
      capacity: number;
      amenities: string[];
    }>;
    reviews: Array<{
      id: string;
      author: string;
      rating: number;
      text: string;
      date: string;
    }>;
    policies: {
      checkIn: string;
      checkOut: string;
      cancellation: string;
    };
  };
  error?: string;
}

export interface HotelHoldInput {
  tripId: string;
  optionId: string;
  total: number;
  currency: string;
}

export interface HotelHoldResponse {
  success: boolean;
  priceLock?: {
    id: string;
    expiresAt: string;
    lockedPrice: number;
  };
  error?: string;
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Mock Data (fallback)
// ============================================================================

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

const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80',
];

function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

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

// ============================================================================
// Hotel API Functions
// ============================================================================

/**
 * Search for hotels - tries backend first, falls back to mock data
 */
export async function searchHotels(params: HotelSearchParams): Promise<HotelOption[]> {
  try {
    const response = await apiRequest<HotelSearchResponse>('/api/v1/hotels/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    if (response.success && response.data?.hotels) {
      return response.data.hotels;
    }
    if (response.hotels) {
      return response.hotels;
    }
    // Fall back to mock if backend returns empty
    return generateMockHotels(params);
  } catch (error) {
    console.warn('[HotelAPI] Backend search failed, using mock data:', error);
    return generateMockHotels(params);
  }
}

/**
 * Search hotels with full response (for advanced use)
 */
export async function searchHotelsWithResponse(params: HotelSearchParams): Promise<HotelSearchResponse> {
  return apiRequest<HotelSearchResponse>('/api/v1/hotels/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Preload hotels for a destination (GET)
 */
export async function preloadHotels(params: {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
}): Promise<HotelSearchResponse> {
  const searchParams = new URLSearchParams({
    destination: params.destination,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
  });
  
  if (params.guests) searchParams.set('guests', String(params.guests));
  if (params.priceMin) searchParams.set('priceMin', String(params.priceMin));
  if (params.priceMax) searchParams.set('priceMax', String(params.priceMax));
  if (params.rating) searchParams.set('rating', String(params.rating));
  
  return apiRequest<HotelSearchResponse>(`/api/v1/hotels/preload?${searchParams.toString()}`, {
    method: 'GET',
  });
}

/**
 * Batch search hotels for multiple destinations
 */
export async function batchSearchHotels(params: {
  destinations: string[];
  checkIn: string;
  checkOut: string;
}): Promise<{
  results: Array<{
    destination: string;
    hotels: HotelOption[];
    status: 'success' | 'error';
  }>;
  totalDestinations: number;
  successCount: number;
}> {
  return apiRequest('/api/v1/hotels/batch-search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Get hotel details by ID
 */
export async function getHotelDetails(hotelId: string): Promise<HotelOption | null> {
  try {
    const response = await apiRequest<HotelDetailResponse>(`/api/v1/hotels/${hotelId}`, {
      method: 'GET',
    });
    
    if (response.success && response.data) {
      // Map to HotelOption format
      const data = response.data;
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        address: data.address,
        neighborhood: '',
        stars: Math.round(data.rating / 2),
        price: 0,
        pricePerNight: 0,
        imageUrl: data.images[0] || '',
        rating: data.rating,
        reviewCount: data.reviews.length,
        amenities: data.amenities,
        isRecommended: true,
        rationale: [],
        cancellationPolicy: 'free',
        roomType: data.rooms[0]?.name || 'Standard Room',
        currency: 'USD',
        distance: 0,
      };
    }
    return null;
  } catch (error) {
    console.warn('[HotelAPI] Failed to get hotel details:', error);
    // Return mock detail
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
}

/**
 * Create a price lock for a hotel
 */
export async function createHotelHold(input: HotelHoldInput): Promise<HotelHoldResponse> {
  return apiRequest<HotelHoldResponse>('/api/v1/hotels/hold', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useHotelSearch(params: HotelSearchParams | null) {
  return useQuery({
    queryKey: ['hotel-search', params],
    queryFn: () => searchHotels(params!),
    enabled: !!params,
    staleTime: 5 * 60_000,
  });
}

export function useHotelPreload(params: {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
} | null) {
  return useQuery({
    queryKey: ['hotel-preload', params],
    queryFn: () => preloadHotels(params!),
    enabled: !!params?.destination && !!params?.checkIn && !!params?.checkOut,
    staleTime: 5 * 60_000,
  });
}

export function useHotelDetails(hotelId: string | undefined) {
  return useQuery({
    queryKey: ['hotel-details', hotelId],
    queryFn: () => getHotelDetails(hotelId!),
    enabled: !!hotelId,
    staleTime: 30 * 60_000,
  });
}

export function useSearchHotels() {
  return useMutation({
    mutationFn: searchHotels,
  });
}

export function useCreateHotelHold() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createHotelHold,
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['price-lock', tripId] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

export const hotelAPI = {
  searchHotels,
  searchHotelsWithResponse,
  preloadHotels,
  batchSearchHotels,
  getHotelDetails,
  createHotelHold,
};

export default hotelAPI;
