/**
 * Static fallback image mapping for itinerary activity cards.
 * Uses locally-stored images — zero external API dependency.
 * Keyword-rich: "tacos" → food, "spa" → wellness, "museum" → culture, etc.
 */

const FALLBACK_PLANE = '/images/fallbacks/fallback-plane.jpg';
const FALLBACK_CAR = '/images/fallbacks/fallback-car.jpg';
const FALLBACK_HOTEL = '/images/fallbacks/fallback-hotel.jpg';
const FALLBACK_EXPLORE = '/images/fallbacks/fallback-explore.jpg';
const FALLBACK_DESTINATION = '/images/fallbacks/fallback-destination.jpg';
const FALLBACK_FOOD = '/images/fallbacks/fallback-food.jpg';
const FALLBACK_NIGHTLIFE = '/images/fallbacks/fallback-nightlife.jpg';
const FALLBACK_WELLNESS = '/images/fallbacks/fallback-wellness.jpg';
const FALLBACK_CULTURE = '/images/fallbacks/fallback-culture.jpg';
const FALLBACK_SHOPPING = '/images/fallbacks/fallback-shopping.jpg';
const FALLBACK_NATURE = '/images/fallbacks/fallback-nature.jpg';
const FALLBACK_BEACH = '/images/fallbacks/fallback-beach.jpg';

/** Category types that map directly to an image */
const TYPE_MAP: Record<string, string> = {
  flight: FALLBACK_PLANE,
  arrival: FALLBACK_PLANE,
  departure: FALLBACK_PLANE,
  transport: FALLBACK_CAR,
  transportation: FALLBACK_CAR,
  transit: FALLBACK_CAR,
  transfer: FALLBACK_CAR,
  stay: FALLBACK_HOTEL,
  accommodation: FALLBACK_HOTEL,
  hotel: FALLBACK_HOTEL,
  'check-in': FALLBACK_HOTEL,
  'check-out': FALLBACK_HOTEL,
  checkin: FALLBACK_HOTEL,
  checkout: FALLBACK_HOTEL,
  food: FALLBACK_FOOD,
  dining: FALLBACK_FOOD,
  restaurant: FALLBACK_FOOD,
  meal: FALLBACK_FOOD,
  breakfast: FALLBACK_FOOD,
  lunch: FALLBACK_FOOD,
  dinner: FALLBACK_FOOD,
  nightlife: FALLBACK_NIGHTLIFE,
  bar: FALLBACK_NIGHTLIFE,
  club: FALLBACK_NIGHTLIFE,
  wellness: FALLBACK_WELLNESS,
  spa: FALLBACK_WELLNESS,
  relaxation: FALLBACK_WELLNESS,
  culture: FALLBACK_CULTURE,
  museum: FALLBACK_CULTURE,
  history: FALLBACK_CULTURE,
  shopping: FALLBACK_SHOPPING,
  market: FALLBACK_SHOPPING,
  nature: FALLBACK_NATURE,
  hiking: FALLBACK_NATURE,
  outdoors: FALLBACK_NATURE,
  adventure: FALLBACK_NATURE,
  beach: FALLBACK_BEACH,
  explore: FALLBACK_EXPLORE,
  walk: FALLBACK_EXPLORE,
  free_time: FALLBACK_EXPLORE,
  'free time': FALLBACK_EXPLORE,
  downtime: FALLBACK_EXPLORE,
  leisure: FALLBACK_EXPLORE,
};

/** Keywords found in activity names → fallback image */
const NAME_KEYWORDS: [string, string][] = [
  // Food & Dining
  ['restaurant', FALLBACK_FOOD],
  ['café', FALLBACK_FOOD],
  ['cafe', FALLBACK_FOOD],
  ['bistro', FALLBACK_FOOD],
  ['diner', FALLBACK_FOOD],
  ['eatery', FALLBACK_FOOD],
  ['food hall', FALLBACK_FOOD],
  ['food tour', FALLBACK_FOOD],
  ['food market', FALLBACK_FOOD],
  ['street food', FALLBACK_FOOD],
  ['brunch', FALLBACK_FOOD],
  ['breakfast', FALLBACK_FOOD],
  ['lunch', FALLBACK_FOOD],
  ['dinner', FALLBACK_FOOD],
  ['supper', FALLBACK_FOOD],
  ['tacos', FALLBACK_FOOD],
  ['taco', FALLBACK_FOOD],
  ['pizza', FALLBACK_FOOD],
  ['sushi', FALLBACK_FOOD],
  ['ramen', FALLBACK_FOOD],
  ['noodle', FALLBACK_FOOD],
  ['burger', FALLBACK_FOOD],
  ['steak', FALLBACK_FOOD],
  ['seafood', FALLBACK_FOOD],
  ['bbq', FALLBACK_FOOD],
  ['barbecue', FALLBACK_FOOD],
  ['bakery', FALLBACK_FOOD],
  ['pastry', FALLBACK_FOOD],
  ['gelato', FALLBACK_FOOD],
  ['ice cream', FALLBACK_FOOD],
  ['coffee', FALLBACK_FOOD],
  ['tea house', FALLBACK_FOOD],
  ['dim sum', FALLBACK_FOOD],
  ['tapas', FALLBACK_FOOD],
  ['curry', FALLBACK_FOOD],
  ['pho', FALLBACK_FOOD],
  ['paella', FALLBACK_FOOD],
  ['ceviche', FALLBACK_FOOD],
  ['cooking class', FALLBACK_FOOD],
  ['wine tasting', FALLBACK_FOOD],
  ['winery', FALLBACK_FOOD],
  ['vineyard', FALLBACK_FOOD],
  ['brewery', FALLBACK_FOOD],
  ['distillery', FALLBACK_FOOD],
  ['trattoria', FALLBACK_FOOD],
  ['osteria', FALLBACK_FOOD],
  ['izakaya', FALLBACK_FOOD],
  ['cantina', FALLBACK_FOOD],
  ['gastropub', FALLBACK_FOOD],

  // Nightlife
  ['bar', FALLBACK_NIGHTLIFE],
  ['cocktail', FALLBACK_NIGHTLIFE],
  ['pub', FALLBACK_NIGHTLIFE],
  ['club', FALLBACK_NIGHTLIFE],
  ['nightclub', FALLBACK_NIGHTLIFE],
  ['lounge', FALLBACK_NIGHTLIFE],
  ['rooftop bar', FALLBACK_NIGHTLIFE],
  ['speakeasy', FALLBACK_NIGHTLIFE],
  ['karaoke', FALLBACK_NIGHTLIFE],
  ['live music', FALLBACK_NIGHTLIFE],
  ['jazz', FALLBACK_NIGHTLIFE],
  ['concert', FALLBACK_NIGHTLIFE],

  // Wellness
  ['spa', FALLBACK_WELLNESS],
  ['massage', FALLBACK_WELLNESS],
  ['yoga', FALLBACK_WELLNESS],
  ['meditation', FALLBACK_WELLNESS],
  ['onsen', FALLBACK_WELLNESS],
  ['hot spring', FALLBACK_WELLNESS],
  ['thermal bath', FALLBACK_WELLNESS],
  ['hammam', FALLBACK_WELLNESS],
  ['sauna', FALLBACK_WELLNESS],
  ['retreat', FALLBACK_WELLNESS],

  // Culture & History
  ['museum', FALLBACK_CULTURE],
  ['gallery', FALLBACK_CULTURE],
  ['temple', FALLBACK_CULTURE],
  ['shrine', FALLBACK_CULTURE],
  ['church', FALLBACK_CULTURE],
  ['cathedral', FALLBACK_CULTURE],
  ['mosque', FALLBACK_CULTURE],
  ['palace', FALLBACK_CULTURE],
  ['castle', FALLBACK_CULTURE],
  ['ruins', FALLBACK_CULTURE],
  ['monument', FALLBACK_CULTURE],
  ['historic', FALLBACK_CULTURE],
  ['heritage', FALLBACK_CULTURE],
  ['theater', FALLBACK_CULTURE],
  ['theatre', FALLBACK_CULTURE],
  ['opera', FALLBACK_CULTURE],
  ['art exhibit', FALLBACK_CULTURE],
  ['cultural', FALLBACK_CULTURE],
  ['basilica', FALLBACK_CULTURE],
  ['colosseum', FALLBACK_CULTURE],
  ['acropolis', FALLBACK_CULTURE],
  ['pagoda', FALLBACK_CULTURE],
  ['library', FALLBACK_CULTURE],

  // Shopping
  ['shopping', FALLBACK_SHOPPING],
  ['market', FALLBACK_SHOPPING],
  ['bazaar', FALLBACK_SHOPPING],
  ['souk', FALLBACK_SHOPPING],
  ['boutique', FALLBACK_SHOPPING],
  ['mall', FALLBACK_SHOPPING],
  ['souvenir', FALLBACK_SHOPPING],
  ['flea market', FALLBACK_SHOPPING],

  // Nature & Adventure
  ['hike', FALLBACK_NATURE],
  ['hiking', FALLBACK_NATURE],
  ['trek', FALLBACK_NATURE],
  ['trekking', FALLBACK_NATURE],
  ['trail', FALLBACK_NATURE],
  ['mountain', FALLBACK_NATURE],
  ['volcano', FALLBACK_NATURE],
  ['waterfall', FALLBACK_NATURE],
  ['canyon', FALLBACK_NATURE],
  ['forest', FALLBACK_NATURE],
  ['jungle', FALLBACK_NATURE],
  ['rainforest', FALLBACK_NATURE],
  ['national park', FALLBACK_NATURE],
  ['safari', FALLBACK_NATURE],
  ['wildlife', FALLBACK_NATURE],
  ['garden', FALLBACK_NATURE],
  ['botanical', FALLBACK_NATURE],
  ['kayak', FALLBACK_NATURE],
  ['canoe', FALLBACK_NATURE],
  ['rafting', FALLBACK_NATURE],
  ['zip line', FALLBACK_NATURE],
  ['zipline', FALLBACK_NATURE],
  ['rock climbing', FALLBACK_NATURE],
  ['cycling', FALLBACK_NATURE],
  ['bike tour', FALLBACK_NATURE],
  ['scuba', FALLBACK_NATURE],
  ['snorkel', FALLBACK_NATURE],
  ['diving', FALLBACK_NATURE],
  ['whale watch', FALLBACK_NATURE],
  ['bird watch', FALLBACK_NATURE],

  // Beach
  ['beach', FALLBACK_BEACH],
  ['snorkeling', FALLBACK_BEACH],
  ['surf', FALLBACK_BEACH],
  ['surfing', FALLBACK_BEACH],
  ['coast', FALLBACK_BEACH],
  ['seaside', FALLBACK_BEACH],
  ['ocean', FALLBACK_BEACH],
  ['island', FALLBACK_BEACH],
  ['lagoon', FALLBACK_BEACH],
  ['cove', FALLBACK_BEACH],

  // Flight / Airport
  ['flight', FALLBACK_PLANE],
  ['airport', FALLBACK_PLANE],
  ['fly', FALLBACK_PLANE],
  ['landing', FALLBACK_PLANE],
  ['takeoff', FALLBACK_PLANE],

  // Transport
  ['transfer', FALLBACK_CAR],
  ['rideshare', FALLBACK_CAR],
  ['taxi', FALLBACK_CAR],
  ['uber', FALLBACK_CAR],
  ['lyft', FALLBACK_CAR],
  ['drive', FALLBACK_CAR],
  ['car service', FALLBACK_CAR],
  ['getting to', FALLBACK_CAR],
  ['train', FALLBACK_CAR],
  ['ferry', FALLBACK_CAR],
  ['bus', FALLBACK_CAR],

  // Hotel / Accommodation
  ['check in', FALLBACK_HOTEL],
  ['check out', FALLBACK_HOTEL],
  ['check-in', FALLBACK_HOTEL],
  ['check-out', FALLBACK_HOTEL],
  ['hotel', FALLBACK_HOTEL],
  ['resort', FALLBACK_HOTEL],
  ['settle in', FALLBACK_HOTEL],
  ['airbnb', FALLBACK_HOTEL],
  ['hostel', FALLBACK_HOTEL],
  ['villa', FALLBACK_HOTEL],

  // Explore / Walk
  ['stroll', FALLBACK_EXPLORE],
  ['wander', FALLBACK_EXPLORE],
  ['explore', FALLBACK_EXPLORE],
  ['free time', FALLBACK_EXPLORE],
  ['at leisure', FALLBACK_EXPLORE],
  ['walk around', FALLBACK_EXPLORE],
  ['sightseeing', FALLBACK_EXPLORE],
  ['city tour', FALLBACK_EXPLORE],
  ['walking tour', FALLBACK_EXPLORE],
  ['neighborhood', FALLBACK_EXPLORE],
];

/**
 * Returns a static fallback image URL based on the activity's type and name.
 * Deterministic — same inputs always produce the same image.
 */
export function getActivityFallbackImage(
  activityType?: string,
  activityName?: string
): string {
  const type = (activityType || '').toLowerCase().trim();
  const name = (activityName || '').toLowerCase().trim();

  // 1. Direct type match
  if (type && TYPE_MAP[type]) {
    return TYPE_MAP[type];
  }

  // 2. Keyword scan on activity name
  for (const [keyword, image] of NAME_KEYWORDS) {
    if (name.includes(keyword)) {
      return image;
    }
  }

  // 3. Default
  return FALLBACK_DESTINATION;
}
