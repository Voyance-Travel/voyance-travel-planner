/**
 * Affiliate Link Generator
 * 
 * Generates trackable affiliate links for travel bookings.
 * Revenue share: ~5-8% commission on completed bookings.
 * 
 * Currently supported:
 * - Booking.com: Hotels ($10-25 avg commission)
 * - Future: Viator, GetYourGuide (8% on tours)
 */

// =============================================================================
// Configuration
// =============================================================================

// TODO: Replace with actual affiliate IDs after signing up
// Booking.com: https://www.booking.com/affiliate-program.html
const BOOKING_COM_AFFILIATE_ID = 'voyance'; // Placeholder - needs real ID
const BOOKING_COM_LABEL = 'voyance-itinerary';

// =============================================================================
// Types
// =============================================================================

export interface HotelAffiliateParams {
  hotelName: string;
  city: string;
  country?: string;
  checkIn?: string;  // YYYY-MM-DD
  checkOut?: string; // YYYY-MM-DD
  guests?: number;
  rooms?: number;
}

export interface AffiliateLink {
  url: string;
  provider: 'booking.com' | 'hotels.com' | 'expedia';
  trackingId: string;
  estimatedCommission: string;
}

// =============================================================================
// Booking.com Integration
// =============================================================================

/**
 * Generate a Booking.com affiliate search link
 * 
 * Commission: ~25-40% of Booking.com's commission (effectively 4-6% of booking value)
 * Average hotel booking: $150-300 → Commission: $6-18
 */
export function generateBookingComLink(params: HotelAffiliateParams): AffiliateLink {
  const baseUrl = 'https://www.booking.com/searchresults.html';
  
  const searchParams = new URLSearchParams({
    aid: BOOKING_COM_AFFILIATE_ID,
    label: BOOKING_COM_LABEL,
    ss: `${params.hotelName}, ${params.city}${params.country ? `, ${params.country}` : ''}`,
    lang: 'en-us',
    sb: '1',
    src_elem: 'sb',
    src: 'index',
    dest_type: 'city',
  });

  // Add dates if provided
  if (params.checkIn) {
    searchParams.set('checkin', params.checkIn);
  }
  if (params.checkOut) {
    searchParams.set('checkout', params.checkOut);
  }
  if (params.guests) {
    searchParams.set('group_adults', String(params.guests));
  }
  if (params.rooms) {
    searchParams.set('no_rooms', String(params.rooms));
  }

  return {
    url: `${baseUrl}?${searchParams.toString()}`,
    provider: 'booking.com',
    trackingId: `${BOOKING_COM_LABEL}-${Date.now()}`,
    estimatedCommission: '$10-25',
  };
}

/**
 * Generate a Booking.com city search link (no specific hotel)
 */
export function generateBookingComCityLink(
  city: string,
  country?: string,
  checkIn?: string,
  checkOut?: string,
  guests?: number
): AffiliateLink {
  return generateBookingComLink({
    hotelName: '',
    city,
    country,
    checkIn,
    checkOut,
    guests,
  });
}

// =============================================================================
// Generic Hotel Link Generator
// =============================================================================

/**
 * Generate affiliate link for any hotel in itinerary
 * Currently uses Booking.com, can be extended to other providers
 */
export function generateHotelAffiliateLink(
  hotelName: string,
  city: string,
  options?: {
    country?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    rooms?: number;
    preferredProvider?: 'booking.com' | 'hotels.com';
  }
): AffiliateLink {
  // Default to Booking.com (highest commissions)
  return generateBookingComLink({
    hotelName,
    city,
    country: options?.country,
    checkIn: options?.checkIn,
    checkOut: options?.checkOut,
    guests: options?.guests,
    rooms: options?.rooms,
  });
}

// =============================================================================
// Tracking & Analytics
// =============================================================================

/**
 * Track when user clicks an affiliate link
 * This helps measure conversion rates
 */
export function trackAffiliateClick(
  link: AffiliateLink,
  context: {
    tripId?: string;
    dayNumber?: number;
    activityId?: string;
    source: 'itinerary' | 'hotel-card' | 'booking-modal';
  }
): void {
  // Log for analytics (implement actual tracking later)
  console.log('[affiliate] Click tracked:', {
    provider: link.provider,
    trackingId: link.trackingId,
    ...context,
    timestamp: new Date().toISOString(),
  });
  
  // TODO: Send to analytics endpoint
  // supabase.from('affiliate_clicks').insert({ ... })
}

/**
 * Estimate monthly affiliate revenue based on traffic
 * 
 * Assumptions:
 * - 20% of paid users click hotel links
 * - 10% of clickers complete a booking
 * - Average commission: $15
 */
export function estimateAffiliateRevenue(
  monthlyPaidUsers: number,
  clickRate: number = 0.20,
  conversionRate: number = 0.10,
  avgCommission: number = 15
): {
  clicks: number;
  bookings: number;
  revenue: number;
} {
  const clicks = Math.round(monthlyPaidUsers * clickRate);
  const bookings = Math.round(clicks * conversionRate);
  const revenue = bookings * avgCommission;
  
  return { clicks, bookings, revenue };
}
