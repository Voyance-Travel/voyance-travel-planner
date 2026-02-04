/**
 * Static Destination Templates - Zero-Cost Free Tier
 * 
 * Pre-written trip structures that cost $0 to serve (no AI, no API calls).
 * These replace AI-generated previews for free users to cut acquisition costs.
 * 
 * Each template provides:
 * - Day themes and neighborhoods
 * - Time block activities (generic descriptions)
 * - DNA-aligned teasers
 * 
 * Free users see structure and vibe, paid users get real venues.
 */

export interface TemplateTimeBlock {
  period: 'morning' | 'afternoon' | 'evening';
  activityType: string;
  teaser: string;
  dnaAlignment?: string;
}

export interface TemplateDay {
  dayNumber: number;
  title: string;
  theme: string;
  neighborhood: string;
  timeBlocks: TemplateTimeBlock[];
}

export interface DestinationTemplate {
  destination: string;
  country: string;
  region?: string;
  totalDays: number;
  days: TemplateDay[];
  highlights: string[];
  dnaCallouts: string[];
  bestFor: string[];
  seasonalNotes?: string;
}

// ============================================
// JAPAN
// ============================================

export const TOKYO_TEMPLATE: DestinationTemplate = {
  destination: 'Tokyo',
  country: 'Japan',
  totalDays: 5,
  bestFor: ['First-time Japan visitors', 'Food lovers', 'Pop culture enthusiasts'],
  days: [
    {
      dayNumber: 1,
      title: 'Arrival & East Side Immersion',
      theme: 'Traditional Tokyo',
      neighborhood: 'Asakusa',
      timeBlocks: [
        { period: 'afternoon', activityType: 'arrival', teaser: 'Settle into your neighborhood and get your bearings' },
        { period: 'evening', activityType: 'dining', teaser: 'A legendary tempura spot tucked in a narrow alley', dnaAlignment: 'Authentic local cuisine' },
      ],
    },
    {
      dayNumber: 2,
      title: 'Shibuya & Harajuku Energy',
      theme: 'Modern Tokyo',
      neighborhood: 'Shibuya / Harajuku',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'A serene shrine hidden behind the fashion district' },
        { period: 'afternoon', activityType: 'exploration', teaser: 'The crossing, the shops, the energy of modern Tokyo' },
        { period: 'evening', activityType: 'dining', teaser: 'An intimate omakase counter the tourists miss', dnaAlignment: 'Premium dining experience' },
      ],
    },
    {
      dayNumber: 3,
      title: 'Old Meets New',
      theme: 'Contrast Day',
      neighborhood: 'Ginza / Tsukiji',
      timeBlocks: [
        { period: 'morning', activityType: 'food', teaser: 'The outer market where chefs shop for breakfast' },
        { period: 'afternoon', activityType: 'cultural', teaser: 'World-class art in an architectural masterpiece' },
        { period: 'evening', activityType: 'dining', teaser: 'A yakitori master with a decades-long waitlist', dnaAlignment: 'Bucket-list dining' },
      ],
    },
    {
      dayNumber: 4,
      title: 'Day Trip: Ancient Capital',
      theme: 'Temples & Gardens',
      neighborhood: 'Kamakura',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'The great bronze buddha and coastal shrines' },
        { period: 'afternoon', activityType: 'exploration', teaser: 'Zen gardens and bamboo groves away from the crowds' },
        { period: 'evening', activityType: 'dining', teaser: 'Back to Tokyo for a late-night ramen pilgrimage' },
      ],
    },
    {
      dayNumber: 5,
      title: 'Hidden Gems & Departure',
      theme: 'Local Favorites',
      neighborhood: 'Shimokitazawa / Nakameguro',
      timeBlocks: [
        { period: 'morning', activityType: 'exploration', teaser: 'The neighborhoods where creative Tokyo actually lives' },
        { period: 'afternoon', activityType: 'shopping', teaser: 'Vintage finds and artisan coffee before you go' },
      ],
    },
  ],
  highlights: [
    'A sunrise experience the tourist buses never see',
    'The neighborhood where Tokyo chefs eat on their nights off',
    'A 7-seat counter with a 6-month waitlist (we know people)',
    'The shrine gate that glows at golden hour',
  ],
  dnaCallouts: [
    'Timed around your preferred late-morning starts',
    'Balances deep culture with the foodie experiences you crave',
    'Built-in breathing room between activities',
  ],
};

export const KYOTO_TEMPLATE: DestinationTemplate = {
  destination: 'Kyoto',
  country: 'Japan',
  totalDays: 4,
  bestFor: ['Temple seekers', 'Traditional culture', 'Peaceful pace'],
  days: [
    {
      dayNumber: 1,
      title: 'Arrival & Gion Discovery',
      theme: 'Geisha District',
      neighborhood: 'Gion',
      timeBlocks: [
        { period: 'afternoon', activityType: 'arrival', teaser: 'Check into a traditional machiya townhouse' },
        { period: 'evening', activityType: 'exploration', teaser: 'Lantern-lit streets where geiko still walk', dnaAlignment: 'Immersive cultural experience' },
      ],
    },
    {
      dayNumber: 2,
      title: 'Temple Circuit',
      theme: 'Sacred Kyoto',
      neighborhood: 'Higashiyama',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'The golden pavilion at sunrise, crowds-free' },
        { period: 'afternoon', activityType: 'cultural', teaser: 'A thousand vermillion gates winding up the mountain' },
        { period: 'evening', activityType: 'dining', teaser: 'Multi-course kaiseki in a 200-year-old restaurant' },
      ],
    },
    {
      dayNumber: 3,
      title: 'Arashiyama Escape',
      theme: 'Bamboo & Gardens',
      neighborhood: 'Arashiyama',
      timeBlocks: [
        { period: 'morning', activityType: 'nature', teaser: 'The bamboo grove before the tour groups arrive' },
        { period: 'afternoon', activityType: 'cultural', teaser: 'A moss garden that took 120 years to perfect' },
        { period: 'evening', activityType: 'dining', teaser: 'River-view tofu cuisine by candlelight' },
      ],
    },
    {
      dayNumber: 4,
      title: 'Tea & Departure',
      theme: 'Mindful Morning',
      neighborhood: 'Central Kyoto',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'Private tea ceremony with a 15th-generation master' },
        { period: 'afternoon', activityType: 'shopping', teaser: 'Traditional crafts and artisan sweets for the journey' },
      ],
    },
  ],
  highlights: [
    'A private garden viewing most visitors never know exists',
    'The temple that inspired a thousand photographs',
    'A tea master who taught for the imperial family',
  ],
  dnaCallouts: [
    'Designed for contemplative exploration, not rushed sightseeing',
    'Evenings built around exceptional dining experiences',
  ],
};

// ============================================
// EUROPE
// ============================================

export const PARIS_TEMPLATE: DestinationTemplate = {
  destination: 'Paris',
  country: 'France',
  totalDays: 5,
  bestFor: ['Art lovers', 'Romantic getaways', 'Culinary explorers'],
  days: [
    {
      dayNumber: 1,
      title: 'Arrival & Left Bank Magic',
      theme: 'Literary Paris',
      neighborhood: 'Saint-Germain-des-Prés',
      timeBlocks: [
        { period: 'afternoon', activityType: 'arrival', teaser: 'Settle into your arrondissement, find your café' },
        { period: 'evening', activityType: 'dining', teaser: 'A candlelit bistro that hasn\'t changed since 1920', dnaAlignment: 'Classic French experience' },
      ],
    },
    {
      dayNumber: 2,
      title: 'Icons Without the Crowds',
      theme: 'Museum Day',
      neighborhood: 'Louvre / Tuileries',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'The world\'s greatest museum, through the secret entrance' },
        { period: 'afternoon', activityType: 'exploration', teaser: 'Garden strolls and patisserie hunting' },
        { period: 'evening', activityType: 'dining', teaser: 'A Michelin star in a neighborhood no one mentions' },
      ],
    },
    {
      dayNumber: 3,
      title: 'Montmartre & Hidden Paris',
      theme: 'Village Vibes',
      neighborhood: 'Montmartre',
      timeBlocks: [
        { period: 'morning', activityType: 'exploration', teaser: 'Cobblestones, vineyards, and the artists\' quarter' },
        { period: 'afternoon', activityType: 'cultural', teaser: 'A museum in a former train station' },
        { period: 'evening', activityType: 'dining', teaser: 'Natural wine and small plates in the 10th' },
      ],
    },
    {
      dayNumber: 4,
      title: 'Le Marais & Beyond',
      theme: 'Cool Paris',
      neighborhood: 'Le Marais',
      timeBlocks: [
        { period: 'morning', activityType: 'food', teaser: 'The best croissant in Paris (we have opinions)' },
        { period: 'afternoon', activityType: 'shopping', teaser: 'Concept stores and hidden courtyards' },
        { period: 'evening', activityType: 'dining', teaser: 'A 10-seat omakase proving Paris does everything' },
      ],
    },
    {
      dayNumber: 5,
      title: 'Morning Light & Au Revoir',
      theme: 'Golden Hour',
      neighborhood: 'Across Paris',
      timeBlocks: [
        { period: 'morning', activityType: 'exploration', teaser: 'The iron tower at sunrise, your private moment' },
        { period: 'afternoon', activityType: 'shopping', teaser: 'Final macarons and market finds' },
      ],
    },
  ],
  highlights: [
    'A bakery that opens at 6am with a line around the block',
    'The café where existentialism was invented',
    'A dinner reservation that usually requires six months notice',
  ],
  dnaCallouts: [
    'Built around exceptional dining experiences',
    'Neighborhood-based to avoid tourist traps',
    'Balanced museum time with wandering time',
  ],
};

export const ROME_TEMPLATE: DestinationTemplate = {
  destination: 'Rome',
  country: 'Italy',
  totalDays: 4,
  bestFor: ['History buffs', 'Food obsessives', 'Architecture lovers'],
  days: [
    {
      dayNumber: 1,
      title: 'Arrival & Centro Storico',
      theme: 'Ancient Meets Living',
      neighborhood: 'Centro Storico',
      timeBlocks: [
        { period: 'afternoon', activityType: 'arrival', teaser: 'Your hotel is steps from a 2,000-year-old temple' },
        { period: 'evening', activityType: 'dining', teaser: 'Cacio e pepe where the recipe hasn\'t changed in 150 years' },
      ],
    },
    {
      dayNumber: 2,
      title: 'The Colosseum & Forums',
      theme: 'Imperial Rome',
      neighborhood: 'Ancient Rome',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'Underground access to where gladiators waited' },
        { period: 'afternoon', activityType: 'cultural', teaser: 'Walking where Julius Caesar walked' },
        { period: 'evening', activityType: 'dining', teaser: 'A trattoria in Trastevere that seats 20', dnaAlignment: 'Authentic Roman experience' },
      ],
    },
    {
      dayNumber: 3,
      title: 'Vatican & Hidden Gems',
      theme: 'Sacred Art',
      neighborhood: 'Vatican / Prati',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'The Sistine Chapel before the crowds' },
        { period: 'afternoon', activityType: 'exploration', teaser: 'A neighborhood the guidebooks forgot' },
        { period: 'evening', activityType: 'dining', teaser: 'Supplì and wine in a Roman garden' },
      ],
    },
    {
      dayNumber: 4,
      title: 'Morning Markets & Arrivederci',
      theme: 'Living Rome',
      neighborhood: 'Campo de\' Fiori / Testaccio',
      timeBlocks: [
        { period: 'morning', activityType: 'food', teaser: 'The market where Roman grandmothers shop' },
        { period: 'afternoon', activityType: 'cultural', teaser: 'One last espresso at a bar from 1900' },
      ],
    },
  ],
  highlights: [
    'Access to areas the general tickets don\'t include',
    'The carbonara that ruined all other carbonara for us',
    'A sunset view from a terrace no one posts about',
  ],
  dnaCallouts: [
    'Structured for morning people (cooler, quieter)',
    'Every meal is an experience, not an afterthought',
  ],
};

// ============================================
// ASIA
// ============================================

export const BANGKOK_TEMPLATE: DestinationTemplate = {
  destination: 'Bangkok',
  country: 'Thailand',
  totalDays: 4,
  bestFor: ['Street food adventurers', 'Temple seekers', 'Night owls'],
  days: [
    {
      dayNumber: 1,
      title: 'Arrival & Chinatown Feast',
      theme: 'Street Food Introduction',
      neighborhood: 'Yaowarat (Chinatown)',
      timeBlocks: [
        { period: 'afternoon', activityType: 'arrival', teaser: 'Rest and acclimatize to the tropical heat' },
        { period: 'evening', activityType: 'food', teaser: 'The street food crawl that made Anthony Bourdain cry', dnaAlignment: 'Legendary food experiences' },
      ],
    },
    {
      dayNumber: 2,
      title: 'Temples & River Life',
      theme: 'Royal Bangkok',
      neighborhood: 'Rattanakosin',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'The reclining Buddha, 46 meters of gold' },
        { period: 'afternoon', activityType: 'exploration', teaser: 'Longtail boats through canals time forgot' },
        { period: 'evening', activityType: 'dining', teaser: 'A rooftop with views worth every baht' },
      ],
    },
    {
      dayNumber: 3,
      title: 'Modern Bangkok',
      theme: 'The New City',
      neighborhood: 'Sukhumvit / Thonglor',
      timeBlocks: [
        { period: 'morning', activityType: 'food', teaser: 'Coffee culture that rivals Melbourne' },
        { period: 'afternoon', activityType: 'cultural', teaser: 'Contemporary art in a converted warehouse' },
        { period: 'evening', activityType: 'dining', teaser: 'A Thai tasting menu earning global awards', dnaAlignment: 'Modern Thai fine dining' },
      ],
    },
    {
      dayNumber: 4,
      title: 'Markets & Departure',
      theme: 'Local Rhythms',
      neighborhood: 'Chatuchak / Various',
      timeBlocks: [
        { period: 'morning', activityType: 'shopping', teaser: 'The weekend market with 15,000 stalls' },
        { period: 'afternoon', activityType: 'relaxation', teaser: 'A Thai massage before your flight' },
      ],
    },
  ],
  highlights: [
    'A noodle stall with a Michelin star',
    'The temple viewpoint that\'s actually worth the stairs',
    'Late-night eats that put your home city to shame',
  ],
  dnaCallouts: [
    'Mornings start late (it\'s too hot otherwise)',
    'Built for adventurous eaters',
    'Balance of chaos and calm',
  ],
};

// ============================================
// AMERICAS
// ============================================

export const NYC_TEMPLATE: DestinationTemplate = {
  destination: 'New York City',
  country: 'USA',
  region: 'New York',
  totalDays: 5,
  bestFor: ['First-timers', 'Foodies', 'Culture seekers'],
  days: [
    {
      dayNumber: 1,
      title: 'Arrival & Downtown Energy',
      theme: 'Manhattan Introduction',
      neighborhood: 'Lower Manhattan / SoHo',
      timeBlocks: [
        { period: 'afternoon', activityType: 'arrival', teaser: 'Drop bags and hit the streets immediately' },
        { period: 'evening', activityType: 'dining', teaser: 'A reservation-only speakeasy you\'d never find alone' },
      ],
    },
    {
      dayNumber: 2,
      title: 'Icons Done Right',
      theme: 'Classic NYC',
      neighborhood: 'Midtown',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'The museum collection that takes a lifetime to see' },
        { period: 'afternoon', activityType: 'exploration', teaser: 'The park that somehow exists in the middle of it all' },
        { period: 'evening', activityType: 'cultural', teaser: 'A Broadway show you actually want to see' },
      ],
    },
    {
      dayNumber: 3,
      title: 'Brooklyn & the Bridge',
      theme: 'The Other Side',
      neighborhood: 'Brooklyn (DUMBO / Williamsburg)',
      timeBlocks: [
        { period: 'morning', activityType: 'food', teaser: 'The pizza slice that changed everything' },
        { period: 'afternoon', activityType: 'exploration', teaser: 'The best skyline views are from across the water' },
        { period: 'evening', activityType: 'dining', teaser: 'A tasting menu in a converted warehouse' },
      ],
    },
    {
      dayNumber: 4,
      title: 'Neighborhoods & Hidden Gems',
      theme: 'Real New York',
      neighborhood: 'West Village / East Village',
      timeBlocks: [
        { period: 'morning', activityType: 'food', teaser: 'Brunch where the wait is worth it' },
        { period: 'afternoon', activityType: 'shopping', teaser: 'Record shops and vintage that aren\'t played out' },
        { period: 'evening', activityType: 'dining', teaser: 'The tiny restaurant with the impossible reservation', dnaAlignment: 'NYC dining at its finest' },
      ],
    },
    {
      dayNumber: 5,
      title: 'Morning Light & Goodbye',
      theme: 'One Last Walk',
      neighborhood: 'High Line / Chelsea',
      timeBlocks: [
        { period: 'morning', activityType: 'exploration', teaser: 'The elevated park at golden hour' },
        { period: 'afternoon', activityType: 'food', teaser: 'One last bagel for the road' },
      ],
    },
  ],
  highlights: [
    'A speakeasy that changes the password nightly',
    'The rooftop bar that locals actually use',
    'A reservation that normally takes 3 months',
  ],
  dnaCallouts: [
    'Neighborhood-focused to avoid tourist traps',
    'Restaurants chosen for both food and vibe',
    'Built-in recovery time between activities',
  ],
};

export const MEXICO_CITY_TEMPLATE: DestinationTemplate = {
  destination: 'Mexico City',
  country: 'Mexico',
  totalDays: 4,
  bestFor: ['Art lovers', 'Taco obsessives', 'Architecture buffs'],
  days: [
    {
      dayNumber: 1,
      title: 'Arrival & Roma Norte',
      theme: 'Trendy CDMX',
      neighborhood: 'Roma Norte',
      timeBlocks: [
        { period: 'afternoon', activityType: 'arrival', teaser: 'Settle into the tree-lined streets and art deco buildings' },
        { period: 'evening', activityType: 'dining', teaser: 'Mezcal and small plates at a neighborhood institution' },
      ],
    },
    {
      dayNumber: 2,
      title: 'Frida, Diego & Beyond',
      theme: 'Art Day',
      neighborhood: 'Coyoacán',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'The blue house where Frida painted pain into art' },
        { period: 'afternoon', activityType: 'exploration', teaser: 'Cobblestone streets and the best churros in the city' },
        { period: 'evening', activityType: 'dining', teaser: 'A tasting menu redefining Mexican cuisine', dnaAlignment: 'World-class dining' },
      ],
    },
    {
      dayNumber: 3,
      title: 'Centro Histórico',
      theme: 'Ancient & Colonial',
      neighborhood: 'Centro Histórico',
      timeBlocks: [
        { period: 'morning', activityType: 'cultural', teaser: 'The ruins the Spanish built a cathedral on top of' },
        { period: 'afternoon', activityType: 'cultural', teaser: 'Rivera murals that take your breath away' },
        { period: 'evening', activityType: 'food', teaser: 'A taco crawl through cantinas since 1870' },
      ],
    },
    {
      dayNumber: 4,
      title: 'Markets & Mezcal',
      theme: 'Local Life',
      neighborhood: 'Condesa / Markets',
      timeBlocks: [
        { period: 'morning', activityType: 'food', teaser: 'The market where chefs go before dawn' },
        { period: 'afternoon', activityType: 'shopping', teaser: 'Crafts, textiles, and folk art to bring home' },
      ],
    },
  ],
  highlights: [
    'A mezcalería with 400 bottles and a knowledgeable bartender',
    'The taco al pastor that ruined all others for us',
    'A courtyard garden hidden behind an unmarked door',
  ],
  dnaCallouts: [
    'Built for adventurous eaters',
    'Art and food woven together, not separated',
  ],
};

// ============================================
// TEMPLATE REGISTRY
// ============================================

export const DESTINATION_TEMPLATES: Record<string, DestinationTemplate> = {
  'tokyo': TOKYO_TEMPLATE,
  'kyoto': KYOTO_TEMPLATE,
  'paris': PARIS_TEMPLATE,
  'rome': ROME_TEMPLATE,
  'bangkok': BANGKOK_TEMPLATE,
  'new york': NYC_TEMPLATE,
  'new york city': NYC_TEMPLATE,
  'nyc': NYC_TEMPLATE,
  'mexico city': MEXICO_CITY_TEMPLATE,
  'cdmx': MEXICO_CITY_TEMPLATE,
};

/**
 * Get a static template for a destination (case-insensitive)
 * Returns null if no template exists (fallback to AI-generated preview)
 */
export function getDestinationTemplate(destination: string): DestinationTemplate | null {
  const key = destination.toLowerCase().trim();
  return DESTINATION_TEMPLATES[key] || null;
}

/**
 * Check if a destination has a static template available
 */
export function hasStaticTemplate(destination: string): boolean {
  return getDestinationTemplate(destination) !== null;
}

/**
 * Get all available destination names with templates
 */
export function getTemplateDestinations(): string[] {
  return [...new Set(Object.values(DESTINATION_TEMPLATES).map(t => t.destination))];
}
