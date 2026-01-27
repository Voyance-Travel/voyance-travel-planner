// =============================================================================
// DESTINATION ESSENTIALS - Non-Negotiable Landmarks & Hidden Gems
// =============================================================================
// This module provides curated lists of must-see landmarks and hidden gems
// for major destinations. These are injected into the generation prompt to
// ensure first-time visitors don't miss iconic experiences, while local
// explorers get authentic off-the-beaten-path recommendations.
// =============================================================================

export interface DestinationEssential {
  name: string;
  category: 'landmark' | 'museum' | 'neighborhood' | 'food' | 'experience' | 'viewpoint';
  priority: number; // 1-10, higher = more essential
  duration: string; // e.g., "2-3 hours", "30 min"
  bestTime?: string; // e.g., "early morning", "sunset"
  bookingRequired: boolean;
  note?: string;
}

export interface HiddenGem {
  name: string;
  category: 'local_favorite' | 'neighborhood' | 'food' | 'market' | 'viewpoint' | 'experience' | 'landmark' | 'museum';
  whyLocal: string; // Why locals love it
  bestFor: string[]; // e.g., ['couples', 'foodies', 'photographers']
  crowdLevel: 'low' | 'moderate';
}

export interface DestinationIntelligence {
  city: string;
  country: string;
  nonNegotiables: DestinationEssential[];
  hiddenGems: HiddenGem[];
  avoidTouristTraps?: string[]; // For high-authenticity travelers
}

// =============================================================================
// CURATED DESTINATION DATA
// =============================================================================

const DESTINATION_INTELLIGENCE: Record<string, DestinationIntelligence> = {
  // -------------------------------------------------------------------------
  // ROME
  // -------------------------------------------------------------------------
  'rome': {
    city: 'Rome',
    country: 'Italy',
    nonNegotiables: [
      { name: 'Colosseum & Roman Forum', category: 'landmark', priority: 10, duration: '3-4 hours', bestTime: 'early morning', bookingRequired: true, note: 'Book skip-the-line tickets in advance' },
      { name: 'Vatican Museums & Sistine Chapel', category: 'museum', priority: 10, duration: '3-4 hours', bestTime: 'early morning', bookingRequired: true, note: 'Book skip-the-line, dress modestly' },
      { name: 'St. Peter\'s Basilica', category: 'landmark', priority: 9, duration: '1-2 hours', bestTime: 'morning', bookingRequired: false, note: 'Free entry, long security lines' },
      { name: 'Trevi Fountain', category: 'landmark', priority: 9, duration: '30 min', bestTime: 'early morning or late night', bookingRequired: false, note: 'Very crowded midday' },
      { name: 'Pantheon', category: 'landmark', priority: 8, duration: '1 hour', bestTime: 'midday for light through oculus', bookingRequired: true, note: 'Now requires free reservation' },
      { name: 'Piazza Navona', category: 'neighborhood', priority: 7, duration: '30-45 min', bookingRequired: false },
      { name: 'Spanish Steps', category: 'landmark', priority: 7, duration: '30 min', bestTime: 'sunset', bookingRequired: false },
      { name: 'Trastevere neighborhood stroll', category: 'neighborhood', priority: 7, duration: '2-3 hours', bestTime: 'evening', bookingRequired: false, note: 'Best for dinner and atmosphere' },
      { name: 'Traditional Roman dinner (cacio e pepe, carbonara)', category: 'food', priority: 8, duration: '2 hours', bookingRequired: true, note: 'Reserve at authentic trattoria' },
      { name: 'Gelato at a proper gelateria', category: 'food', priority: 6, duration: '20 min', bookingRequired: false, note: 'Look for natural colors, covered bins' },
    ],
    hiddenGems: [
      { name: 'Testaccio neighborhood & market', category: 'neighborhood', whyLocal: 'Working-class Rome, best food market, zero tourists', bestFor: ['foodies', 'authentic experience'], crowdLevel: 'low' },
      { name: 'Aperitivo in Pigneto', category: 'experience', whyLocal: 'Street art district, local artists and students gather here', bestFor: ['nightlife', 'young travelers'], crowdLevel: 'moderate' },
      { name: 'Gianicolo Hill at sunset', category: 'viewpoint', whyLocal: 'Best panoramic view, where Romans go, not tourists', bestFor: ['couples', 'photographers'], crowdLevel: 'low' },
      { name: 'Quartiere Coppedè', category: 'neighborhood', whyLocal: 'Surreal Art Nouveau architecture, feels like a fairy tale', bestFor: ['architecture lovers', 'photographers'], crowdLevel: 'low' },
      { name: 'Mercato di Campo de\' Fiori (morning only)', category: 'market', whyLocal: 'Working market, locals shop here, tourist trap by afternoon', bestFor: ['foodies', 'early risers'], crowdLevel: 'moderate' },
      { name: 'Aventine Hill & Keyhole view', category: 'viewpoint', whyLocal: 'Peek through Knights of Malta keyhole for framed St. Peter\'s', bestFor: ['photographers', 'unique experience'], crowdLevel: 'low' },
      { name: 'Jewish Ghetto for carciofi alla giudia', category: 'food', whyLocal: 'Historic neighborhood, authentic Roman-Jewish cuisine', bestFor: ['foodies', 'history buffs'], crowdLevel: 'moderate' },
      { name: 'Centrale Montemartini', category: 'museum', whyLocal: 'Ancient sculptures in power plant, nobody knows about it', bestFor: ['art lovers', 'unique experience'], crowdLevel: 'low' },
    ],
    avoidTouristTraps: ['Restaurants on Piazza Navona', 'Cafes on Spanish Steps', 'Street vendors selling "authentic" leather', 'Restaurants with photo menus on street'],
  },

  // -------------------------------------------------------------------------
  // PARIS
  // -------------------------------------------------------------------------
  'paris': {
    city: 'Paris',
    country: 'France',
    nonNegotiables: [
      { name: 'Eiffel Tower', category: 'landmark', priority: 10, duration: '2-3 hours', bestTime: 'sunset or after dark', bookingRequired: true, note: 'Book summit tickets well in advance' },
      { name: 'Louvre Museum (at least exterior + Mona Lisa)', category: 'museum', priority: 10, duration: '3-4 hours', bestTime: 'Wednesday or Friday evening', bookingRequired: true, note: 'Skip crowds with timed entry' },
      { name: 'Notre-Dame Cathedral (exterior/area)', category: 'landmark', priority: 8, duration: '30-45 min', bookingRequired: false, note: 'Still under restoration but worth seeing' },
      { name: 'Sacré-Cœur & Montmartre', category: 'landmark', priority: 9, duration: '2-3 hours', bestTime: 'morning for fewer crowds', bookingRequired: false, note: 'Walk up for views, explore artist square' },
      { name: 'Champs-Élysées & Arc de Triomphe', category: 'landmark', priority: 8, duration: '1.5-2 hours', bestTime: 'evening', bookingRequired: true, note: 'Book Arc roof access' },
      { name: 'Seine River walk or cruise', category: 'experience', priority: 8, duration: '1-2 hours', bestTime: 'sunset', bookingRequired: false },
      { name: 'Musée d\'Orsay', category: 'museum', priority: 8, duration: '2-3 hours', bookingRequired: true, note: 'Impressionist masterpieces' },
      { name: 'Café lunch on the Left Bank', category: 'food', priority: 7, duration: '1.5 hours', bookingRequired: false, note: 'Classic Parisian experience' },
      { name: 'Croissant from a real boulangerie', category: 'food', priority: 6, duration: '15 min', bookingRequired: false, note: 'Look for butter-scent and handmade signs' },
      { name: 'Le Marais neighborhood walk', category: 'neighborhood', priority: 7, duration: '2-3 hours', bookingRequired: false },
    ],
    hiddenGems: [
      { name: 'Canal Saint-Martin', category: 'neighborhood', whyLocal: 'Trendy local hangout, picnic spot, zero tourists', bestFor: ['couples', 'picnic lovers'], crowdLevel: 'low' },
      { name: 'Marché des Enfants Rouges', category: 'market', whyLocal: 'Oldest covered market in Paris, locals eat lunch here', bestFor: ['foodies'], crowdLevel: 'moderate' },
      { name: 'Parc des Buttes-Chaumont', category: 'viewpoint', whyLocal: 'Romans bring wine at sunset, no tourists know about it', bestFor: ['sunset watchers', 'picnic lovers'], crowdLevel: 'low' },
      { name: 'Belleville neighborhood', category: 'neighborhood', whyLocal: 'Immigrant food scene, street art, the real Paris', bestFor: ['foodies', 'off-path explorers'], crowdLevel: 'low' },
      { name: 'Rue Crémieux', category: 'neighborhood', whyLocal: 'Colorful houses, Instagram secret, quick visit', bestFor: ['photographers'], crowdLevel: 'low' },
      { name: 'Père Lachaise Cemetery', category: 'experience', whyLocal: 'Peaceful walks among history, Jim Morrison, Oscar Wilde', bestFor: ['history buffs', 'quiet seekers'], crowdLevel: 'low' },
      { name: 'La Felicità food hall', category: 'food', whyLocal: 'Massive Italian food hall, young Parisians love it', bestFor: ['groups', 'casual dining'], crowdLevel: 'moderate' },
      { name: 'Promenade Plantée', category: 'experience', whyLocal: 'Elevated park before NYC High Line, locals jog here', bestFor: ['walkers', 'nature lovers'], crowdLevel: 'low' },
    ],
    avoidTouristTraps: ['Restaurants directly facing major monuments', 'Champs-Élysées chain restaurants', 'Painted artists at Montmartre (overpriced)'],
  },

  // -------------------------------------------------------------------------
  // TOKYO
  // -------------------------------------------------------------------------
  'tokyo': {
    city: 'Tokyo',
    country: 'Japan',
    nonNegotiables: [
      { name: 'Senso-ji Temple (Asakusa)', category: 'landmark', priority: 10, duration: '1.5-2 hours', bestTime: 'early morning or evening', bookingRequired: false, note: 'Arrive before 9am for empty shots' },
      { name: 'Shibuya Crossing', category: 'landmark', priority: 9, duration: '30-45 min', bestTime: 'evening rush hour', bookingRequired: false, note: 'Watch from Starbucks or Shibuya Sky' },
      { name: 'Meiji Shrine (Harajuku)', category: 'landmark', priority: 9, duration: '1-1.5 hours', bestTime: 'morning', bookingRequired: false },
      { name: 'Tsukiji Outer Market (or Toyosu)', category: 'food', priority: 8, duration: '2-3 hours', bestTime: 'morning', bookingRequired: false, note: 'Go early for freshest sushi' },
      { name: 'Shinjuku nightlife & Golden Gai', category: 'neighborhood', priority: 8, duration: '2-3 hours', bestTime: 'evening', bookingRequired: false },
      { name: 'Akihabara (Electric Town)', category: 'neighborhood', priority: 7, duration: '2-3 hours', bookingRequired: false, note: 'Anime, electronics, gaming culture' },
      { name: 'Tokyo Tower or Skytree view', category: 'viewpoint', priority: 7, duration: '1-2 hours', bestTime: 'sunset', bookingRequired: true },
      { name: 'Ramen at a proper ramen shop', category: 'food', priority: 8, duration: '45 min', bookingRequired: false, note: 'Find one with a ticket machine' },
      { name: 'Harajuku street fashion', category: 'neighborhood', priority: 7, duration: '1.5-2 hours', bookingRequired: false },
    ],
    hiddenGems: [
      { name: 'Shimokitazawa', category: 'neighborhood', whyLocal: 'Vintage shops, live music, Tokyo\'s Brooklyn', bestFor: ['young travelers', 'music lovers'], crowdLevel: 'low' },
      { name: 'Yanaka old town', category: 'neighborhood', whyLocal: 'Traditional Tokyo that survived WWII, cat street', bestFor: ['history buffs', 'photographers'], crowdLevel: 'low' },
      { name: 'Koenji for vintage and izakayas', category: 'neighborhood', whyLocal: 'Student area, best thrift shops, local izakayas', bestFor: ['budget travelers', 'nightlife'], crowdLevel: 'low' },
      { name: 'Gotokuji Temple (cat temple)', category: 'experience', whyLocal: 'Thousands of lucky cat figurines, very local', bestFor: ['unique experience', 'photographers'], crowdLevel: 'low' },
      { name: 'Harmonica Yokocho (Kichijoji)', category: 'food', whyLocal: 'Tiny alley bars and yakitori, where salarymen unwind', bestFor: ['foodies', 'nightlife'], crowdLevel: 'moderate' },
      { name: 'Nezu Shrine', category: 'landmark', whyLocal: 'Beautiful vermillion torii, no tourists unlike Fushimi Inari', bestFor: ['photographers', 'quiet seekers'], crowdLevel: 'low' },
      { name: 'Standing sushi at Tsukiji (not sit-down)', category: 'food', whyLocal: 'Quick, fresh, half the price, how locals eat', bestFor: ['foodies', 'budget travelers'], crowdLevel: 'moderate' },
    ],
    avoidTouristTraps: ['Robot Restaurant (overpriced gimmick)', 'Main Harajuku drag shops (overpriced)', 'Any sushi restaurant with English menu photos'],
  },

  // -------------------------------------------------------------------------
  // LONDON
  // -------------------------------------------------------------------------
  'london': {
    city: 'London',
    country: 'United Kingdom',
    nonNegotiables: [
      { name: 'Big Ben & Houses of Parliament', category: 'landmark', priority: 10, duration: '30-45 min', bookingRequired: false, note: 'Iconic photo spot, best from Westminster Bridge' },
      { name: 'Tower of London & Crown Jewels', category: 'landmark', priority: 9, duration: '3-4 hours', bestTime: 'morning', bookingRequired: true, note: 'Book ahead, join Yeoman tour' },
      { name: 'British Museum', category: 'museum', priority: 9, duration: '3-4 hours', bookingRequired: true, note: 'Free, but book timed entry' },
      { name: 'Buckingham Palace (Changing of the Guard)', category: 'landmark', priority: 8, duration: '1 hour', bestTime: '11am (check schedule)', bookingRequired: false },
      { name: 'Westminster Abbey', category: 'landmark', priority: 8, duration: '1.5-2 hours', bookingRequired: true },
      { name: 'Tower Bridge', category: 'landmark', priority: 8, duration: '45 min', bookingRequired: false, note: 'Walk across for free, glass floor extra' },
      { name: 'Borough Market', category: 'food', priority: 8, duration: '1.5-2 hours', bestTime: 'late morning', bookingRequired: false },
      { name: 'Traditional afternoon tea', category: 'food', priority: 7, duration: '2 hours', bookingRequired: true, note: 'Book at a classic hotel' },
      { name: 'Fish & chips at a proper pub', category: 'food', priority: 7, duration: '1 hour', bookingRequired: false },
      { name: 'South Bank walk', category: 'experience', priority: 7, duration: '1.5-2 hours', bookingRequired: false },
    ],
    hiddenGems: [
      { name: 'Leadenhall Market', category: 'neighborhood', whyLocal: 'Victorian covered market, Harry Potter vibes, locals lunch here', bestFor: ['photographers', 'history buffs'], crowdLevel: 'moderate' },
      { name: 'Columbia Road Flower Market (Sunday)', category: 'market', whyLocal: 'Flowers, coffee, local vibes, only Sundays', bestFor: ['photographers', 'morning people'], crowdLevel: 'moderate' },
      { name: 'Hampstead Heath & Parliament Hill view', category: 'viewpoint', whyLocal: 'Best city view, where Londoners picnic', bestFor: ['nature lovers', 'sunset watchers'], crowdLevel: 'low' },
      { name: 'Dishoom for breakfast', category: 'food', whyLocal: 'Bombay café, locals queue for bacon naan roll', bestFor: ['foodies'], crowdLevel: 'moderate' },
      { name: 'Little Venice canal walk', category: 'neighborhood', whyLocal: 'Houseboats, peaceful cafes, off tourist radar', bestFor: ['couples', 'quiet seekers'], crowdLevel: 'low' },
      { name: 'Maltby Street Market', category: 'market', whyLocal: 'Borough Market\'s cooler cousin, railway arches', bestFor: ['foodies', 'weekend visitors'], crowdLevel: 'low' },
      { name: 'Dennis Severs\' House', category: 'experience', whyLocal: 'Time capsule house, silent candlelit tour, unforgettable', bestFor: ['unique experience', 'history buffs'], crowdLevel: 'low' },
      { name: 'Pub crawl in Bermondsey', category: 'experience', whyLocal: 'Craft breweries under railway arches, young locals\' scene', bestFor: ['beer lovers', 'nightlife'], crowdLevel: 'moderate' },
    ],
    avoidTouristTraps: ['Leicester Square restaurants', 'Oxford Street shops (same as everywhere)', 'Hard Rock Cafe'],
  },

  // -------------------------------------------------------------------------
  // BARCELONA
  // -------------------------------------------------------------------------
  'barcelona': {
    city: 'Barcelona',
    country: 'Spain',
    nonNegotiables: [
      { name: 'Sagrada Familia', category: 'landmark', priority: 10, duration: '2-3 hours', bookingRequired: true, note: 'MUST book weeks ahead, include towers' },
      { name: 'Park Güell', category: 'landmark', priority: 9, duration: '1.5-2 hours', bestTime: 'early morning', bookingRequired: true, note: 'Book timed entry' },
      { name: 'La Rambla walk', category: 'neighborhood', priority: 8, duration: '1 hour', bookingRequired: false, note: 'Walk but don\'t eat here' },
      { name: 'Gothic Quarter (Barri Gòtic)', category: 'neighborhood', priority: 9, duration: '2-3 hours', bookingRequired: false },
      { name: 'La Boqueria Market', category: 'food', priority: 8, duration: '1 hour', bestTime: 'morning', bookingRequired: false, note: 'Don\'t eat at the front stalls' },
      { name: 'Casa Batlló or Casa Milà', category: 'landmark', priority: 8, duration: '1.5 hours', bookingRequired: true, note: 'Pick one Gaudí house' },
      { name: 'Barceloneta Beach', category: 'experience', priority: 7, duration: '2-3 hours', bookingRequired: false },
      { name: 'Tapas dinner experience', category: 'food', priority: 8, duration: '2-3 hours', bookingRequired: true, note: 'Book a proper tapas bar, not tourist trap' },
      { name: 'Camp Nou (for football fans)', category: 'experience', priority: 6, duration: '2 hours', bookingRequired: true },
    ],
    hiddenGems: [
      { name: 'El Born neighborhood', category: 'neighborhood', whyLocal: 'Best tapas, boutiques, cocktail bars, locals\' evening spot', bestFor: ['foodies', 'nightlife'], crowdLevel: 'moderate' },
      { name: 'Bunkers del Carmel sunset', category: 'viewpoint', whyLocal: 'Best panoramic view, locals bring wine, BYOB', bestFor: ['sunset watchers', 'photographers'], crowdLevel: 'moderate' },
      { name: 'Gràcia neighborhood', category: 'neighborhood', whyLocal: 'Village within city, local plazas, no tourists', bestFor: ['authentic experience', 'foodies'], crowdLevel: 'low' },
      { name: 'Sant Antoni Market & Sunday book market', category: 'market', whyLocal: 'New food hall, Sunday antiques, local families', bestFor: ['foodies', 'weekend visitors'], crowdLevel: 'moderate' },
      { name: 'Vermouth hour in El Poble Sec', category: 'experience', whyLocal: 'Pre-lunch vermouth tradition, local bars', bestFor: ['couples', 'foodies'], crowdLevel: 'low' },
      { name: 'Montjuïc Gardens walk (not cable car)', category: 'experience', whyLocal: 'Gardens, fountains, castle views, peaceful', bestFor: ['walkers', 'nature lovers'], crowdLevel: 'low' },
      { name: 'Cervecería Catalana (book ahead)', category: 'food', whyLocal: 'Where chefs eat on day off, best tapas in city', bestFor: ['foodies'], crowdLevel: 'moderate' },
    ],
    avoidTouristTraps: ['Any restaurant with photos on La Rambla', 'Front stalls of La Boqueria (overpriced)', 'Barceloneta waterfront restaurants (tourist prices)'],
  },
};

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Normalize city name for lookup
 */
function normalizeCity(city: string): string {
  return city.toLowerCase()
    .replace(/,.*$/, '') // Remove country/region
    .replace(/\s+/g, '') // Remove spaces
    .trim();
}

/**
 * Get destination intelligence for a city
 */
export function getDestinationIntelligence(destination: string): DestinationIntelligence | null {
  const normalized = normalizeCity(destination);
  
  // Direct match
  if (DESTINATION_INTELLIGENCE[normalized]) {
    return DESTINATION_INTELLIGENCE[normalized];
  }
  
  // Partial match (e.g., "Rome, Italy" → "rome")
  for (const [key, intel] of Object.entries(DESTINATION_INTELLIGENCE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return intel;
    }
  }
  
  return null;
}

/**
 * Calculate how many non-negotiables must be included based on trip length and authenticity
 */
export function calculateNonNegotiableCoverage(
  tripDays: number,
  authenticityScore: number,
  isFirstTimeVisitor: boolean = true
): { minRequired: number; coveragePercent: number; mode: 'tourist' | 'balanced' | 'local' } {
  // Determine mode based on authenticity
  let mode: 'tourist' | 'balanced' | 'local';
  if (authenticityScore <= 2) {
    mode = 'tourist';
  } else if (authenticityScore >= 4) {
    mode = 'local';
  } else {
    mode = 'balanced';
  }
  
  // For first-time visitors, non-negotiables are ALWAYS required regardless of mode
  // The mode only affects what ELSE you add
  if (!isFirstTimeVisitor && mode === 'local') {
    return { minRequired: 0, coveragePercent: 0, mode };
  }
  
  // Trip length scaling (for first-time visitors)
  let minRequired: number;
  let coveragePercent: number;
  
  if (tripDays <= 2) {
    minRequired = 3; // Top 3 essentials
    coveragePercent = 30;
  } else if (tripDays <= 4) {
    minRequired = 5; // Top 5
    coveragePercent = 50;
  } else if (tripDays <= 6) {
    minRequired = 7;
    coveragePercent = 70;
  } else {
    minRequired = 10; // All essentials + deep cuts
    coveragePercent = 100;
  }
  
  return { minRequired, coveragePercent, mode };
}

/**
 * Build the destination essentials prompt section
 */
export function buildDestinationEssentialsPrompt(
  destination: string,
  tripDays: number,
  authenticityScore: number,
  isFirstTimeVisitor: boolean = true
): string {
  const intel = getDestinationIntelligence(destination);
  
  if (!intel) {
    // No curated data - use generic calibration
    return buildGenericAuthenticityCalibration(authenticityScore);
  }
  
  const coverage = calculateNonNegotiableCoverage(tripDays, authenticityScore, isFirstTimeVisitor);
  const lines: string[] = [];
  
  lines.push(`${'='.repeat(70)}`);
  lines.push(`🎯 DESTINATION ESSENTIALS — ${intel.city.toUpperCase()}, ${intel.country.toUpperCase()}`);
  lines.push(`${'='.repeat(70)}`);
  lines.push('');
  
  // First-time visitor notice
  if (isFirstTimeVisitor) {
    lines.push(`⚠️ FIRST-TIME VISITOR DETECTED`);
    lines.push(`   Non-negotiable landmarks MUST be included. Skipping them is a FAILURE.`);
    lines.push('');
  }
  
  // Mode explanation
  lines.push(`📊 TRAVELER MODE: ${coverage.mode.toUpperCase()}`);
  lines.push(`   Authenticity score: ${authenticityScore > 0 ? '+' : ''}${authenticityScore}`);
  lines.push(`   Trip length: ${tripDays} days`);
  lines.push(`   Required non-negotiables: ${coverage.minRequired}+`);
  lines.push('');
  
  // Non-negotiables list (sorted by priority)
  const sortedEssentials = [...intel.nonNegotiables].sort((a, b) => b.priority - a.priority);
  const requiredEssentials = sortedEssentials.slice(0, coverage.minRequired);
  
  if (requiredEssentials.length > 0 && isFirstTimeVisitor) {
    lines.push(`🏛️ NON-NEGOTIABLE LANDMARKS (MUST include these)`);
    lines.push(`${'─'.repeat(50)}`);
    
    for (let i = 0; i < requiredEssentials.length; i++) {
      const e = requiredEssentials[i];
      lines.push(`   ${i + 1}. ${e.name}`);
      lines.push(`      Duration: ${e.duration}${e.bestTime ? ` | Best: ${e.bestTime}` : ''}`);
      if (e.bookingRequired) lines.push(`      ⚠️ BOOKING REQUIRED`);
      if (e.note) lines.push(`      💡 ${e.note}`);
    }
    lines.push('');
    
    lines.push(`   If ANY of the above are missing from the itinerary, you have FAILED.`);
    lines.push('');
  }
  
  // Hidden gems for local/balanced modes
  if (coverage.mode !== 'tourist' || !isFirstTimeVisitor) {
    lines.push(`🔮 HIDDEN GEMS (Prioritize for this traveler)`);
    lines.push(`${'─'.repeat(50)}`);
    
    const gemsToShow = intel.hiddenGems.slice(0, 5);
    for (const gem of gemsToShow) {
      lines.push(`   • ${gem.name}`);
      lines.push(`      Why locals love it: ${gem.whyLocal}`);
    }
    lines.push('');
  }
  
  // Tourist traps to avoid
  if (coverage.mode !== 'tourist' && intel.avoidTouristTraps) {
    lines.push(`🚫 AVOID THESE TOURIST TRAPS`);
    lines.push(`${'─'.repeat(50)}`);
    for (const trap of intel.avoidTouristTraps.slice(0, 4)) {
      lines.push(`   ❌ ${trap}`);
    }
    lines.push('');
  }
  
  // Mode-specific guidance
  lines.push(`🎯 MODE-SPECIFIC GUIDANCE`);
  lines.push(`${'─'.repeat(50)}`);
  
  if (coverage.mode === 'tourist') {
    lines.push(`   This traveler WANTS the classic experience.`);
    lines.push(`   ✅ Prioritize iconic, bucket-list attractions`);
    lines.push(`   ✅ Include world-famous restaurants and cafés`);
    lines.push(`   ✅ Photo opportunities at landmarks matter`);
    lines.push(`   ✅ "Must-see" experiences are genuinely important`);
  } else if (coverage.mode === 'local') {
    lines.push(`   This traveler wants to feel like a local, not a tourist.`);
    lines.push(`   ✅ After non-negotiables: prioritize neighborhood spots`);
    lines.push(`   ✅ Restaurants without English menus are a plus`);
    lines.push(`   ✅ Hidden courtyards > famous plazas`);
    lines.push(`   ✅ They'd rather miss secondary attractions than wait in line`);
  } else {
    lines.push(`   This traveler wants the best of both worlds.`);
    lines.push(`   ✅ One iconic experience per day + one local discovery`);
    lines.push(`   ✅ Famous landmark in morning, neighborhood gem in evening`);
    lines.push(`   ✅ Classic restaurants AND hidden gems`);
  }
  
  lines.push('');
  lines.push(`${'='.repeat(70)}`);
  lines.push(`END OF DESTINATION ESSENTIALS`);
  lines.push(`${'='.repeat(70)}`);
  
  return lines.join('\n');
}

/**
 * Generic authenticity calibration for cities without curated data
 */
function buildGenericAuthenticityCalibration(authenticityScore: number): string {
  const lines: string[] = [];
  
  lines.push(`${'='.repeat(70)}`);
  lines.push(`🎯 AUTHENTICITY CALIBRATION`);
  lines.push(`${'='.repeat(70)}`);
  lines.push('');
  lines.push(`User authenticity score: ${authenticityScore > 0 ? '+' : ''}${authenticityScore}`);
  lines.push('');
  
  if (authenticityScore <= 2) {
    lines.push(`MODE: TOURIST-FRIENDLY`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`This traveler WANTS the classic experience. Do not shy away from famous landmarks.`);
    lines.push(`   ✅ Prioritize iconic, bucket-list attractions`);
    lines.push(`   ✅ Include world-famous restaurants and cafés`);
    lines.push(`   ✅ Photo opportunities at landmarks matter`);
    lines.push(`   ✅ "Must-see" experiences are genuinely important`);
    lines.push(`   ✅ Classic > clever for this traveler`);
  } else if (authenticityScore >= 4) {
    lines.push(`MODE: OFF-THE-BEATEN-PATH`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`This traveler wants to feel like a local, not a tourist.`);
    lines.push(`   ⚠️ Still include top 2-3 iconic landmarks (can't skip the Colosseum)`);
    lines.push(`   ✅ Then prioritize neighborhood spots locals actually go`);
    lines.push(`   ✅ Restaurants without English menus are a plus`);
    lines.push(`   ✅ Hidden courtyards > famous plazas for the rest`);
    lines.push(`   ✅ They'd rather miss secondary attractions than wait in line`);
  } else {
    lines.push(`MODE: BALANCED`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`Mix both worlds. One iconic experience per day, one local discovery.`);
    lines.push(`   ✅ Morning: famous landmark`);
    lines.push(`   ✅ Afternoon: neighborhood exploration`);
    lines.push(`   ✅ Evening: local dining spot`);
  }
  
  lines.push('');
  lines.push(`CRITICAL: Authenticity score determines what ELSE you add after essentials.`);
  lines.push(`It does NOT mean you skip the Colosseum for a first-time Rome visitor.`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Check if a destination has curated essentials
 */
export function hasCuratedEssentials(destination: string): boolean {
  return getDestinationIntelligence(destination) !== null;
}

/**
 * Get list of supported destinations with curated data
 */
export function getSupportedDestinations(): string[] {
  return Object.values(DESTINATION_INTELLIGENCE).map(d => `${d.city}, ${d.country}`);
}

// =============================================================================
// RE-EXPORT DB-DRIVEN ENRICHMENT FOR UNIFIED API
// =============================================================================

export {
  getDestinationWithEssentials,
  buildDBEssentialsPrompt,
  type DestinationData,
  type EnrichedEssential,
  type EnrichedGem,
} from './destination-enrichment.ts';

/**
 * Build essentials prompt - prefers DB data, falls back to curated data
 * This is the unified entry point for the generation flow
 */
export async function buildDestinationEssentialsPromptWithDB(
  supabase: unknown, // SupabaseClient but avoiding import issues
  destinationName: string,
  tripDays: number,
  authenticityScore: number,
  isFirstTimeVisitor: boolean = true,
  perplexityApiKey?: string
): Promise<string> {
  // Import dynamically to avoid circular deps
  const { getDestinationWithEssentials, buildDBEssentialsPrompt } = await import('./destination-enrichment.ts');
  
  try {
    // Try DB-driven data first
    const dbData = await getDestinationWithEssentials(
      supabase as any,
      destinationName,
      perplexityApiKey
    );
    
    if (dbData && dbData.pointsOfInterest.length > 0) {
      console.log(`[Essentials] Using DB data for ${dbData.city}: ${dbData.pointsOfInterest.length} POIs`);
      return buildDBEssentialsPrompt(dbData, tripDays, authenticityScore, isFirstTimeVisitor);
    }
  } catch (err) {
    console.warn('[Essentials] DB fetch failed, falling back to curated:', err);
  }
  
  // Fall back to hardcoded curated data
  console.log(`[Essentials] Using curated data for ${destinationName}`);
  return buildDestinationEssentialsPrompt(destinationName, tripDays, authenticityScore, isFirstTimeVisitor);
}
