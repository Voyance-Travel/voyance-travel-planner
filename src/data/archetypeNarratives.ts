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
    perfectTripPreview: "A month in Morocco learning Arabic phrases and making lifelong friends over home-cooked dinners.",
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
    perfectTripPreview: "Hopping between Tokyo, Seoul, and Singapore: cafés by day, night markets after dark.",
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
    perfectTripPreview: "Two weeks trekking Patagonia with nothing but a tent and endless views.",
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
    perfectTripPreview: "A Bali wellness retreat with daily yoga and nowhere to be.",
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
    perfectTripPreview: "Eating your way through Japan: ramen, sushi, and that perfect hidden izakaya.",
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
    perfectTripPreview: "Sailing the Amalfi Coast with champagne at sunset.",
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
    perfectTripPreview: "A Tuscan villa with the whole family: cooking classes, pool days, and dinners under the stars.",
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
    perfectTripPreview: "New Zealand: bungee jumping, glacier skydiving, and cliff diving into crystal water.",
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
    perfectTripPreview: "Three months in Lisbon: your own flat, a regular café, and feeling like a local.",
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
    perfectTripPreview: "Island-hopping the Philippines: hidden beaches, local friends, and the best parties.",
    emoji: "🧭"
  },
  curated_luxe: {
    id: 'curated_luxe',
    name: 'Curated Luxe',
    category: 'CURATOR',
    hookLine: "You don't travel, you orchestrate experiences.",
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
    perfectTripPreview: "A perfect week in Provence: truffle hunting, amazing food, and a sunrise balloon ride.",
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
    perfectTripPreview: "A Vietnam village stay: wedding invitations, family recipes, and friends for life.",
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
    perfectTripPreview: "A week in the Maldives: overwater bungalow, no schedule, total peace.",
    emoji: "🏝️"
  },
  sanctuary_seeker: {
    id: 'sanctuary_seeker',
    name: 'The Sanctuary Seeker',
    category: 'RESTORER',
    hookLine: "Travel is finding your perfect refuge.",
    coreDescription: "You travel to create your ideal environment, not to be drained by crowds and chaos. Luxury isn't about showing off—it's about building the perfect cocoon where you can truly relax on your own terms.",
    whatThisMeans: [
      "You prefer private villas over bustling hotels",
      "Room service is preferable to crowded restaurants",
      "You plan meticulously to avoid unpleasant surprises",
      "Peace and quiet are non-negotiable"
    ],
    superpowers: [
      "Creating perfect personal retreats anywhere",
      "Knowing exactly what restores your energy",
      "Designing trips that truly recharge rather than deplete"
    ],
    growthEdges: [
      "Sometimes unexpected encounters bring joy",
      "Comfort zones expand when gently pushed",
      "Connection doesn't always have to be exhausting"
    ],
    perfectTripPreview: "A private Tuscan villa: your own chef, peaceful mornings, sunset vineyard views.",
    emoji: "🏛️"
  },
  digital_explorer: {
    id: 'digital_explorer',
    name: 'The Digital Explorer',
    category: 'EXPLORER',
    hookLine: "Your laptop is your passport extension.",
    coreDescription: "You've cracked the code of working from anywhere. Coffee shops in Lisbon, co-working spaces in Bali, beach cafés in Thailand—your office has the best views in the world.",
    whatThisMeans: [
      "You know which cafés have the best WiFi",
      "Time zones are puzzles you've mastered",
      "You pack light but never forget your chargers",
      "Work-life integration, not balance, is your mantra"
    ],
    superpowers: [
      "Productivity in any environment",
      "Building global professional networks",
      "Finding the perfect remote work spots"
    ],
    growthEdges: [
      "Disconnect to truly connect",
      "Some experiences require your full attention",
      "Boundaries between work and travel matter"
    ],
    perfectTripPreview: "Three months in Southeast Asia: cafés with ocean views and fellow nomads.",
    emoji: "💻"
  },
  social_butterfly: {
    id: 'social_butterfly',
    name: 'The Social Butterfly',
    category: 'CONNECTOR',
    hookLine: "Every stranger is a friend you haven't met.",
    coreDescription: "Your trips are measured in friendships made, not miles traveled. You collect people, not passport stamps. Hostels, group tours, and communal tables are your natural habitat.",
    whatThisMeans: [
      "Solo travel means making new friends",
      "You've joined strangers for dinner worldwide",
      "Group trips energize rather than drain you",
      "You stay in touch with travel friends for years"
    ],
    superpowers: [
      "Breaking ice in any culture",
      "Turning acquaintances into lifelong friends",
      "Creating instant travel families"
    ],
    growthEdges: [
      "Solo reflection has its gifts",
      "Quality over quantity in connections",
      "Not every encounter needs to be a friendship"
    ],
    perfectTripPreview: "A group trip through the Balkans: 20 new friends and a reunion already planned.",
    emoji: "🦋"
  },
  romantic_curator: {
    id: 'romantic_curator',
    name: 'The Romantic Curator',
    category: 'CONNECTOR',
    hookLine: "Love is better with a view.",
    coreDescription: "You design journeys that deepen bonds. Whether honeymoon or anniversary, every detail is choreographed for connection. Sunset dinners, private tours, and memory-making are your specialty.",
    whatThisMeans: [
      "You research romantic restaurants months ahead",
      "Surprises are part of every itinerary",
      "You notice the little details that matter",
      "Creating shared memories is your love language"
    ],
    superpowers: [
      "Curating perfect romantic moments",
      "Reading your partner's travel preferences",
      "Turning ordinary moments into extraordinary memories"
    ],
    growthEdges: [
      "Spontaneity can be romantic too",
      "Individual adventures strengthen partnerships",
      "Not every moment needs to be Instagram-perfect"
    ],
    perfectTripPreview: "Santorini sunsets, wine tasting, and memories that last forever.",
    emoji: "💕"
  },
  bucket_list_conqueror: {
    id: 'bucket_list_conqueror',
    name: 'The Bucket List Conqueror',
    category: 'ACHIEVER',
    hookLine: "Life is a checklist of wonders.",
    coreDescription: "You have a list, and you're checking it twice. From the Northern Lights to Machu Picchu, you approach travel with purpose. Every trip brings you closer to seeing it all.",
    whatThisMeans: [
      "You've got a spreadsheet of destinations",
      "Limited edition experiences excite you",
      "You plan around natural phenomena and events",
      "FOMO is real and you embrace it"
    ],
    superpowers: [
      "Efficient trip planning and execution",
      "Prioritizing what matters most",
      "Creating a life full of incredible stories"
    ],
    growthEdges: [
      "Some magic isn't on any list",
      "Revisiting favorites has its own joy",
      "The journey matters as much as the destination"
    ],
    perfectTripPreview: "Northern Lights, the Pyramids, the Galápagos: checking off the big ones.",
    emoji: "✓"
  },
  collection_curator: {
    id: 'collection_curator',
    name: 'The Collection Curator',
    category: 'ACHIEVER',
    hookLine: "Countries collected, stamps earned.",
    coreDescription: "You're on a mission to see the world, systematically. Whether it's every country, every continent, or every UNESCO site, you approach travel as a magnificent collection to complete.",
    whatThisMeans: [
      "You track your travel statistics",
      "Border crossings excite you",
      "You've visited countries others haven't heard of",
      "The map on your wall has more pins than blank spaces"
    ],
    superpowers: [
      "Geographic knowledge that impresses",
      "Efficient multi-country logistics",
      "Stories from truly obscure places"
    ],
    growthEdges: [
      "Depth can matter more than breadth",
      "Some countries deserve more than a flyby",
      "Quality of experience over quantity of stamps"
    ],
    perfectTripPreview: "Central Asia: eight countries, ancient Silk Road cities, stories from places few visit.",
    emoji: "🗺️"
  },
  status_seeker: {
    id: 'status_seeker',
    name: 'The Status Seeker',
    category: 'ACHIEVER',
    hookLine: "First class isn't a seat, it's a lifestyle.",
    coreDescription: "You've earned the right to travel in style. Elite status, private experiences, and VIP access are your rewards for hard work. Travel is both pleasure and proof of success.",
    whatThisMeans: [
      "Your loyalty program tiers are impressive",
      "You know which credit cards unlock which perks",
      "Exclusive experiences are worth the premium",
      "Your travel stories inspire and impress"
    ],
    superpowers: [
      "Maximizing value from status and points",
      "Accessing experiences others can't",
      "Traveling in comfort and style"
    ],
    growthEdges: [
      "The best experiences aren't always exclusive",
      "Authentic connection transcends class",
      "Sometimes the local way is the better way"
    ],
    perfectTripPreview: "First class to Dubai, a suite with views, and a desert dinner under the stars.",
    emoji: "👑"
  },
  retreat_regular: {
    id: 'retreat_regular',
    name: 'The Retreat Regular',
    category: 'RESTORER',
    hookLine: "Wellness isn't a trend, it's a lifestyle.",
    coreDescription: "You don't vacation, you retreat. Yoga camps, detox programs, silent retreats: travel is your commitment to becoming your best self. You return transformed, not just rested.",
    whatThisMeans: [
      "You've done juice cleanses in exotic locations",
      "Meditation is part of your travel routine",
      "You research wellness programs like others research hotels",
      "Your packing includes yoga mats and journals"
    ],
    superpowers: [
      "Prioritizing true self-care",
      "Finding transformation through travel",
      "Returning as an upgraded version of yourself"
    ],
    growthEdges: [
      "Sometimes indulgence is wellness too",
      "Not every trip needs a program",
      "Relaxation can be unstructured"
    ],
    perfectTripPreview: "Ten days in Kerala: daily yoga, Ayurvedic spa, and healthy new habits.",
    emoji: "🧖"
  },
  beach_therapist: {
    id: 'beach_therapist',
    name: 'The Beach Therapist',
    category: 'RESTORER',
    hookLine: "Salt water heals everything.",
    coreDescription: "The ocean is your therapist, the beach your couch. You understand the healing power of waves, sand, and horizon. Vitamin Sea is your prescription, and you fill it often.",
    whatThisMeans: [
      "You judge destinations by their beaches",
      "You own an impressive collection of swimwear",
      "Ocean sounds are your sleep soundtrack",
      "You've found paradise in multiple countries"
    ],
    superpowers: [
      "Finding the perfect beach anywhere",
      "Total relaxation in coastal settings",
      "Returning sun-kissed and soul-restored"
    ],
    growthEdges: [
      "Mountains have their own magic",
      "Cities offer unexpected restoration",
      "Adventure can coexist with beach time"
    ],
    perfectTripPreview: "Two weeks island-hopping Greece: beautiful beaches, warm sun, pure relaxation.",
    emoji: "🏖️"
  },
  art_aficionado: {
    id: 'art_aficionado',
    name: 'The Art Aficionado',
    category: 'CURATOR',
    hookLine: "Every gallery is a pilgrimage.",
    coreDescription: "You travel to witness human creativity. Museums are your temples, galleries your sanctuaries. You plan trips around exhibitions and leave with a deeper appreciation of beauty.",
    whatThisMeans: [
      "You've cried in front of a painting",
      "You book museum tickets before flights",
      "Street art tours excite you",
      "You can name artists in any city you visit"
    ],
    superpowers: [
      "Seeing beauty others miss",
      "Understanding cultures through their art",
      "Creating deeply meaningful cultural experiences"
    ],
    growthEdges: [
      "Nature is art too",
      "Not every moment needs curation",
      "Sometimes the best art is lived, not viewed"
    ],
    perfectTripPreview: "A week in Florence: world-famous art, hidden gems, and history everywhere.",
    emoji: "🎨"
  },
  eco_ethicist: {
    id: 'eco_ethicist',
    name: 'The Eco Ethicist',
    category: 'CURATOR',
    hookLine: "Leave nothing but footprints.",
    coreDescription: "You travel with purpose and principles. Carbon footprints, local impact, and sustainable choices guide your decisions. You prove that responsible travel can be extraordinary.",
    whatThisMeans: [
      "You research a destination's sustainability practices",
      "You choose eco-lodges and carbon offsets",
      "Local and ethical matter to your choices",
      "You leave places better than you found them"
    ],
    superpowers: [
      "Finding sustainable options anywhere",
      "Inspiring others to travel responsibly",
      "Connecting with nature and communities"
    ],
    growthEdges: [
      "Perfect isn't the enemy of good",
      "Sometimes convenience is okay",
      "Enjoy without guilt when you've done your best"
    ],
    perfectTripPreview: "Costa Rica eco-lodges, incredible wildlife, and sustainable coffee farms.",
    emoji: "🌱"
  },
  gap_year_graduate: {
    id: 'gap_year_graduate',
    name: 'The Gap Year Graduate',
    category: 'TRANSFORMER',
    hookLine: "The world is the ultimate classroom.",
    coreDescription: "Travel shaped who you are. Those months of backpacking, teaching, or volunteering taught you more than any degree. You carry that transformative spirit into every journey.",
    whatThisMeans: [
      "You've lived out of a backpack for months",
      "You've worked odd jobs in foreign countries",
      "Budget travel doesn't scare you",
      "You see travel as education"
    ],
    superpowers: [
      "Adapting to any situation",
      "Finding meaning in uncomfortable moments",
      "Connecting deeply across cultures"
    ],
    growthEdges: [
      "Comfort isn't selling out",
      "You can grow without struggle",
      "Sometimes a nice hotel is okay"
    ],
    perfectTripPreview: "Three months through South America—teaching, learning Spanish, coming home changed.",
    emoji: "🎒"
  },
  midlife_explorer: {
    id: 'midlife_explorer',
    name: 'The Midlife Explorer',
    category: 'TRANSFORMER',
    hookLine: "It's never too late to become who you were meant to be.",
    coreDescription: "You're rewriting your travel story. Life experience has taught you what matters, and now you're going after it. These trips aren't escapes—they're homecomings to your true self.",
    whatThisMeans: [
      "You travel with intention and appreciation",
      "Dreams deferred are now dreams pursued",
      "Quality over quantity in every choice",
      "You've stopped waiting for 'someday'"
    ],
    superpowers: [
      "Knowing exactly what you want",
      "Appreciating experiences deeply",
      "Inspiring others to take the leap"
    ],
    growthEdges: [
      "Youth has its own wisdom",
      "Spontaneity keeps you young",
      "Not every trip needs deep meaning"
    ],
    perfectTripPreview: "Finally Japan—cherry blossoms, traditional inns, even better than you imagined.",
    emoji: "🦅"
  },
  sabbatical_scholar: {
    id: 'sabbatical_scholar',
    name: 'The Sabbatical Scholar',
    category: 'TRANSFORMER',
    hookLine: "Taking time off to find time on.",
    coreDescription: "You've carved out extended time to travel with purpose. Language immersion, creative projects, or deep rest—your sabbatical is an investment in your next chapter.",
    whatThisMeans: [
      "You've planned a significant career break",
      "Learning is central to your travels",
      "You rent apartments, not hotel rooms",
      "You return with new skills and perspectives"
    ],
    superpowers: [
      "Long-term planning and commitment",
      "Deep immersion in new environments",
      "Returning transformed and renewed"
    ],
    growthEdges: [
      "You don't need months to find meaning",
      "Weekend trips can be transformative too",
      "Structure isn't always the enemy"
    ],
    perfectTripPreview: "Six months in Spain—learning the language, finishing that project, gaining new skills.",
    emoji: "📚"
  },
  healing_journeyer: {
    id: 'healing_journeyer',
    name: 'The Healing Journeyer',
    category: 'TRANSFORMER',
    hookLine: "Travel is the medicine for the soul.",
    coreDescription: "You travel to heal. Whether grief, burnout, or life transition, the road has been your path to recovery. You understand that sometimes the best way through is away.",
    whatThisMeans: [
      "You've used travel as therapy",
      "Sacred places call to you",
      "You return from trips emotionally renewed",
      "Transformation is the goal, not distraction"
    ],
    superpowers: [
      "Processing life through journey",
      "Finding peace in new places",
      "Emerging stronger from travel"
    ],
    growthEdges: [
      "Home can hold healing too",
      "Running toward beats running from",
      "Professional help complements travel therapy"
    ],
    perfectTripPreview: "Walking the Camino—meeting fellow travelers, finding peace, arriving renewed.",
    emoji: "🕊️"
  },
  retirement_ranger: {
    id: 'retirement_ranger',
    name: 'The Retirement Ranger',
    category: 'TRANSFORMER',
    hookLine: "Finally free to explore without limits.",
    coreDescription: "The calendar is yours now. No more vacation days to hoard, no more rushed weekend trips. You've earned the right to travel slow, go far, and stay as long as you like.",
    whatThisMeans: [
      "Extended trips are now the norm, not the exception",
      "You prioritize comfort without guilt",
      "Off-season travel is your secret weapon",
      "You mentor younger travelers with hard-won wisdom"
    ],
    superpowers: [
      "Patience perfected over decades",
      "Deep appreciation for every moment",
      "Freedom to change plans on a whim"
    ],
    growthEdges: [
      "New technology can enhance travel",
      "Solo adventures build new confidence",
      "Backpackers have wisdom too"
    ],
    perfectTripPreview: "Three months in Portugal—a villa, new friends, and finally time to read.",
    emoji: "🌅"
  },
  balanced_story_collector: {
    id: 'balanced_story_collector',
    name: 'The Balanced Story Collector',
    category: 'EXPLORER',  // Changed from CONNECTOR - accepts introverts
    hookLine: "Every journey adds a chapter worth reading.",
    coreDescription: "You don't fit into neat boxes, and that's your superpower. You balance adventure with rest, solo time with meaningful connection, and spontaneity with just enough planning. Every trip becomes a story worth telling, even if you're the only audience.",
    whatThisMeans: [
      "You adapt your travel style to each destination",
      "Some days you explore hard, others you rest completely",
      "You value both occasional deep connections and plenty of solo reflection",
      "You're equally happy in luxury or simplicity"
    ],
    superpowers: [
      "Reading what each trip calls for",
      "Balancing opposing needs gracefully",
      "Collecting diverse experiences without burnout"
    ],
    growthEdges: [
      "Sometimes committing fully reveals hidden magic",
      "Not every trip needs to be 'balanced'",
      "Extremes can be exhilarating"
    ],
    perfectTripPreview: "Two weeks in Portugal: Lisbon nightlife, peaceful Sintra, cooking class, lazy beach days.",
    emoji: "📖"
  },
  flexible_wanderer: {
    id: 'flexible_wanderer',
    name: 'The Flexible Wanderer',
    category: 'EXPLORER',
    hookLine: "Plans are just suggestions. The road decides.",
    coreDescription: "You book one-way tickets and figure out the rest later. Itineraries feel like prisons, and the best experiences come from happy accidents. You trust the journey to unfold.",
    whatThisMeans: [
      "You rarely book more than 24 hours ahead",
      "Missed trains have led to your best memories",
      "You carry everything you need in one bag",
      "You've extended 'one week' trips into months"
    ],
    superpowers: [
      "Thriving in uncertainty",
      "Seizing unexpected opportunities",
      "Minimal packing, maximum freedom"
    ],
    growthEdges: [
      "Some destinations reward advance booking",
      "Travel companions need some structure",
      "Peak season requires planning"
    ],
    perfectTripPreview: "Landing in Bangkok with no plans, following tips, ending up in Vietnam, coming home when it feels right.",
    emoji: "🌬️"
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