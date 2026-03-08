import nolaHero1 from '@/assets/destinations/new-orleans-1.jpg';
import nolaHero2 from '@/assets/destinations/new-orleans-2.jpg';
import nolaHero3 from '@/assets/destinations/new-orleans-3.jpg';
import { DESTINATION_STORAGE_IMAGES } from '@/data/destinationStorageImages';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

// Helper to get storage images with normalized fallbacks
function si(slug: string, fallbackUrl: string, fallbackImages: string[]): { imageUrl: string; images: string[] } {
  const stored = DESTINATION_STORAGE_IMAGES[slug];
  if (stored) {
    return {
      imageUrl: normalizeUnsplashUrl(stored.imageUrl),
      images: stored.images.map((image) => normalizeUnsplashUrl(image)),
    };
  }

  return {
    imageUrl: normalizeUnsplashUrl(fallbackUrl),
    images: fallbackImages.map((image) => normalizeUnsplashUrl(image)),
  };
}

export interface Destination {
  id: string;
  city: string;
  country: string;
  region: string;
  tagline: string;
  description: string;
  timezone: string;
  currency: string;
  imageUrl: string;
  images: string[];
  climate?: string;
  localTips?: string[];
  gettingAround?: string;
  bestMonths?: string[];
  transportData?: Array<{
    mode: string;
    recommended: boolean;
    notes: string;
    appName?: string;
    estimatedCost?: string;
  }>;
  safetyTips?: string[];
  commonScams?: string[];
  foodScene?: string;
  tippingCustom?: string;
  dressCode?: string;
  nightlifeInfo?: string;
  bestNeighborhoods?: string[];
  emergencyNumbers?: { police: string; ambulance: string; tourist: string };
}

export interface Activity {
  id: string;
  destinationId: string;
  title: string;
  category: 'culture' | 'food' | 'nature' | 'adventure' | 'wellness' | 'nightlife';
  description: string;
  priceTier: 'budget' | 'moderate' | 'premium' | 'luxury';
  neighborhood?: string;
  duration?: string;
  bestTime?: string;
}

export const destinations: Destination[] = [
  {
    id: 'paris',
    city: 'Paris',
    country: 'France',
    region: 'Europe',
    tagline: 'The city of lights and eternal romance',
    description: 'A city that invented the art of living well. Paris offers world-class museums, café culture perfected over centuries, Michelin-starred bistros alongside perfect croissants, and neighborhoods that reward endless exploration.',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    ...si('paris', 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80', [
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
      'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200&q=80',
      'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=1200&q=80',
    ]),
    climate: 'Oceanic climate with mild winters and warm summers. Rain is possible year-round.',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct'],
    gettingAround: 'Excellent metro system reaches most attractions. Walking is the best way to experience neighborhoods.',
    localTips: [
      'Greet shopkeepers with "Bonjour" before asking questions',
      'Avoid restaurants on major tourist plazas',
      'Museums are less crowded on Wednesday and Friday evenings',
      'Book Eiffel Tower tickets online weeks in advance',
    ],
  },
  {
    id: 'santorini',
    city: 'Santorini',
    country: 'Greece',
    region: 'Europe',
    tagline: 'Whitewashed dreams above the Aegean',
    description: 'A volcanic island that defines Mediterranean beauty. Santorini offers sunset views that stop conversation, cliffside villages, ancient ruins, and wine from vines rooted in volcanic soil.',
    timezone: 'Europe/Athens',
    currency: 'EUR',
    ...si('santorini', 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1200&q=80', [
      'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1200&q=80',
      'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&q=80',
      'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&q=80',
    ]),
    climate: 'Mediterranean climate with hot, dry summers and mild winters. Very little rain May-September.',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct'],
    gettingAround: 'Rent an ATV or car. Public buses run between villages but are infrequent. Walking between Fira and Oia takes 3 hours.',
    localTips: [
      'Book Oia sunset dinner reservations weeks in advance',
      'Visit wineries in the afternoon. The volcanic soil produces unique wines',
      'Swim at Red Beach or Perissa for fewer crowds than Kamari',
      'Shoulder season has best weather and smaller crowds',
    ],
  },
  {
    id: 'bali',
    city: 'Bali',
    country: 'Indonesia',
    region: 'Asia',
    tagline: 'Island of gods and endless discovery',
    description: 'An island where spirituality infuses daily life. Bali offers temple ceremonies at sunrise, rice terraces that define green, surf beaches, wellness retreats, and a warmth that extends beyond the tropical climate.',
    timezone: 'Asia/Makassar',
    currency: 'IDR',
    ...si('bali', 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80', [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80',
      'https://images.unsplash.com/photo-1573790387438-4da905039392?w=1200&q=80',
      'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=1200&q=80',
    ]),
    climate: 'Tropical with wet (Nov-Mar) and dry (Apr-Oct) seasons. Expect humidity year-round.',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep'],
    gettingAround: 'Hire a driver for day trips. Very affordable. Scooters are common but traffic is chaotic. Grab app works for rides.',
    localTips: [
      'Dress respectfully at temples. Sarongs required (often provided)',
      'Ubud offers culture; Seminyak has beaches and nightlife',
      'Haggling is expected at markets. Start at 40% of asking price',
      'Sunrise at Mount Batur is worth the early wake-up',
    ],
  },
  {
    id: 'new-york',
    city: 'New York',
    country: 'United States',
    region: 'North America',
    tagline: 'The city that never sleeps',
    description: 'A city of neighborhoods, each a world unto itself. New York offers Broadway brilliance, art museums that require multiple visits, food from every corner of the globe, and an energy that charges through every block.',
    timezone: 'America/New_York',
    currency: 'USD',
    ...si('new-york', 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&q=80', [
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&q=80',
      'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200&q=80',
      'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=1200&q=80',
    ]),
    climate: 'Humid continental with cold winters and hot, humid summers. All four seasons are distinct.',
    bestMonths: ['Apr', 'May', 'Sep', 'Oct', 'Dec'],
    gettingAround: 'Subway is fast and runs 24/7. Walking is the best way to experience neighborhoods. Avoid taxis in rush hour.',
    localTips: [
      'Book Broadway tickets through TKTS booth for same-day discounts',
      'Skip Times Square. Locals avoid it',
      'Explore neighborhoods: West Village, Williamsburg, Harlem each have distinct character',
      'Pizza by the slice is a cultural experience. Fold it and eat while walking',
    ],
  },
  {
    id: 'kyoto',
    city: 'Kyoto',
    country: 'Japan',
    region: 'Asia',
    tagline: 'Ancient temples meet seasonal perfection',
    description: 'A city where centuries-old traditions flow seamlessly into modern life. Kyoto offers meditative temple gardens, refined kaiseki dining, and neighborhoods that reveal their character only to those who wander slowly.',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    ...si('kyoto', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80', [
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
      'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200&q=80',
      'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?w=1200&q=80',
    ]),
    climate: 'Humid subtropical with hot summers and cool winters. Cherry blossoms in spring, vibrant colors in autumn.',
    bestMonths: ['Mar', 'Apr', 'May', 'Oct', 'Nov'],
    gettingAround: 'Buses and trains reach most temples. Rent a bicycle for Arashiyama and Philosopher\'s Path areas.',
    localTips: [
      'Visit temples at opening time (7-8am) to avoid crowds',
      'Reserve kaiseki dinners and tea ceremonies in advance',
      'Bow when entering temples and remove shoes where indicated',
      'Cherry blossom dates vary. Check forecasts before booking',
    ],
  },
  {
    id: 'lisbon',
    city: 'Lisbon',
    country: 'Portugal',
    region: 'Europe',
    tagline: 'Golden light, ocean breezes, and timeless charm',
    description: 'A city of seven hills where pastel facades catch the afternoon light. Lisbon rewards the curious with hidden miradouros, neighborhood tascas, and a rhythm that moves between fado melancholy and Atlantic optimism.',
    timezone: 'Europe/Lisbon',
    currency: 'EUR',
    ...si('lisbon', 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&q=80', [
      'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&q=80',
      'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
    ]),
    climate: 'Mediterranean climate with warm, dry summers and mild, rainy winters. Temperature ranges from 10°C to 28°C.',
    bestMonths: ['Mar', 'Apr', 'May', 'Sep', 'Oct'],
    gettingAround: 'Metro covers main areas efficiently. Historic Tram 28 is iconic but crowded. Walking the hills is rewarding but steep.',
    localTips: [
      'Try a pastel de nata at Manteigaria or Pastéis de Belém',
      'Book fado shows in Alfama for the authentic experience',
      'Avoid tourist-trap restaurants near Rossio Square',
      'Miradouros (viewpoints) offer free sunset entertainment',
    ],
  },
  {
    id: 'cape-town',
    city: 'Cape Town',
    country: 'South Africa',
    region: 'Africa',
    tagline: 'Where mountain meets ocean at the edge of continents',
    description: 'Dramatic geography defines every view. Cape Town offers world-class wine estates within an hour, beaches that change character by the mile, and a culinary scene that draws on the whole continent.',
    timezone: 'Africa/Johannesburg',
    currency: 'ZAR',
    ...si('cape-town', 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200&q=80', [
      'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200&q=80',
      'https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?w=1200&q=80',
      'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&q=80',
    ]),
    climate: 'Mediterranean climate with warm, dry summers (Dec-Feb) and cool, wet winters. Notorious "Cape Doctor" wind in summer.',
    bestMonths: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
    gettingAround: 'Rent a car for peninsula and winelands day trips. MyCiti buses serve main routes. Uber is reliable and affordable.',
    localTips: [
      'Check Table Mountain cable car status before heading up. It closes in high winds',
      'Visit the winelands on weekdays to avoid crowds',
      'The Atlantic side has cold water; False Bay side is warmer for swimming',
      'Bo-Kaap is best explored with a local guide for cultural context',
    ],
  },
  {
    id: 'mexico-city',
    city: 'Mexico City',
    country: 'Mexico',
    region: 'North America',
    tagline: 'A megalopolis with neighborhood soul',
    description: 'Layer upon layer of history, art, and flavor. Mexico City surprises with world-class museums, markets that demand multiple visits, and a dining scene that ranges from street-side tacos to destinations worth planning trips around.',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    ...si('mexico-city', 'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1200&q=80', [
      'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1200&q=80',
      'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200&q=80',
      'https://images.unsplash.com/photo-1547995886-6dc09384c6e6?w=1200&q=80',
    ]),
    climate: 'Subtropical highland with mild temperatures year-round. Rainy season (Jun-Sep) brings afternoon showers.',
    bestMonths: ['Mar', 'Apr', 'May', 'Nov'],
    gettingAround: 'Metro is extensive and cheap but crowded. Uber/DiDi are safe and affordable. Walking works in Roma/Condesa.',
    localTips: [
      'Eat tacos where you see locals lining up, not empty tourist spots',
      'Book Teotihuacán early morning to beat heat and crowds',
      'Museo Nacional de Antropología needs at least half a day',
      'Sundays Paseo de la Reforma is closed to cars, great for cycling',
    ],
  },
  {
    id: 'copenhagen',
    city: 'Copenhagen',
    country: 'Denmark',
    region: 'Europe',
    tagline: 'Nordic design thinking applied to daily life',
    description: 'A city that has thought carefully about how to live well. Copenhagen offers cycling culture, waterfront swimming, smørrebrød traditions, and a new Nordic cuisine movement that changed how the world thinks about restaurants.',
    timezone: 'Europe/Copenhagen',
    currency: 'DKK',
    ...si('copenhagen', 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1200&q=80', [
      'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1200&q=80',
      'https://images.unsplash.com/photo-1552560880-2482cef14240?w=1200&q=80',
      'https://images.unsplash.com/photo-1551516594-56cb78394645?w=1200&q=80',
    ]),
    climate: 'Oceanic climate with cold winters and mild summers. Temperature ranges from -1°C to 22°C. Long summer days, short winter ones.',
    bestMonths: ['May', 'Jun', 'Jul', 'Aug', 'Sep'],
    gettingAround: 'Cycling is king. Rent a bike. Metro and S-train cover outer areas. Walking is pleasant in the compact center.',
    localTips: [
      'Book top restaurants like Noma months in advance',
      'Tivoli is magical at night. Visit after dark',
      'Harbor swimming at Islands Brygge is free and popular',
      'Embrace "hygge": linger in cafés with pastries and coffee',
    ],
  },
  {
    id: 'cartagena',
    city: 'Cartagena',
    country: 'Colombia',
    region: 'South America',
    tagline: 'Caribbean colors behind fortress walls',
    description: 'A walled city where colonial architecture meets Caribbean energy. Cartagena offers rooftop evenings, seafood ceviche, salsa rhythms, and nearby islands that feel genuinely remote.',
    timezone: 'America/Bogota',
    currency: 'COP',
    ...si('cartagena', 'https://images.unsplash.com/photo-1583997052103-b4a1cb974ce5?w=1200&q=80', [
      'https://images.unsplash.com/photo-1583997052103-b4a1cb974ce5?w=1200&q=80',
      'https://images.unsplash.com/photo-1569012871812-f38ee64cd54c?w=1200&q=80',
      'https://images.unsplash.com/photo-1547149600-a6cdf8fce60c?w=1200&q=80',
    ]),
    climate: 'Tropical with consistent heat and humidity year-round. Temperature around 28-32°C. Short rainy seasons Oct-Nov.',
    bestMonths: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
    gettingAround: 'Walk within the walled city. Taxis are cheap, but agree on price before. Boats to Rosario Islands from the port.',
    localTips: [
      'Negotiate prices at markets and with street vendors',
      'Getsemaní neighborhood has better food than the touristy Old Town',
      'Stay hydrated. The Caribbean heat is intense',
      'Take a day trip to Playa Blanca or Rosario Islands for beaches',
    ],
  },
  {
    id: 'marrakech',
    city: 'Marrakech',
    country: 'Morocco',
    region: 'Africa',
    tagline: 'Sensory immersion in the Red City',
    description: 'A city that engages all senses simultaneously. Marrakech offers medina mazes, riad retreats, Atlas Mountain views, and a craft tradition that turns shopping into cultural exploration.',
    timezone: 'Africa/Casablanca',
    currency: 'MAD',
    imageUrl: 'https://images.unsplash.com/photo-1518730518541-d0843268c287?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1518730518541-d0843268c287?w=1200&q=80',
      'https://images.unsplash.com/photo-1489493512598-d08130f49bea?w=1200&q=80',
      'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1200&q=80',
    ],
    climate: 'Semi-arid with hot, dry summers and mild winters. Temperature ranges from 8°C to 38°C. Very hot Jun-Aug.',
    bestMonths: ['Mar', 'Apr', 'May', 'Oct', 'Nov'],
    gettingAround: 'Walking in the medina is the only option, and part of the experience. Taxis to new town and gardens.',
    localTips: [
      'Haggling is expected. Start at 30-40% of the asking price',
      'Stay in a traditional riad for the authentic experience',
      'Visit Jemaa el-Fnaa square at sunset when it transforms',
      'Hire a local guide for your first medina exploration',
    ],
  },
  {
    id: 'vancouver',
    city: 'Vancouver',
    country: 'Canada',
    region: 'North America',
    tagline: 'Pacific wilderness at the city edge',
    description: 'Mountains visible from downtown streets. Vancouver offers morning hikes that end at craft breweries, Asian fusion that reflects the Pacific Rim, and a relationship with nature that shapes daily life.',
    timezone: 'America/Vancouver',
    currency: 'CAD',
    ...si('vancouver', 'https://images.unsplash.com/photo-1609825488888-3a766db05542?w=1200&q=80', [
      'https://images.unsplash.com/photo-1609825488888-3a766db05542?w=1200&q=80',
      'https://images.unsplash.com/photo-1578469550956-0e16b69c6a3d?w=1200&q=80',
      'https://images.unsplash.com/photo-1560814304-4f05976ef22e?w=1200&q=80',
    ]),
    climate: 'Oceanic climate with mild, wet winters and warm, dry summers. Rain is common Oct-Apr.',
    bestMonths: ['Jun', 'Jul', 'Aug', 'Sep'],
    gettingAround: 'SkyTrain connects airport and main areas. SeaBus to North Van is scenic. Rent a car for mountain and island trips.',
    localTips: [
      'Granville Island Market is best on weekday mornings',
      'Take the Sea-to-Sky Highway to Whistler for a stunning drive',
      'Richmond has the best Chinese food outside of Asia',
      'Stanley Park is best explored by bike on the seawall',
    ],
  },
  {
    id: 'bangkok',
    city: 'Bangkok',
    country: 'Thailand',
    region: 'Asia',
    tagline: 'Sacred temples and street-food mastery',
    description: 'A city of contrasts that somehow harmonize. Bangkok offers temple complexes that demand silence, markets that demand haggling, and a street food culture that has produced some of the world\'s most celebrated flavors.',
    timezone: 'Asia/Bangkok',
    currency: 'THB',
    ...si('bangkok', 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&q=80', [
      'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&q=80',
      'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
    ]),
    climate: 'Tropical monsoon with hot, humid weather year-round. Temperature 26-35°C. Heavy rain Jun-Oct.',
    bestMonths: ['Nov', 'Dec', 'Jan', 'Feb'],
    gettingAround: 'BTS Skytrain and MRT cover main areas. Grab app for taxis. River boats and tuk-tuks for short trips.',
    localTips: [
      'Visit Grand Palace and Wat Pho early morning to avoid heat and crowds',
      'Street food is safe. Look for busy stalls with high turnover',
      'Dress modestly for temples: cover shoulders and knees',
      'Chatuchak Weekend Market is massive. Arrive early and hydrate',
    ],
  },
  {
    id: 'buenos-aires',
    city: 'Buenos Aires',
    country: 'Argentina',
    region: 'South America',
    tagline: 'European elegance with Latin passion',
    description: 'A city that stays up late and rewards those who do the same. Buenos Aires offers tango milongas, steakhouse traditions, bookstore wandering, and neighborhoods that each feel like their own small city.',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS',
    ...si('buenos-aires', 'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1200&q=80', [
      'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1200&q=80',
      'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1200&q=80',
      'https://images.unsplash.com/photo-1536086845234-586b4f845fa8?w=1200&q=80',
    ]),
    climate: 'Humid subtropical with hot summers and mild winters. Temperature ranges 8-30°C. No real rainy season.',
    bestMonths: ['Mar', 'Apr', 'May', 'Sep', 'Oct', 'Nov'],
    gettingAround: 'Subte (metro) is efficient and cheap. Walking is ideal for Palermo and Recoleta. Taxis are affordable.',
    localTips: [
      'Dinner starts at 9-10pm. Arrive earlier and you\'ll eat alone',
      'Tango shows are touristy; milongas offer authentic dancing',
      'Bring USD cash. Official and parallel exchange rates differ significantly',
      'El Ateneo Grand Splendid bookstore is worth a visit even if you don\'t read Spanish',
    ],
  },
  {
    id: 'reykjavik',
    city: 'Reykjavík',
    country: 'Iceland',
    region: 'Europe',
    tagline: 'Gateway to otherworldly landscapes',
    description: 'The world\'s most northern capital anchors access to geological drama. Reykjavík offers hot spring culture, creative dining, and day trips to waterfalls, glaciers, and volcanic terrain that looks borrowed from another planet.',
    timezone: 'Atlantic/Reykjavik',
    currency: 'ISK',
    ...si('reykjavik', 'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?w=1200&q=80', [
      'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?w=1200&q=80',
      'https://images.unsplash.com/photo-1504233529578-6d46baba6d34?w=1200&q=80',
      'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=1200&q=80',
    ]),
    climate: 'Subpolar oceanic, milder than expected but highly changeable. Temperature 0-13°C. Prepare for all weather in one day.',
    bestMonths: ['Jun', 'Jul', 'Aug'],
    gettingAround: 'Rent a car for Golden Circle and beyond. City is walkable. Limited public transit outside Reykjavík.',
    localTips: [
      'Book Blue Lagoon weeks in advance. It fills up',
      'Northern Lights visible Sep-Mar on clear nights',
      'Layer clothing. Weather changes rapidly',
      'Iceland is expensive. Budget for high food and activity costs',
    ],
  },
  {
    id: 'singapore',
    city: 'Singapore',
    country: 'Singapore',
    region: 'Asia',
    tagline: 'Precision meets multicultural abundance',
    description: 'A city-state that has turned efficiency into an art form. Singapore offers hawker centers with century-old recipes, gardens that blur the line between nature and architecture, and neighborhoods that preserve distinct cultural identities.',
    timezone: 'Asia/Singapore',
    currency: 'SGD',
    ...si('singapore', 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80', [
      'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80',
      'https://images.unsplash.com/photo-1496939376851-89342e90adcd?w=1200&q=80',
      'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=1200&q=80',
    ]),
    climate: 'Tropical rainforest, hot and humid year-round. Temperature 24-32°C. Brief afternoon showers common.',
    bestMonths: ['Feb', 'Mar', 'Apr'],
    gettingAround: 'MRT is spotless, cheap, and extensive. Walking works in city center. Grab for taxis.',
    localTips: [
      'Hawker centers are where locals eat. Michelin-starred stalls cost under $5',
      'Gardens by the Bay is magical at night during the light show',
      'Chewing gum is technically illegal. Leave it at home',
      'Visit Little India, Chinatown, and Arab Street for cultural variety',
    ],
  },
  {
    id: 'florence',
    city: 'Florence',
    country: 'Italy',
    region: 'Europe',
    tagline: 'Renaissance mastery preserved in amber',
    description: 'A city where the art density per square meter has no equal. Florence offers gallery mornings, trattoria lunches, Tuscan hill views, and a craft leather tradition that survives alongside the masterpieces.',
    timezone: 'Europe/Rome',
    currency: 'EUR',
    imageUrl: 'https://images.unsplash.com/photo-1541370976299-4d24ebbc9077?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1541370976299-4d24ebbc9077?w=1200&q=80',
      'https://images.unsplash.com/photo-1504019347908-b45f9b0b8dd5?w=1200&q=80',
      'https://images.unsplash.com/photo-1534359265607-b39e67e08544?w=1200&q=80',
    ],
    climate: 'Mediterranean with hot summers and cool, wet winters. Temperature 3-31°C. July-August can be scorching.',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct'],
    gettingAround: 'Centro storico is entirely walkable. Buses for Piazzale Michelangelo. Train for Tuscan day trips.',
    localTips: [
      'Book Uffizi and Accademia tickets in advance. Always',
      'Avoid restaurants near the Duomo. Walk a few blocks for better food',
      'Mercato Centrale upstairs has excellent local dishes',
      'Piazzale Michelangelo at sunset is worth the walk',
    ],
  },
  {
    id: 'oaxaca',
    city: 'Oaxaca',
    country: 'Mexico',
    region: 'North America',
    tagline: 'Indigenous traditions and mezcal wisdom',
    description: 'A city that has preserved what others have paved over. Oaxaca offers mole complexity, mezcal distillery visits, textile cooperatives, and Monte Albán ruins that predate European arrival by millennia.',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    imageUrl: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1200&q=80',
      'https://images.unsplash.com/photo-1547558840-8ad6c4dc309c?w=1200&q=80',
      'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=1200&q=80',
    ],
    climate: 'Semi-arid highland with mild temperatures year-round. Temperature 10-28°C. Rainy season Jun-Sep.',
    bestMonths: ['Oct', 'Nov', 'Dec', 'Mar', 'Apr'],
    gettingAround: 'Centro is entirely walkable. Collectivos (shared vans) for nearby villages. Taxis are cheap.',
    localTips: [
      'Visit a mezcal palenque. Tastings are free and educational',
      'Monte Albán is best early morning before heat and crowds',
      'Each mole has dozens of ingredients. Try negro, rojo, and amarillo',
      'Day of the Dead (late Oct/early Nov) is magical but book months ahead',
    ],
  },
  {
    id: 'seoul',
    city: 'Seoul',
    country: 'South Korea',
    region: 'Asia',
    tagline: 'Ancient palaces amid digital velocity',
    description: 'A city that moves fast but preserves deeply. Seoul offers palace grounds for morning walks, neighborhood markets for afternoon grazing, and a nightlife that extends until the first subway of tomorrow.',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    imageUrl: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200&q=80',
      'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200&q=80',
      'https://images.unsplash.com/photo-1546874177-9e664107314e?w=1200&q=80',
    ],
    climate: 'Humid continental with cold winters and hot, humid summers. Temperature -5 to 30°C. Monsoon rains Jul-Aug.',
    bestMonths: ['Apr', 'May', 'Sep', 'Oct'],
    gettingAround: 'Metro is world-class, cheap, and signposted in English. T-money card works everywhere. Walking friendly.',
    localTips: [
      'Free hanbok (traditional dress) rental at palaces gets you free entry',
      'Korean BBQ is a communal experience. Go with groups',
      'Jjimjilbangs (bathhouses) are a cultural experience worth trying',
      'Hongdae for nightlife, Insadong for tradition, Gangnam for modernity',
    ],
  },
  {
    id: 'vienna',
    city: 'Vienna',
    country: 'Austria',
    region: 'Europe',
    tagline: 'Imperial grandeur softened by coffeehouse culture',
    description: 'A city that perfected the art of the lingering afternoon. Vienna offers opera evenings, schnitzel lunches, coffee and cake rituals, and museums that house empires\' worth of accumulated beauty.',
    timezone: 'Europe/Vienna',
    currency: 'EUR',
    imageUrl: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1200&q=80',
      'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200&q=80',
      'https://images.unsplash.com/photo-1573599852326-2d4da0aea6c8?w=1200&q=80',
    ],
    climate: 'Continental with cold winters and warm summers. Temperature -1 to 26°C. Snow possible Dec-Feb.',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct'],
    gettingAround: 'U-Bahn and trams cover the city excellently. Walking in the Ringstrasse area is ideal. Vienna City Card offers savings.',
    localTips: [
      'Standing room opera tickets are cheap and available day-of',
      'Kaffeehäuser (coffeehouses) expect you to linger. It\'s tradition',
      'Naschmarkt is best for Saturday brunch browsing',
      'Heurigen (wine taverns) in the outskirts offer local wines and atmosphere',
    ],
  },
  {
    id: 'hanoi',
    city: 'Hanoi',
    country: 'Vietnam',
    region: 'Asia',
    tagline: 'French colonial bones, Vietnamese soul',
    description: 'A city where morning tai chi in the park coexists with motorbike chaos. Hanoi offers phở traditions, Old Quarter exploration, lakes for evening strolls, and a pace that feels both urgent and timeless.',
    timezone: 'Asia/Ho_Chi_Minh',
    currency: 'VND',
    imageUrl: 'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=1200&q=80',
      'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&q=80',
      'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200&q=80',
    ],
    climate: 'Humid subtropical with hot summers and cool winters. Temperature 15-35°C. Drizzly Feb-Apr.',
    bestMonths: ['Oct', 'Nov', 'Mar', 'Apr'],
    gettingAround: 'Walking in Old Quarter. Grab app for taxis. Crossing streets requires confidence. Walk slowly and steadily.',
    localTips: [
      'Phở is a breakfast food. The best bowls are served before 9am',
      'Egg coffee at Giang Café is a must-try Hanoi original',
      'Old Quarter streets are named after the goods once sold there',
      'Train Street is Instagram-famous but respect that people live there',
    ],
  },
  {
    id: 'barcelona',
    city: 'Barcelona',
    country: 'Spain',
    region: 'Europe',
    tagline: 'Gaudí curves, Mediterranean rhythm',
    description: 'A city that takes architecture personally. Barcelona offers Modernisme buildings that seem alive, beaches within metro reach, late dinners that start at 10pm, and a Catalan identity that flavors everything.',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    imageUrl: 'https://images.unsplash.com/photo-1583422409516-2895a77efed6?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1583422409516-2895a77efed6?w=1200&q=80',
      'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200&q=80',
      'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=1200&q=80',
    ],
    climate: 'Mediterranean with hot summers and mild winters. Temperature 9-28°C. Humidity can be high in summer.',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct'],
    gettingAround: 'Metro covers most areas. Walking is ideal in Gothic Quarter and Eixample. Bikes popular on the seafront.',
    localTips: [
      'Book Sagrada Família and Park Güell tickets online weeks ahead',
      'Lunch "menú del día" offers 3 courses for €10-15 at local spots',
      'La Rambla is for tourists. Side streets have better bars',
      'Dinner before 9pm means eating alone; locals arrive at 10pm',
    ],
  },
  {
    id: 'melbourne',
    city: 'Melbourne',
    country: 'Australia',
    region: 'Oceania',
    tagline: 'Laneway culture and serious coffee',
    description: 'A city that hides its best finds in alleys. Melbourne offers a coffee culture that rivals any global city, street art that\'s officially sanctioned, and a food scene that draws on every cuisine the Pacific touches.',
    timezone: 'Australia/Melbourne',
    currency: 'AUD',
    imageUrl: 'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1200&q=80',
      'https://images.unsplash.com/photo-1545044846-351ba102b6d5?w=1200&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80',
    ],
    climate: 'Temperate oceanic with warm summers and mild winters. Temperature 6-26°C. "Four seasons in one day" is real.',
    bestMonths: ['Mar', 'Apr', 'May', 'Oct', 'Nov'],
    gettingAround: 'Free tram zone in CBD. myki card for all public transit. Walking laneways is the best way to explore.',
    localTips: [
      'Coffee culture is serious. Find a local roaster, not a chain',
      'Hosier Lane has the most famous street art but side lanes surprise',
      'Queen Victoria Market is best Saturday morning for atmosphere',
      'Great Ocean Road day trip is 5+ hours. Consider overnight',
    ],
  },
  {
    id: 'petra',
    city: 'Petra',
    country: 'Jordan',
    region: 'Middle East',
    tagline: 'Rose-red city carved from time itself',
    description: 'An ancient Nabataean city revealed through a narrow canyon. Petra offers the Treasury at sunrise, desert stargazing, Bedouin hospitality, and a scale that photographs can never quite capture.',
    timezone: 'Asia/Amman',
    currency: 'JOD',
    imageUrl: 'https://images.unsplash.com/photo-1501232060322-aa87215ab531?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1501232060322-aa87215ab531?w=1200&q=80',
      'https://images.unsplash.com/photo-1548786811-dd6e453ccca7?w=1200&q=80',
      'https://images.unsplash.com/photo-1553856622-d1b352e9a211?w=1200&q=80',
    ],
    climate: 'Hot desert with scorching summers and mild winters. Temperature 5-35°C. Best avoided Jul-Aug.',
    bestMonths: ['Mar', 'Apr', 'May', 'Oct', 'Nov'],
    gettingAround: 'Walking only inside Petra. Wear sturdy shoes. Taxis from Wadi Musa. JETT bus from Amman.',
    localTips: [
      'Buy 2-day pass minimum. Petra is vast and rewards multiple visits',
      'Enter at 6am for sunrise light on the Treasury without crowds',
      'Petra by Night (Mon/Wed/Thurs) is magical with 1,500 candles',
      'Carry water and snacks. Facilities inside are basic and pricey',
    ],
  },
  {
    id: 'new-orleans',
    city: 'New Orleans',
    country: 'United States',
    region: 'North America',
    tagline: 'Where every meal is a conversation',
    description: 'A city that celebrates in the street and mourns with brass bands. New Orleans offers jazz that still evolves, Creole flavors that defy simple origin stories, and a relationship with the past that stays present.',
    timezone: 'America/Chicago',
    currency: 'USD',
    imageUrl: nolaHero1,
    images: [
      nolaHero1,
      nolaHero2,
      nolaHero3,
    ],
    climate: 'Humid subtropical with hot summers and mild winters. Expect afternoon thunderstorms in summer.',
    bestMonths: ['Feb', 'Mar', 'Apr', 'Oct', 'Nov'],
    gettingAround: 'Historic streetcars are iconic but slow. Walking is best in French Quarter. Uber/Lyft for longer distances.',
    localTips: [
      'Try beignets at Café Du Monde. Go early to beat lines',
      'Skip Bourbon Street for Frenchmen Street for real jazz',
      'The French Quarter is walkable. Wear comfortable shoes',
      'Reservations are essential at top restaurants like Commander\'s Palace',
    ],
  },
  {
    id: 'cusco',
    city: 'Cusco',
    country: 'Peru',
    region: 'South America',
    tagline: 'Inca foundations beneath colonial layers',
    description: 'The ancient capital that anchors Sacred Valley exploration. Cusco offers altitude-adjusted arrivals, Andean textile traditions, ceviche at elevation, and architecture where Inca stonework supports Spanish churches.',
    timezone: 'America/Lima',
    currency: 'PEN',
    imageUrl: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1200&q=80',
      'https://images.unsplash.com/photo-1580619305218-8423a7ef79b4?w=1200&q=80',
      'https://images.unsplash.com/photo-1531065208531-4036c0dba3ca?w=1200&q=80',
    ],
    climate: 'Highland subtropical with dry and wet seasons. Temperature 5-20°C. Altitude (3,400m) affects everyone.',
    bestMonths: ['Apr', 'May', 'Sep', 'Oct'],
    gettingAround: 'Centro is walkable but hilly. Colectivos to Sacred Valley. Taxis cheap. Altitude makes walking slower.',
    localTips: [
      'Spend 2 days acclimatizing before Machu Picchu trek',
      'Coca tea helps with altitude sickness. Drink plenty',
      'Book Machu Picchu and Huayna Picchu months in advance',
      'San Pedro Market has the best and cheapest local food',
    ],
  },
  {
    id: 'porto',
    city: 'Porto',
    country: 'Portugal',
    region: 'Europe',
    tagline: 'Azulejos, port wine, and river light',
    description: 'A working city that happens to be beautiful. Porto offers wine cellars across the river, tile-covered churches, francesinha sandwiches, and a grittiness that Lisbon polished away decades ago.',
    timezone: 'Europe/Lisbon',
    currency: 'EUR',
    imageUrl: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
      'https://images.unsplash.com/photo-1513735718075-2e2d37cb7952?w=1200&q=80',
    ],
    climate: 'Mediterranean with warm, dry summers and mild, wet winters. Temperature 8-26°C.',
    bestMonths: ['May', 'Jun', 'Sep', 'Oct'],
    gettingAround: 'Walk the Ribeira area. Metro connects main districts. Cross Dom Luís I Bridge on foot for views.',
    localTips: [
      'Port wine tastings in Gaia are free or cheap. Compare several',
      'Francesinha is a local sandwich worth trying once',
      'Livraria Lello is beautiful but ticketed. Harry Potter fans created crowds',
      'São Bento station tiles are free art worth 15 minutes',
    ],
  },
];

export const activities: Activity[] = [
  // Kyoto activities
  { id: 'kyoto-1', destinationId: 'kyoto', title: 'Fushimi Inari Early Morning Walk', category: 'culture', description: 'Arrive before 7am to walk the famous vermillion torii gates in relative solitude. The mountain path takes 2-3 hours round trip.', priceTier: 'budget', neighborhood: 'Fushimi', duration: '2-3 hours', bestTime: 'Before 7am' },
  { id: 'kyoto-2', destinationId: 'kyoto', title: 'Nishiki Market Tasting', category: 'food', description: 'Walk through Kyoto\'s kitchen, sampling pickles, fresh tofu, and seasonal specialties from vendors with generations of expertise.', priceTier: 'moderate', neighborhood: 'Central Kyoto', duration: '1-2 hours', bestTime: 'Late morning' },
  { id: 'kyoto-3', destinationId: 'kyoto', title: 'Arashiyama Bamboo Grove', category: 'nature', description: 'The famous bamboo path is most peaceful at dawn. Combine with nearby Tenryu-ji temple garden for a contemplative morning.', priceTier: 'budget', neighborhood: 'Arashiyama', duration: '2 hours', bestTime: 'Before 8am' },
  { id: 'kyoto-4', destinationId: 'kyoto', title: 'Traditional Kaiseki Dinner', category: 'food', description: 'Multi-course seasonal cuisine that represents the pinnacle of Japanese culinary arts. Reserve well in advance.', priceTier: 'luxury', neighborhood: 'Gion', duration: '2-3 hours', bestTime: 'Evening' },
  { id: 'kyoto-5', destinationId: 'kyoto', title: 'Philosopher\'s Path Walk', category: 'nature', description: 'A canal-side path connecting temples, best during cherry blossom or autumn foliage seasons.', priceTier: 'budget', neighborhood: 'Higashiyama', duration: '1-2 hours', bestTime: 'Afternoon' },
  { id: 'kyoto-6', destinationId: 'kyoto', title: 'Gion Evening Walk', category: 'culture', description: 'Wander the preserved geisha district at dusk, when wooden machiya houses glow with paper lanterns.', priceTier: 'budget', neighborhood: 'Gion', duration: '1-2 hours', bestTime: 'Early evening' },
  
  // Lisbon activities  
  { id: 'lisbon-1', destinationId: 'lisbon', title: 'Alfama Morning Exploration', category: 'culture', description: 'Get lost in the oldest neighborhood, where fado music drifts from doorways and laundry hangs between buildings.', priceTier: 'budget', neighborhood: 'Alfama', duration: '2-3 hours', bestTime: 'Morning' },
  { id: 'lisbon-2', destinationId: 'lisbon', title: 'Pastéis de Belém', category: 'food', description: 'The original pastel de nata bakery, operating since 1837. Expect queues but quick turnover.', priceTier: 'budget', neighborhood: 'Belém', duration: '30-45 minutes', bestTime: 'Morning' },
  { id: 'lisbon-3', destinationId: 'lisbon', title: 'Tram 28 Journey', category: 'culture', description: 'The famous yellow tram winds through historic neighborhoods. Best experienced on a weekday to avoid crowds.', priceTier: 'budget', neighborhood: 'Citywide', duration: '45 minutes', bestTime: 'Weekday morning' },
  { id: 'lisbon-4', destinationId: 'lisbon', title: 'Time Out Market Dinner', category: 'food', description: 'A curated food hall bringing together some of Lisbon\'s notable chefs under one roof.', priceTier: 'moderate', neighborhood: 'Cais do Sodré', duration: '1-2 hours', bestTime: 'Evening' },
  { id: 'lisbon-5', destinationId: 'lisbon', title: 'Miradouro Sunset', category: 'nature', description: 'Watch the golden hour from one of Lisbon\'s many viewpoints. Senhora do Monte offers the widest panorama.', priceTier: 'budget', neighborhood: 'Graça', duration: '1 hour', bestTime: 'Sunset' },
  { id: 'lisbon-6', destinationId: 'lisbon', title: 'Fado Night in Alfama', category: 'nightlife', description: 'Experience Portugal\'s soulful music tradition in an intimate venue. Dinner often included.', priceTier: 'moderate', neighborhood: 'Alfama', duration: '2-3 hours', bestTime: 'Evening' },

  // Cape Town activities
  { id: 'cape-town-1', destinationId: 'cape-town', title: 'Table Mountain Sunrise Hike', category: 'adventure', description: 'Platteklip Gorge route offers the most direct path up. Start before dawn for cooler temperatures and sunrise views.', priceTier: 'budget', neighborhood: 'City Bowl', duration: '4-5 hours', bestTime: 'Pre-dawn start' },
  { id: 'cape-town-2', destinationId: 'cape-town', title: 'Bo-Kaap Walking Tour', category: 'culture', description: 'The colorful Cape Malay quarter offers history, architecture, and cooking classes that connect to complex heritage.', priceTier: 'moderate', neighborhood: 'Bo-Kaap', duration: '2-3 hours', bestTime: 'Morning' },
  { id: 'cape-town-3', destinationId: 'cape-town', title: 'Constantia Wine Route', category: 'food', description: 'South Africa\'s oldest wine region sits 20 minutes from downtown. Several estates offer tastings with mountain views.', priceTier: 'moderate', neighborhood: 'Constantia', duration: 'Half day', bestTime: 'Afternoon' },
  { id: 'cape-town-4', destinationId: 'cape-town', title: 'Boulders Beach Penguins', category: 'nature', description: 'African penguins inhabit this beach near Simon\'s Town. A boardwalk provides viewing access.', priceTier: 'budget', neighborhood: 'Simon\'s Town', duration: '1-2 hours', bestTime: 'Morning' },
  { id: 'cape-town-5', destinationId: 'cape-town', title: 'Cape Point Peninsula Drive', category: 'adventure', description: 'A full day exploring the dramatic peninsula that ends at the Cape of Good Hope.', priceTier: 'moderate', neighborhood: 'Cape Peninsula', duration: 'Full day', bestTime: 'Early start' },
  { id: 'cape-town-6', destinationId: 'cape-town', title: 'V&A Waterfront Evening', category: 'food', description: 'The harbor development offers dining options with mountain views as backdrop.', priceTier: 'moderate', neighborhood: 'Waterfront', duration: '2-3 hours', bestTime: 'Evening' },

  // Mexico City activities
  { id: 'mexico-city-1', destinationId: 'mexico-city', title: 'Mercado de San Juan', category: 'food', description: 'The gourmet market where chefs shop. Sample exotic meats, aged cheeses, and specialty ingredients.', priceTier: 'moderate', neighborhood: 'Centro', duration: '1-2 hours', bestTime: 'Late morning' },
  { id: 'mexico-city-2', destinationId: 'mexico-city', title: 'Museo Nacional de Antropología', category: 'culture', description: 'One of the world\'s great museums, requiring selective attention or multiple visits.', priceTier: 'budget', neighborhood: 'Chapultepec', duration: '3-4 hours', bestTime: 'Morning' },
  { id: 'mexico-city-3', destinationId: 'mexico-city', title: 'Xochimilco Floating Gardens', category: 'nature', description: 'Colorful trajineras navigate ancient Aztec canals. Better on weekdays for a calmer experience.', priceTier: 'moderate', neighborhood: 'Xochimilco', duration: 'Half day', bestTime: 'Weekday afternoon' },
  { id: 'mexico-city-4', destinationId: 'mexico-city', title: 'Roma-Condesa Evening Walk', category: 'culture', description: 'Art Deco architecture, indie boutiques, and some of the city\'s best restaurants concentrate in these leafy neighborhoods.', priceTier: 'budget', neighborhood: 'Roma/Condesa', duration: '2-3 hours', bestTime: 'Evening' },
  { id: 'mexico-city-5', destinationId: 'mexico-city', title: 'Tacos at El Califa de León', category: 'food', description: 'Simple tacos executed with precision. Order bistec or costilla and observe the craft.', priceTier: 'budget', neighborhood: 'San Rafael', duration: '30-45 minutes', bestTime: 'Late evening' },
  { id: 'mexico-city-6', destinationId: 'mexico-city', title: 'Teotihuacán Day Trip', category: 'culture', description: 'The massive Pyramids of the Sun and Moon predate the Aztec civilization. Arrive early to beat crowds and heat.', priceTier: 'moderate', neighborhood: 'Day trip', duration: 'Full day', bestTime: 'Early morning departure' },

  // Copenhagen activities
  { id: 'copenhagen-1', destinationId: 'copenhagen', title: 'Nyhavn Coffee Walk', category: 'culture', description: 'The colorful harbor is crowded but provides the essential Copenhagen photo. Better in morning light.', priceTier: 'budget', neighborhood: 'Nyhavn', duration: '1 hour', bestTime: 'Morning' },
  { id: 'copenhagen-2', destinationId: 'copenhagen', title: 'Smørrebrød Lunch', category: 'food', description: 'Open-faced sandwich tradition elevated to an art form. Several historic restaurants maintain high standards.', priceTier: 'moderate', neighborhood: 'Central', duration: '1-2 hours', bestTime: 'Lunch' },
  { id: 'copenhagen-3', destinationId: 'copenhagen', title: 'Tivoli Gardens Evening', category: 'culture', description: 'The world\'s second-oldest amusement park enchants after dark when lights transform the gardens.', priceTier: 'moderate', neighborhood: 'City Center', duration: '2-3 hours', bestTime: 'Evening' },
  { id: 'copenhagen-4', destinationId: 'copenhagen', title: 'Cycling Tour', category: 'adventure', description: 'Experience Copenhagen as locals do: by bike. Flat terrain and excellent infrastructure make it effortless.', priceTier: 'budget', neighborhood: 'Citywide', duration: '3-4 hours', bestTime: 'Afternoon' },
  { id: 'copenhagen-5', destinationId: 'copenhagen', title: 'Torvehallerne Food Market', category: 'food', description: 'A modern food hall with Nordic specialties, organic produce, and excellent coffee.', priceTier: 'moderate', neighborhood: 'Nørrebro', duration: '1-2 hours', bestTime: 'Late morning' },
  { id: 'copenhagen-6', destinationId: 'copenhagen', title: 'Louisiana Museum Day Trip', category: 'culture', description: 'World-class modern art collection in a stunning seaside setting 35km north of the city.', priceTier: 'moderate', neighborhood: 'Day trip', duration: 'Half day', bestTime: 'Afternoon' },

  // New Orleans activities
  { id: 'new-orleans-1', destinationId: 'new-orleans', title: 'French Quarter Walking Tour', category: 'culture', description: 'Explore the historic French Quarter with its iconic architecture, jazz clubs, and the legendary Jackson Square.', priceTier: 'budget', neighborhood: 'French Quarter', duration: '2-3 hours', bestTime: 'Morning' },
  { id: 'new-orleans-2', destinationId: 'new-orleans', title: 'Beignets at Café Du Monde', category: 'food', description: 'The iconic New Orleans experience - powdered sugar-dusted beignets and chicory coffee at this 1862 landmark.', priceTier: 'budget', neighborhood: 'French Quarter', duration: '30-45 minutes', bestTime: 'Morning' },
  { id: 'new-orleans-3', destinationId: 'new-orleans', title: 'Frenchmen Street Jazz', category: 'nightlife', description: 'Skip Bourbon Street for authentic live jazz on Frenchmen Street where locals actually go.', priceTier: 'budget', neighborhood: 'Marigny', duration: '3-4 hours', bestTime: 'Evening' },
  { id: 'new-orleans-4', destinationId: 'new-orleans', title: 'Garden District Architecture Walk', category: 'culture', description: 'Stroll past antebellum mansions and centuries-old oak trees in this elegant neighborhood.', priceTier: 'budget', neighborhood: 'Garden District', duration: '2 hours', bestTime: 'Afternoon' },
  { id: 'new-orleans-5', destinationId: 'new-orleans', title: 'Commander\'s Palace Brunch', category: 'food', description: 'Legendary Creole fine dining with 25-cent martinis at lunch. Jacket required. Reservations essential.', priceTier: 'premium', neighborhood: 'Garden District', duration: '2 hours', bestTime: 'Weekend Brunch' },
  { id: 'new-orleans-6', destinationId: 'new-orleans', title: 'Swamp Tour', category: 'nature', description: 'Venture into the bayous to see alligators, Spanish moss, and the unique Louisiana wetland ecosystem.', priceTier: 'moderate', neighborhood: 'Day trip', duration: 'Half day', bestTime: 'Morning' },

  // Cartagena activities
  { id: 'cartagena-1', destinationId: 'cartagena', title: 'Old Town Evening Walk', category: 'culture', description: 'Wander the walled city when temperatures cool and colonial buildings glow in evening light.', priceTier: 'budget', neighborhood: 'Centro Histórico', duration: '2 hours', bestTime: 'Evening' },
  { id: 'cartagena-2', destinationId: 'cartagena', title: 'Ceviche at La Cevicheria', category: 'food', description: 'Fresh seafood preparations that showcase Caribbean ingredients. Arrive before noon to avoid waits.', priceTier: 'moderate', neighborhood: 'Centro', duration: '1-2 hours', bestTime: 'Late morning' },
  { id: 'cartagena-3', destinationId: 'cartagena', title: 'Rosario Islands Day Trip', category: 'nature', description: 'A collection of small islands with clear water for snorkeling, about an hour by boat.', priceTier: 'moderate', neighborhood: 'Day trip', duration: 'Full day', bestTime: 'Early departure' },
  { id: 'cartagena-4', destinationId: 'cartagena', title: 'Café del Mar Sunset', category: 'nightlife', description: 'Watch sunset from the historic walls with cocktails and city views.', priceTier: 'moderate', neighborhood: 'San Diego', duration: '2 hours', bestTime: 'Sunset' },
  { id: 'cartagena-5', destinationId: 'cartagena', title: 'Getsemaní Street Art', category: 'culture', description: 'The neighborhood adjacent to the walled city features vibrant murals and emerging galleries.', priceTier: 'budget', neighborhood: 'Getsemaní', duration: '1-2 hours', bestTime: 'Morning' },
  { id: 'cartagena-6', destinationId: 'cartagena', title: 'Castle of San Felipe', category: 'culture', description: 'The largest Spanish colonial fortification in the Americas, with views across the city.', priceTier: 'budget', neighborhood: 'San Lázaro', duration: '1-2 hours', bestTime: 'Morning' },
];

export function getDestinationById(id: string): Destination | undefined {
  return destinations.find(d => d.id === id);
}

export function getActivitiesByDestination(destinationId: string): Activity[] {
  return activities.filter(a => a.destinationId === destinationId);
}

export function searchDestinations(query: string, region?: string): Destination[] {
  let results = destinations;
  
  if (region && region !== 'all') {
    results = results.filter(d => d.region.toLowerCase() === region.toLowerCase());
  }
  
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(d => 
      d.city.toLowerCase().includes(q) || 
      d.country.toLowerCase().includes(q) ||
      d.tagline.toLowerCase().includes(q)
    );
  }
  
  return results;
}

export const regions = ['All', 'Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania', 'Middle East'];
