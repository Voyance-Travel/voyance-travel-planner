/**
 * Reservation Urgency System
 * 
 * Categorizes activities by how far in advance they need to be booked
 */

export type ReservationUrgency = 
  | 'book_now'        // 60+ days in advance (Michelin restaurants, popular tours)
  | 'book_soon'       // 2-4 weeks in advance
  | 'book_week_before' // 1 week before
  | 'walk_in';        // No reservation needed

export interface ReservationConfig {
  urgency: ReservationUrgency;
  flag: string;
  description: string;
  leadTime: string;
}

export const RESERVATION_CONFIGS: Record<ReservationUrgency, ReservationConfig> = {
  book_now: {
    urgency: 'book_now',
    flag: '🔴 BOOK NOW',
    description: 'Requires booking 60+ days in advance',
    leadTime: '60+ days',
  },
  book_soon: {
    urgency: 'book_soon',
    flag: '🟡 BOOK 2-4 WEEKS',
    description: 'Requires booking 2-4 weeks in advance',
    leadTime: '2-4 weeks',
  },
  book_week_before: {
    urgency: 'book_week_before',
    flag: '🟢 BOOK 1 WEEK',
    description: 'Requires booking about 1 week in advance',
    leadTime: '1 week',
  },
  walk_in: {
    urgency: 'walk_in',
    flag: '✓ Walk-in OK',
    description: 'No reservation needed',
    leadTime: 'None',
  },
};

/**
 * Categories that typically require advance booking
 */
export const URGENCY_BY_CATEGORY: Record<string, ReservationUrgency> = {
  // Book Now (60+ days)
  'michelin_restaurant': 'book_now',
  'fine_dining': 'book_now',
  'popular_tour': 'book_now',
  'timed_entry': 'book_now',
  'special_experience': 'book_now',
  'celebrity_chef': 'book_now',
  'exclusive_access': 'book_now',
  
  // Book Soon (2-4 weeks)
  'popular_restaurant': 'book_soon',
  'cooking_class': 'book_soon',
  'day_trip': 'book_soon',
  'guided_tour': 'book_soon',
  'spa_treatment': 'book_soon',
  'show_tickets': 'book_soon',
  'wine_tasting': 'book_soon',
  
  // Book Week Before
  'restaurant': 'book_week_before',
  'boat_tour': 'book_week_before',
  'bike_rental': 'book_week_before',
  
  // Walk-in
  'cafe': 'walk_in',
  'park': 'walk_in',
  'neighborhood_walk': 'walk_in',
  'market': 'walk_in',
  'shopping': 'walk_in',
  'beach': 'walk_in',
  'street_food': 'walk_in',
};

/**
 * Keywords that indicate booking urgency
 */
export const URGENCY_KEYWORDS: Record<ReservationUrgency, string[]> = {
  book_now: [
    'michelin',
    'starred',
    'famous',
    'world-renowned',
    'bucket list',
    'wait list',
    'exclusive',
    'private tour',
    'vip',
    'skip-the-line',
  ],
  book_soon: [
    'popular',
    'cooking class',
    'wine tasting',
    'day trip',
    'guided tour',
    'group tour',
    'spa',
    'show',
    'theater',
    'concert',
  ],
  book_week_before: [
    'reservation recommended',
    'busy',
    'dinner',
    'boat',
  ],
  walk_in: [
    'casual',
    'street food',
    'market',
    'park',
    'walk',
    'stroll',
    'explore',
  ],
};

/**
 * Build prompt section for reservation urgency instructions
 */
export function buildReservationUrgencyPrompt(): string {
  return `
═══════════════════════════════════════════════════════════════════════════
RESERVATION URGENCY REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════

For EVERY activity and restaurant, indicate booking urgency:

🔴 BOOK NOW (60+ days):
   - Michelin-starred restaurants
   - Famous restaurants (Disfrutar, Central, etc.)
   - Popular timed-entry museums
   - Exclusive experiences
   - VIP/private tours

🟡 BOOK 2-4 WEEKS:
   - Popular restaurants
   - Cooking classes
   - Wine tastings
   - Guided tours
   - Spa treatments
   - Shows/theater

🟢 BOOK 1 WEEK:
   - Regular restaurants
   - Boat tours
   - Equipment rentals

✓ Walk-in OK:
   - Cafes
   - Parks
   - Markets
   - Street food
   - Shopping
   - Neighborhood walks

OUTPUT FORMAT FOR EACH ACTIVITY:
Include "reservationUrgency" field with one of:
- "book_now"
- "book_soon"
- "book_week_before"
- "walk_in"

If bookingUrl is known, include it. Otherwise suggest search terms.

═══════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Infer reservation urgency from activity name and category
 */
export function inferReservationUrgency(
  activityName: string,
  category?: string
): ReservationUrgency {
  const nameLower = activityName.toLowerCase();
  const categoryLower = category?.toLowerCase() || '';
  
  // Check category mapping first
  if (URGENCY_BY_CATEGORY[categoryLower]) {
    return URGENCY_BY_CATEGORY[categoryLower];
  }
  
  // Check keywords in name
  for (const [urgency, keywords] of Object.entries(URGENCY_KEYWORDS)) {
    if (keywords.some(kw => nameLower.includes(kw))) {
      return urgency as ReservationUrgency;
    }
  }
  
  // Default based on category type
  if (categoryLower.includes('dining') || categoryLower.includes('restaurant')) {
    return 'book_week_before';
  }
  
  if (categoryLower.includes('tour') || categoryLower.includes('activity')) {
    return 'book_soon';
  }
  
  return 'walk_in';
}

/**
 * Format urgency for display
 */
export function formatUrgencyFlag(urgency: ReservationUrgency): string {
  return RESERVATION_CONFIGS[urgency].flag;
}
