/**
 * dining-config.ts — DNA-Aware Dining Configuration
 *
 * Maps each archetype tier and specific archetype to dining behavior:
 * price ranges, Michelin policy, dining style, and avoid patterns.
 * Used by compile-prompt.ts (initial generation) and fix-placeholders.ts (replacement).
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DiningPriceRange {
  breakfast: [number, number]; // [min, max] per person in EUR
  lunch: [number, number];
  dinner: [number, number];
  drinks: [number, number];
}

export interface DiningConfig {
  priceRange: DiningPriceRange;
  michelinPolicy: 'required' | 'encouraged' | 'optional' | 'discouraged';
  michelinMinByTripLength: Record<number, number>; // tripDays -> minimum starred dinners
  diningStyle: string;
  avoidPatterns: string[];
}

// =============================================================================
// TIER-LEVEL DEFAULTS
// =============================================================================

const TIER_DINING_DEFAULTS: Record<string, DiningConfig> = {
  Explorer: {
    priceRange: {
      breakfast: [8, 25],
      lunch: [15, 45],
      dinner: [25, 70],
      drinks: [10, 30],
    },
    michelinPolicy: 'optional',
    michelinMinByTripLength: { 3: 0, 5: 0, 7: 0 },
    diningStyle: 'Authentic local restaurants, street food stalls, neighborhood joints, hidden gems where locals eat. Avoid tourist traps. Prioritize character and authenticity over prestige.',
    avoidPatterns: ['luxury hotel restaurant', 'palace dining', 'formal tasting menu'],
  },

  Connector: {
    priceRange: {
      breakfast: [10, 30],
      lunch: [20, 50],
      dinner: [30, 80],
      drinks: [12, 35],
    },
    michelinPolicy: 'optional',
    michelinMinByTripLength: { 3: 0, 5: 0, 7: 1 },
    diningStyle: 'Social, shareable dining experiences. Lively atmosphere, group-friendly restaurants, communal tables, family-style meals. Places that encourage conversation and connection.',
    avoidPatterns: ['ultra-formal', 'solo dining counter', 'silent/contemplative dining'],
  },

  Achiever: {
    priceRange: {
      breakfast: [15, 50],
      lunch: [30, 80],
      dinner: [60, 200],
      drinks: [20, 50],
    },
    michelinPolicy: 'encouraged',
    michelinMinByTripLength: { 3: 1, 5: 2, 7: 3 },
    diningStyle: 'Best-in-class restaurants, exclusive reservations, Michelin-starred dining, celebrity chef restaurants. Bucket-list caliber dining that feels like an achievement.',
    avoidPatterns: ['fast casual', 'chain restaurant', 'food court'],
  },

  Restorer: {
    priceRange: {
      breakfast: [12, 35],
      lunch: [20, 55],
      dinner: [35, 90],
      drinks: [10, 30],
    },
    michelinPolicy: 'optional',
    michelinMinByTripLength: { 3: 0, 5: 0, 7: 1 },
    diningStyle: 'Calm, unhurried dining. Farm-to-table, organic, wellness-focused restaurants. Places with gardens, terraces, or serene settings. No loud or hectic environments.',
    avoidPatterns: ['noisy brasserie', 'fast food', 'cramped/chaotic', 'nightclub dining'],
  },

  Curator: {
    priceRange: {
      breakfast: [15, 50],
      lunch: [30, 80],
      dinner: [60, 250],
      drinks: [15, 50],
    },
    michelinPolicy: 'encouraged',
    michelinMinByTripLength: { 3: 1, 5: 2, 7: 3 },
    diningStyle: 'Curated, refined dining experiences. Restaurants with history, design, or cultural significance. Distinctive spaces where the setting matters as much as the food.',
    avoidPatterns: ['generic chain', 'food court', 'unremarkable/anonymous venue'],
  },

  Transformer: {
    priceRange: {
      breakfast: [8, 30],
      lunch: [15, 50],
      dinner: [25, 80],
      drinks: [10, 30],
    },
    michelinPolicy: 'optional',
    michelinMinByTripLength: { 3: 0, 5: 0, 7: 0 },
    diningStyle: 'Dining with meaning and story. Home-hosted meals, cooking classes, restaurants run by social enterprises, family-owned for generations, or that represent a cultural tradition. Food as a window into the place.',
    avoidPatterns: ['generic tourist restaurant', 'luxury for luxury sake', 'impersonal/corporate'],
  },
};

// =============================================================================
// ARCHETYPE-LEVEL OVERRIDES (only where they differ from tier)
// =============================================================================

const ARCHETYPE_OVERRIDES: Record<string, Partial<DiningConfig>> = {
  // ── CURATOR tier overrides ──
  'The Luxury Luminary': {
    priceRange: { breakfast: [25, 75], lunch: [50, 120], dinner: [100, 350], drinks: [25, 60] },
    michelinPolicy: 'required',
    michelinMinByTripLength: { 3: 1, 5: 2, 7: 3 },
    diningStyle: 'Luxury fine dining. Michelin-starred restaurants, palace hotel dining rooms, iconic haute cuisine establishments. Every meal should feel elevated and refined.',
  },
  'The Culinary Cartographer': {
    priceRange: { breakfast: [15, 50], lunch: [30, 90], dinner: [50, 200], drinks: [15, 45] },
    michelinPolicy: 'required',
    michelinMinByTripLength: { 3: 1, 5: 2, 7: 4 },
    diningStyle: "Food IS the trip. Include the city's most acclaimed restaurants alongside hidden local gems. Food markets, cooking classes, wine/sake tastings. More dining activities per day than other archetypes. Prioritize food variety and range.",
  },
  'The Art Aficionado': {
    diningStyle: 'Restaurants in beautiful, design-forward spaces. Historic dining rooms, architect-designed interiors, restaurants inside museums or cultural venues. The aesthetic of the space matters.',
  },
  'The History Hunter': {
    diningStyle: 'Historic restaurants, the oldest café in the city, restaurants that have served famous figures, dining in medieval/colonial/historic buildings. Heritage and story come first.',
  },

  // ── ACHIEVER tier overrides ──
  'The VIP Voyager': {
    priceRange: { breakfast: [25, 75], lunch: [40, 100], dinner: [80, 350], drinks: [25, 60] },
    michelinPolicy: 'required',
    michelinMinByTripLength: { 3: 1, 5: 3, 7: 4 },
    diningStyle: "Exclusive, hard-to-get reservations. Michelin-starred, James Beard winners, World's 50 Best, celebrity chef restaurants. Omakase counters, chef's tables, private dining. The prestige and exclusivity is the point.",
  },
  'The Adrenaline Architect': {
    priceRange: { breakfast: [8, 20], lunch: [12, 35], dinner: [20, 60], drinks: [10, 30] },
    michelinPolicy: 'discouraged',
    diningStyle: 'Fuel for adventure. Quick, hearty, local meals. Street food, market stalls, casual outdoor dining. No long tasting menus — this traveler wants to get back to the action.',
  },

  // ── CONNECTOR tier overrides ──
  'The Family Architect': {
    priceRange: { breakfast: [10, 25], lunch: [15, 40], dinner: [25, 65], drinks: [8, 20] },
    michelinPolicy: 'discouraged',
    diningStyle: 'Family-friendly restaurants with something for everyone. Welcoming atmosphere, not too formal, ideally with outdoor space or room for kids. Kid-friendly menus or cuisine styles.',
    avoidPatterns: ['ultra-formal', 'tasting menu only', 'no children policy', 'late-night only'],
  },
  'The Romantic Curator': {
    priceRange: { breakfast: [15, 45], lunch: [25, 65], dinner: [50, 150], drinks: [15, 45] },
    michelinPolicy: 'encouraged',
    michelinMinByTripLength: { 3: 1, 5: 1, 7: 2 },
    diningStyle: 'Romantic, intimate dining. Candlelit restaurants, rooftop dining with views, wine bars with ambiance, waterfront tables. At least one special "date night" dinner per trip.',
  },

  // ── RESTORER tier overrides ──
  'The Wellness Devotee': {
    diningStyle: 'Wellness-focused dining. Organic, plant-forward, clean eating restaurants. Juice bars, ayurvedic cuisine, macrobiotic, raw food. Avoid heavy/rich cuisine.',
    avoidPatterns: ['steakhouse', 'fast food', 'heavy pub food', 'deep-fried focused'],
  },

  // ── EXPLORER tier overrides ──
  'The Wilderness Pioneer': {
    priceRange: { breakfast: [5, 15], lunch: [8, 25], dinner: [15, 45], drinks: [5, 20] },
    michelinPolicy: 'discouraged',
    diningStyle: 'Rustic, outdoorsy dining. Mountain lodges, campfire cooking, wilderness cafes, local rural restaurants. Nothing fancy — the setting is nature itself.',
  },
  'The Urban Nomad': {
    diningStyle: "The best of urban dining culture. Late-night ramen shops, rooftop bars, underground supper clubs, ethnic enclaves, food halls. The city's own food personality.",
  },
};

// =============================================================================
// MAIN EXPORT: Resolve dining config for a tier + archetype
// =============================================================================

export function getDiningConfig(tier: string, archetype: string): DiningConfig {
  const tierConfig = TIER_DINING_DEFAULTS[tier] || TIER_DINING_DEFAULTS['Explorer'];
  // Deep clone
  const config: DiningConfig = JSON.parse(JSON.stringify(tierConfig));

  const overrides = ARCHETYPE_OVERRIDES[archetype];
  if (overrides) {
    if (overrides.priceRange) config.priceRange = { ...config.priceRange, ...overrides.priceRange };
    if (overrides.michelinPolicy) config.michelinPolicy = overrides.michelinPolicy;
    if (overrides.michelinMinByTripLength) config.michelinMinByTripLength = overrides.michelinMinByTripLength;
    if (overrides.diningStyle) config.diningStyle = overrides.diningStyle;
    if (overrides.avoidPatterns) config.avoidPatterns = [...(config.avoidPatterns || []), ...overrides.avoidPatterns];
  }

  return config;
}

// =============================================================================
// HELPERS: Build prompt blocks from dining config
// =============================================================================

/**
 * Build the Michelin dining prompt block based on config + trip length.
 */
export function buildMichelinPromptBlock(
  config: DiningConfig,
  totalDays: number,
  destination: string,
): string {
  const { michelinPolicy, michelinMinByTripLength } = config;

  // Find the closest trip-length key
  const sortedKeys = Object.keys(michelinMinByTripLength).map(Number).sort((a, b) => a - b);
  let minCount = 0;
  for (const key of sortedKeys) {
    if (totalDays >= key) minCount = michelinMinByTripLength[key];
  }

  switch (michelinPolicy) {
    case 'discouraged':
      return `MICHELIN DINING: Do NOT include Michelin-starred restaurants for this traveler. Focus on authentic local eateries, street food, and casual dining.`;

    case 'optional':
      if (totalDays >= 5 && minCount > 0) {
        return `MICHELIN DINING (optional): You may include up to ${minCount} Michelin-starred dinner(s) across ${totalDays} days if it fits naturally. Price them correctly: 1-star €120-180/pp, 2-star €180-280/pp, 3-star €250-400/pp.`;
      }
      return `MICHELIN DINING: Michelin-starred restaurants are optional. Only include if it genuinely fits this traveler's style. If included, price correctly.`;

    case 'encouraged':
      return `MICHELIN DINING (encouraged):
For this ${totalDays}-day trip, aim to include at least ${minCount} Michelin-starred dinner(s) in ${destination || 'the destination'}.
- Price them at their actual tasting menu cost: 1-star €120-180/pp, 2-star €180-280/pp, 3-star €250-400/pp
- Spread across different days (never two starred dinners on the same day)
- It is BETTER to include a correctly-priced Michelin restaurant than to avoid them
- Only suggest restaurants you are confident actually exist`;

    case 'required':
      return `MICHELIN DINING (MANDATORY for this traveler):
This traveler EXPECTS fine dining. For this ${totalDays}-day trip, you MUST include at least ${minCount} Michelin-starred dinner(s) in ${destination || 'the destination'}.
- Price at actual tasting menu cost: 1-star €120-180/pp, 2-star €180-280/pp, 3-star €250-400/pp
- Include real addresses for all Michelin restaurants
- Spread across different days (never two starred dinners on the same day)
- Only suggest restaurants you are confident actually exist and hold the star rating
- Do NOT remove Michelin restaurants to avoid pricing issues — price them correctly instead`;

    default:
      return '';
  }
}

/**
 * Build the full dining personality prompt block.
 */
export function buildDiningPromptBlock(
  config: DiningConfig,
  totalDays: number,
  destination: string,
): string {
  const { priceRange, diningStyle, avoidPatterns } = config;

  const parts: string[] = [
    `DINING PERSONALITY (from traveler DNA):`,
    `Style: ${diningStyle}`,
  ];

  if (avoidPatterns.length > 0) {
    parts.push(`Dining to AVOID: ${avoidPatterns.join(', ')}`);
  }

  parts.push(
    `Price guidance per person: Breakfast €${priceRange.breakfast[0]}-${priceRange.breakfast[1]}, Lunch €${priceRange.lunch[0]}-${priceRange.lunch[1]}, Dinner €${priceRange.dinner[0]}-${priceRange.dinner[1]}, Drinks €${priceRange.drinks[0]}-${priceRange.drinks[1]}`,
  );

  parts.push(buildMichelinPromptBlock(config, totalDays, destination));

  return parts.join('\n');
}

/**
 * Build the Day 1 "Grand Entrance" dinner directive for luxury food audiences.
 * Returns null when the dining DNA does not warrant an elevated arrival dinner.
 */
export function buildGrandEntranceBlock(
  config: DiningConfig,
  destination: string,
): string | null {
  if (config.michelinPolicy !== 'required' && config.michelinPolicy !== 'encouraged') {
    return null;
  }
  const [, dinnerHi] = config.priceRange.dinner;
  const lo = Math.round(dinnerHi * 0.7);
  return `
🌟 DAY 1 "GRAND ENTRANCE" DINNER — REQUIRED:
This traveler's first dinner sets the tone for the trip. It MUST be an elevated, destination-defining restaurant — NOT a casual bistro, brasserie, or neighborhood steak-frites house.
- Choose a Michelin-starred dining room, palace-hotel restaurant, or iconic chef-led tasting venue in ${destination || 'the destination'}
- Target price: €${lo}–€${dinnerHi}/pp (tasting menu or chef-driven prix fixe)
- Even if Day 1 lunch is intentionally casual/authentic, the dinner MUST compensate by being elevated
- Tag this activity with: tags: ["grand_entrance", "signature_meal"]
- Reservation note in description: "Book 2–4 weeks ahead"
- Do NOT pick: Le Comptoir du Relais, Le Relais de l'Entrecôte, Bouillon Chartier, Chez Janou, or any similar bistro/brasserie for THIS dinner`;
}

/**
 * Build the Day 1 "Arrival Cultural Anchor" directive — a sibling rule to the
 * Grand Entrance Dinner. Ensures luxury food audiences get a second iconic
 * experiential beat on arrival day (terrace champagne, golden-hour walk,
 * late-open landmark) so Day 1 isn't just one museum + meals.
 */
export function buildArrivalCulturalAnchorBlock(
  config: DiningConfig,
  destination: string,
): string | null {
  if (config.michelinPolicy !== 'required' && config.michelinPolicy !== 'encouraged') {
    return null;
  }
  return `
🌟 DAY 1 "ARRIVAL CULTURAL ANCHOR" — REQUIRED:
In addition to any morning/early-afternoon cultural stop, Day 1 MUST include ONE more iconic, sensory, destination-defining experience scheduled in the late afternoon or early evening (≈16:00–18:30), BEFORE the Grand Entrance Dinner.
- 60–90 minutes, real named venue in ${destination || 'the destination'} (no placeholders, no generic "explore the area")
- Pick ONE archetype that fits ${destination || 'the destination'}:
  • Golden-hour walk along an iconic waterway / boulevard / viewpoint (e.g. Seine quais, Trocadéro, Pont Alexandre III, riverside promenade)
  • Champagne / signature cocktail at a landmark hotel bar, rooftop, or palace terrace
  • Quick visit to a flagship cultural building open late (Grand Palais, contemporary art foundation, gallery district stroll)
  • Sensory / scenic ritual unique to the destination (covered passages, historic arcade, observation deck at sunset)
- Cost: free–€60/pp; this does NOT replace lunch or dinner and is NOT counted as a meal
- Tag this activity with: tags: ["arrival_anchor"]
- Description should evoke arrival-day magic in 1–2 sentences`;
}
