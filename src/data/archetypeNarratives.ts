/**
 * Travel Archetype Narratives - Horoscope-style emotional copy
 * Based on docs/TRAVEL_ARCHETYPES.md
 * 
 * ARCHETYPE CATEGORIES:
 * - EXPLORER: Curiosity-driven travelers who seek discovery and adventure
 * - CONNECTOR: Relationship-focused travelers who prioritize shared experiences
 * - ACHIEVER: Goal-oriented travelers who collect experiences and accomplishments
 * - RESTORER: Wellness-focused travelers seeking peace and rejuvenation
 * - CURATOR: Quality-focused travelers who appreciate refined experiences
 * - TRANSFORMER: Growth-focused travelers seeking personal development
 * 
 * HOW ARCHETYPES ARE DETERMINED:
 * The Travel DNA engine scores users across 8 core traits based on quiz responses:
 * - Planning (detailed vs spontaneous)
 * - Social (solo vs group-oriented)
 * - Comfort (budget vs luxury)
 * - Pace (relaxed vs active)
 * - Authenticity (tourist vs local experience)
 * - Adventure (safe vs thrill-seeking)
 * - Budget (cost-conscious vs premium)
 * - Transformation (routine vs growth-seeking)
 * 
 * Each archetype has minimum trait requirements and weights.
 * The engine matches your trait scores to find your primary and secondary archetypes.
 */

export interface ArchetypeNarrative {
  id: string;
  name: string;
  category: 'EXPLORER' | 'CONNECTOR' | 'ACHIEVER' | 'RESTORER' | 'CURATOR' | 'TRANSFORMER';
  hookLine: string;
  coreDescription: string;
  whatThisMeans: string[];
  superpowers: string[];
  growthEdges: string[];
  perfectTripPreview: string;
  emoji: string;
  /** Lucide icon name for this archetype's category */
  iconName?: string;
}

export const CATEGORY_COLORS = {
  EXPLORER: {
    primary: 'from-teal-500 to-orange-400',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
    iconName: 'Compass' as const,
  },
  CONNECTOR: {
    primary: 'from-rose-400 to-amber-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    iconName: 'Users' as const,
  },
  ACHIEVER: {
    primary: 'from-purple-500 to-blue-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    iconName: 'Trophy' as const,
  },
  RESTORER: {
    primary: 'from-green-400 to-violet-400',
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    iconName: 'Leaf' as const,
  },
  CURATOR: {
    primary: 'from-rose-700 to-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    iconName: 'Gem' as const,
  },
  TRANSFORMER: {
    primary: 'from-indigo-500 to-orange-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    iconName: 'Sparkles' as const,
  },
};

/** Category descriptions for the expandable documentation section */
export const CATEGORY_DESCRIPTIONS = {
  EXPLORER: {
    name: 'Explorer',
    description: 'Curiosity-driven travelers who seek discovery, adventure, and authentic experiences. You thrive when uncovering hidden gems and off-the-beaten-path destinations.',
    keyTraits: ['High adventure', 'High authenticity', 'Flexible planning'],
  },
  CONNECTOR: {
    name: 'Connector',
    description: 'Relationship-focused travelers who prioritize shared experiences and building bonds through travel. Every trip is an opportunity to strengthen connections.',
    keyTraits: ['High social', 'Balanced comfort', 'Group-oriented'],
  },
  ACHIEVER: {
    name: 'Achiever',
    description: 'Goal-oriented travelers who collect experiences and accomplishments. You approach travel with purpose and love checking destinations off your list.',
    keyTraits: ['Active pace', 'High adventure', 'Detailed planning'],
  },
  RESTORER: {
    name: 'Restorer',
    description: 'Wellness-focused travelers seeking peace, rejuvenation, and balance. Travel is your reset button—a way to recharge and return refreshed.',
    keyTraits: ['Relaxed pace', 'High comfort', 'Wellness-focused'],
  },
  CURATOR: {
    name: 'Curator',
    description: 'Quality-focused travelers who appreciate refined, curated experiences. You seek excellence in every detail, from accommodations to dining.',
    keyTraits: ['High comfort', 'Premium budget', 'Detailed planning'],
  },
  TRANSFORMER: {
    name: 'Transformer',
    description: 'Growth-focused travelers seeking personal development and transformation. You travel to evolve, learn, and return home as a better version of yourself.',
    keyTraits: ['High transformation', 'High authenticity', 'Open to change'],
  },
};

export const ARCHETYPE_NARRATIVES: Record<string, ArchetypeNarrative> = {
  cultural_anthropologist: {
    id: 'cultural_anthropologist',
    name: 'The Cultural Anthropologist',
    category: 'EXPLORER',
    hookLine: "You don't just visit places, you become them.",
    coreDescription: "While others see monuments, you see meaning. Your travels are doctoral dissertations in humanity, written in small cafés and local markets. You speak the universal language of curiosity.",
    whatThisMeans: [
      "You value authentic connections over tourist attractions",
      "You learn basic phrases in every language you encounter",
      "You'd rather eat street food with locals than dine alone in luxury",
      "You keep journals full of human stories, not just places"
    ],
    superpowers: [
      "Building bridges across cultural divides",
      "Finding extraordinary in ordinary moments",
      "Creating connections that transcend language"
    ],
    growthEdges: [
      "Sometimes comfort has its place too",
      "Not every meal needs a story",
      "Fellow travelers have wisdom to share"
    ],
    perfectTripPreview: "30 days in Morocco, speaking Arabic by week two, invited to three family dinners, leaving with recipes and lifelong friends.",
    emoji: "🌍"
  },
  urban_nomad: {
    id: 'urban_nomad',
    name: 'The Urban Nomad',
    category: 'EXPLORER',
    hookLine: "Cities speak to you in neon and noise.",
    coreDescription: "You thrive in the pulse of urban life. Every city has a rhythm, and you've learned to dance to them all. From Tokyo's organized chaos to Barcelona's late-night whispers, you find home in the concrete jungle.",
    whatThisMeans: [
      "You discover hidden rooftop bars before they're famous",
      "Public transit is your preferred adventure vehicle",
      "You judge cities by their coffee culture",
      "Street art tours excite you more than museums"
    ],
    superpowers: [
      "Navigating any metro system within hours",
      "Finding the 'real' neighborhood in any city",
      "Making friends at dive bars worldwide"
    ],
    growthEdges: [
      "Nature has its own kind of energy",
      "Small towns hold unexpected magic",
      "Sometimes silence is the destination"
    ],
    perfectTripPreview: "A month split between Seoul, Tokyo, and Singapore, working from cafés, exploring night markets, and building a network of local friends.",
    emoji: "🏙️"
  },
  wilderness_pioneer: {
    id: 'wilderness_pioneer',
    name: 'The Wilderness Pioneer',
    category: 'EXPLORER',
    hookLine: "WiFi is optional, wilderness is essential.",
    coreDescription: "You measure distance in days from civilization, not kilometers. The further from beaten paths, the closer to yourself. Mountains don't scare you. Crowds do.",
    whatThisMeans: [
      "You pack light but always bring the right gear",
      "Sunrise is your favorite meeting time",
      "You've slept under more stars than roofs",
      "Trail markers are suggestions, not rules"
    ],
    superpowers: [
      "Finding peace in challenging conditions",
      "Reading nature's subtle signs",
      "Self-reliance in any environment"
    ],
    growthEdges: [
      "Some luxuries enhance the experience",
      "Guided tours offer local wisdom",
      "Sharing the trail creates bonds"
    ],
    perfectTripPreview: "Two weeks in Patagonia, tent on your back, no reservations, just you, the wind, and endless horizon.",
    emoji: "⛰️"
  },
  zen_seeker: {
    id: 'zen_seeker',
    name: 'The Zen Seeker',
    category: 'RESTORER',
    hookLine: "Breathe in experience, exhale expectation.",
    coreDescription: "Your passport is a prescription for peace. You travel to untangle, not to collect. Every destination is a meditation, every journey an act of self-care.",
    whatThisMeans: [
      "You choose destinations by their energy, not their attractions",
      "Spa menus excite you more than restaurant menus",
      "You've tried yoga on multiple continents",
      "Silence is your favorite sound"
    ],
    superpowers: [
      "Finding stillness in any chaos",
      "Returning home better than you left",
      "Transforming travel stress into travel bliss"
    ],
    growthEdges: [
      "Adventure can be restorative too",
      "Some of the best experiences are unplanned",
      "Connection with others feeds the soul"
    ],
    perfectTripPreview: "A silent retreat in Bali, followed by daily yoga, sound healing sessions, and returning home feeling like a new person.",
    emoji: "🧘"
  },
  culinary_cartographer: {
    id: 'culinary_cartographer',
    name: 'The Culinary Cartographer',
    category: 'CURATOR',
    hookLine: "Your passport is basically a menu.",
    coreDescription: "You eat your way through every destination. Food isn't fuel, it's the reason you travel. You've planned entire trips around a single restaurant reservation.",
    whatThisMeans: [
      "You research restaurants before booking flights",
      "Market visits are non-negotiable",
      "You've taken cooking classes on every continent",
      "Street food vendors know you by name"
    ],
    superpowers: [
      "Finding the authentic local spot every time",
      "Bridging cultures through shared meals",
      "Turning every meal into a memory"
    ],
    growthEdges: [
      "Some experiences happen between meals",
      "Not every meal needs to be Instagram-worthy",
      "Sometimes the hotel breakfast is fine"
    ],
    perfectTripPreview: "Ten days in Japan, hitting Michelin stars and hole-in-the-wall ramen shops alike, with a sushi-making class in Tsukiji and a sake tasting in Kyoto.",
    emoji: "🍜"
  },
  luxury_luminary: {
    id: 'luxury_luminary',
    name: 'The Luxury Luminary',
    category: 'CURATOR',
    hookLine: "Champagne wishes, caviar dreams, economy never.",
    coreDescription: "You don't travel, you curate experiences. Every detail matters, from thread count to tasting menus. Life's too short for ordinary, and your trips prove it.",
    whatThisMeans: [
      "You have a preferred suite at hotels worldwide",
      "Concierge staff know your preferences",
      "You plan arrivals around golden hour",
      "The journey is as important as the destination"
    ],
    superpowers: [
      "Elevating any experience to its highest form",
      "Creating flawless, stress-free travel",
      "Knowing quality without being told"
    ],
    growthEdges: [
      "Authenticity sometimes hides in humble places",
      "The best stories come from unexpected detours",
      "Connection matters more than comfort"
    ],
    perfectTripPreview: "The Amalfi Coast by private yacht, Aman Tokyo suite, Necker Island for New Year's, because life is the ultimate luxury.",
    emoji: "✨"
  },
  family_architect: {
    id: 'family_architect',
    name: 'The Family Architect',
    category: 'CONNECTOR',
    hookLine: "Making memories that outlive photo albums.",
    coreDescription: "You design experiences that bring generations together. Travel is your tool for building family bonds that last. Every trip is a chapter in your family's story.",
    whatThisMeans: [
      "You plan with everyone's needs in mind",
      "Safety and joy are your top priorities",
      "You create traditions through travel",
      "Kid-friendly doesn't mean boring to you"
    ],
    superpowers: [
      "Keeping everyone happy simultaneously",
      "Finding magic in family moments",
      "Creating stories that get retold for years"
    ],
    growthEdges: [
      "Solo adventures recharge your spirit",
      "Sometimes adults need adult-only time",
      "Imperfect trips make perfect memories"
    ],
    perfectTripPreview: "Multi-generational villa in Tuscany, cooking classes for grandma, pool time for kids, wine tasting for the adults, and dinner together under the stars.",
    emoji: "👨‍👩‍👧‍👦"
  },
  adrenaline_architect: {
    id: 'adrenaline_architect',
    name: 'The Adrenaline Architect',
    category: 'ACHIEVER',
    hookLine: "Normal is just a setting on the washing machine.",
    coreDescription: "You collect experiences that make your heart race. Comfort zones are for other people. You travel to feel alive in the most visceral way possible.",
    whatThisMeans: [
      "Your bucket list includes heights, depths, and speeds",
      "You've signed more waivers than postcards",
      "Recovery days are for planning the next adventure",
      "You measure trips in adrenaline spikes"
    ],
    superpowers: [
      "Turning fear into fuel",
      "Inspiring others to push their limits",
      "Finding the extraordinary in extreme"
    ],
    growthEdges: [
      "Stillness can be its own adventure",
      "Sometimes the best views require no risk",
      "Recovery is part of the journey"
    ],
    perfectTripPreview: "New Zealand: bungee jumping in Queenstown, skydiving over glaciers, heli-skiing, and finishing with a cliff dive into crystal-clear waters.",
    emoji: "🪂"
  },
  slow_traveler: {
    id: 'slow_traveler',
    name: 'The Slow Traveler',
    category: 'RESTORER',
    hookLine: "Stay long enough to have a favorite café.",
    coreDescription: "You resist the urge to rush. While others check boxes, you put down roots. You understand that knowing a place takes time, and you have all the time in the world.",
    whatThisMeans: [
      "You rent apartments, not hotel rooms",
      "You grocery shop like a local",
      "Your neighbors wave hello",
      "You've made friends you visit yearly"
    ],
    superpowers: [
      "Truly understanding a destination",
      "Building lasting international friendships",
      "Finding home anywhere in the world"
    ],
    growthEdges: [
      "Sometimes a taste is enough",
      "Quick trips can still be meaningful",
      "FOMO isn't always wrong"
    ],
    perfectTripPreview: "Three months in Lisbon, renting a flat in Alfama, learning Portuguese, adopting a local café, and leaving with a second home.",
    emoji: "🐌"
  },
  // Default/fallback archetypes based on simple mapping
  explorer: {
    id: 'explorer',
    name: 'The Explorer',
    category: 'EXPLORER',
    hookLine: "The world is your playground, and every corner holds a secret.",
    coreDescription: "You're driven by an insatiable curiosity that pulls you toward the unknown. Whether it's a hidden alley in an ancient city or a trail in a remote wilderness, you find joy in discovery.",
    whatThisMeans: [
      "You prefer experiences over souvenirs",
      "Getting lost is part of the adventure",
      "You research extensively but leave room for spontaneity",
      "Local recommendations are gold to you"
    ],
    superpowers: [
      "Adapting to any environment",
      "Finding hidden gems others miss",
      "Turning every trip into a story worth telling"
    ],
    growthEdges: [
      "Sometimes the famous attractions are famous for a reason",
      "Creature comforts can enhance, not diminish, adventures",
      "Sharing discoveries multiplies the joy"
    ],
    perfectTripPreview: "Island-hopping through the Philippines, discovering secret lagoons, befriending local fishermen, and ending up at a beach party no guidebook mentions.",
    emoji: "🧭"
  },
  curated_luxe: {
    id: 'curated_luxe',
    name: 'Curated Luxe',
    category: 'CURATOR',
    hookLine: "You don't travel—you orchestrate experiences.",
    coreDescription: "Excellence isn't negotiable. You've learned that the best things in life require curation, and your travels reflect that philosophy. Every detail is intentional.",
    whatThisMeans: [
      "You book months in advance for the perfect experience",
      "Quality matters more than quantity",
      "You know the difference between expensive and valuable",
      "Every trip teaches you something refined"
    ],
    superpowers: [
      "Spotting excellence in any setting",
      "Creating seamless, memorable experiences",
      "Appreciating craftsmanship in all forms"
    ],
    growthEdges: [
      "Spontaneity has its own luxury",
      "Some of the best meals cost nothing",
      "Imperfection tells better stories"
    ],
    perfectTripPreview: "A curated week in Provence: private château stay, truffle hunting with a local guide, Michelin-starred dining, and a hot air balloon at sunrise.",
    emoji: "💎"
  },
  story_seeker: {
    id: 'story_seeker',
    name: 'The Story Seeker',
    category: 'CONNECTOR',
    hookLine: "Every person is a book you haven't read yet.",
    coreDescription: "You travel to collect stories, not stamps. The people you meet matter more than the places you see. You leave every destination richer in connections than photographs.",
    whatThisMeans: [
      "You strike up conversations with strangers",
      "Local guides become friends",
      "You remember names, not just places",
      "Your travel photos feature people, not just landscapes"
    ],
    superpowers: [
      "Making instant, genuine connections",
      "Drawing out stories from anyone",
      "Creating a global network of friends"
    ],
    growthEdges: [
      "Some journeys are meant to be solo",
      "Nature speaks if you listen",
      "Solitude can be nourishing"
    ],
    perfectTripPreview: "A village stay in rural Vietnam, invited to a wedding by day two, learning family recipes, and exchanging contact info with your new extended family.",
    emoji: "📖"
  },
  escape_artist: {
    id: 'escape_artist',
    name: 'The Escape Artist',
    category: 'RESTORER',
    hookLine: "Sometimes you need to leave to find yourself.",
    coreDescription: "Travel is your reset button. When life gets heavy, you get going. You understand that sometimes the best way forward is miles away from where you are.",
    whatThisMeans: [
      "You book last-minute getaways without guilt",
      "Beaches are your therapy offices",
      "You return from trips recharged and renewed",
      "You know exactly what restores you"
    ],
    superpowers: [
      "Prioritizing your wellbeing unapologetically",
      "Finding peace in any setting",
      "Returning refreshed when others return exhausted"
    ],
    growthEdges: [
      "Running toward something beats running from it",
      "Home can hold healing too",
      "Sometimes the escape is internal"
    ],
    perfectTripPreview: "A week in the Maldives, overwater bungalow, no schedule, no obligations. Just you, the ocean, and the luxury of doing nothing.",
    emoji: "🏝️"
  },
};

export function getArchetypeNarrative(archetypeId: string): ArchetypeNarrative {
  // Normalize the ID - convert spaces/hyphens to underscores and lowercase
  const normalizedId = archetypeId.toLowerCase().replace(/[\s-]/g, '_');
  
  // Direct match
  if (ARCHETYPE_NARRATIVES[normalizedId]) {
    return ARCHETYPE_NARRATIVES[normalizedId];
  }
  
  // Map display names to archetype IDs (from backend which uses "Cultural Explorer" format)
  const displayNameMapping: Record<string, string> = {
    'cultural_explorer': 'cultural_anthropologist',
    'luxury_seeker': 'luxury_luminary',
    'adventure_seeker': 'adrenaline_architect',
    'relaxation_seeker': 'zen_seeker',
    'wellness_seeker': 'zen_seeker',
    'budget_traveler': 'explorer',
    'family_traveler': 'family_architect',
    'solo_explorer': 'urban_nomad',
    'food_lover': 'culinary_cartographer',
    'nature_lover': 'wilderness_pioneer',
    'city_explorer': 'urban_nomad',
    'beach_lover': 'escape_artist',
    'slow_explorer': 'slow_traveler',
    'story_collector': 'story_seeker',
  };
  
  if (displayNameMapping[normalizedId]) {
    return ARCHETYPE_NARRATIVES[displayNameMapping[normalizedId]];
  }
  
  // Map common style values to archetypes
  const styleMapping: Record<string, string> = {
    luxury: 'luxury_luminary',
    adventure: 'adrenaline_architect',
    cultural: 'cultural_anthropologist',
    relaxation: 'zen_seeker',
    budget: 'explorer',
    wellness: 'zen_seeker',
  };
  
  if (styleMapping[normalizedId]) {
    return ARCHETYPE_NARRATIVES[styleMapping[normalizedId]];
  }
  
  // Default to Explorer
  return ARCHETYPE_NARRATIVES.explorer;
}

export function getCategoryColors(category: keyof typeof CATEGORY_COLORS) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.EXPLORER;
}