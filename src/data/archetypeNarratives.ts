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
  /** "Screenshot moment" - the paragraph they'll send to friends */
  revealParagraph?: string;
  /** "You probably..." observations that feel personal */
  youProbably?: string[];
  /** What their itinerary will feel like */
  itineraryPreview?: string[];
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
    description: 'Wellness-focused travelers seeking peace, rejuvenation, and balance. Travel is your reset button: a way to recharge and return refreshed.',
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
    hookLine: "You don't just visit a place — you want to understand it",
    coreDescription: "You want a vacation, but you also want to know where you are. Not in a grad-school way — in a 'I had a great trip AND I learned what built this city' way. You'll happily spend half a day on a cultural tour or a guided neighborhood walk, then go shopping and have a long lunch. The trip should leave you with a real sense of the place's bones, history, and culture, balanced with everything else that makes a trip a trip.",
    whatThisMeans: [
      "1-2 cultural tour or museum activities per trip — not all day, every day",
      "You're curious about local context but not on a learning marathon",
      "Food and shopping are part of the cultural experience, not a distraction from it"
    ],
    superpowers: [
      "Asks the right questions",
      "Notices details others miss",
      "Comes back with stories that have substance"
    ],
    growthEdges: [
      "Sometimes wants to learn more than the trip allows for",
      "Can over-research and miss the spontaneous moments"
    ],
    perfectTripPreview: "Morning at the Borghese, leisurely lunch in Trastevere, afternoon free to wander, dinner at a family-run trattoria with a story",
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
    perfectTripPreview: "You find home in the rhythm of new cities.",
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
    perfectTripPreview: "You earn your views and sleep under open skies.",
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
    perfectTripPreview: "You find stillness wherever you wander.",
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
    perfectTripPreview: "You taste your way to understanding.",
    emoji: "🍜",
    revealParagraph: `You've been known to plan entire trips around a single restaurant reservation. Food isn't just fuel for you. It's the point. The market at 7am. The hole-in-the-wall only locals know. The thing you ate that you still think about years later. Other people see eating as an interruption to sightseeing. You see sightseeing as what you do between meals.`,
    youProbably: [
      "Have a list of restaurants in cities you haven't even booked yet",
      "Know the difference between 'authentic' and 'touristy' by smell alone",
      "Have made friends over a shared table at a tiny restaurant"
    ],
    itineraryPreview: [
      "Meals as main events, not afterthoughts",
      "Market visits built into every trip",
      "Time to actually taste things (no rushed lunches)",
      "Local spots, not hotel restaurants"
    ]
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
    perfectTripPreview: "Every detail is exactly as it should be.",
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
    perfectTripPreview: "You create stories everyone will retell.",
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
    perfectTripPreview: "Your heart races in the most beautiful settings.",
    emoji: "🪂",
    revealParagraph: `You don't understand "relaxing" vacations. Lying on a beach sounds like punishment. You need to do something. The best trips leave you with stories: the time you almost didn't make it, the thing that scared you until you did it, the moment you surprised yourself. Other people need to "recover" from vacation. You come back feeling more alive than when you left.`,
    youProbably: [
      "Have a story that starts with 'So I signed the waiver...'",
      "Feel restless after two hours on a beach",
      "Have convinced reluctant friends to try something that terrified them"
    ],
    itineraryPreview: [
      "Heart-pounding activities (the kind that make great stories)",
      "Early starts to catch the best conditions",
      "Active recovery, not lazy days",
      "The kind of tired that feels earned"
    ]
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
    perfectTripPreview: "You stay long enough to have a favorite café.",
    emoji: "🐌",
    revealParagraph: `You've never understood people who "do" a city in two days. What's the point of traveling if you're exhausted the whole time? For you, the best moments happen when you're not trying to get somewhere else. The three-hour lunch that turns into wine and conversation. The morning spent with a book at a café you'll never find again. The afternoon you spent doing absolutely nothing and loved every minute. You've probably been told you're "wasting time" when you travel. You know better. You're not missing anything. You're actually there.`,
    youProbably: [
      "Have a favorite café in at least three cities",
      "Have made friends abroad you still keep in touch with",
      "Get stressed when someone says 'let's see everything'"
    ],
    itineraryPreview: [
      "Long, unrushed meals (because a 45-minute dinner is a crime)",
      "Breathing room between activities",
      "Permission to do nothing",
      "Fewer things, experienced fully"
    ]
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
    perfectTripPreview: "You discover what others overlook.",
    emoji: "🧭"
  },
  community_builder: {
    id: 'community_builder',
    name: 'The Purpose Voyager',
    category: 'CONNECTOR',
    hookLine: "You've been everywhere — and everyone asks you for advice",
    coreDescription: "You don't just travel — you accumulate. Every city stamped, every hidden gem uncovered becomes part of your authority. You're the one friends text before any trip because you've actually been there. You don't just want to visit places — you want to KNOW them well enough to be the expert. Your passport isn't a document; it's a résumé. And you're nowhere near done.",
    whatThisMeans: [
      "Higher activity density — you cover a lot",
      "Mix of iconic must-dos AND insider spots so you can recommend both",
      "You take notes you'll share later"
    ],
    superpowers: [
      "Knows the actual best spot in any city",
      "Connects friends to perfect-fit travel",
      "Authority through real experience"
    ],
    growthEdges: [
      "Can prioritize coverage over presence",
      "Friends sometimes want recommendations you haven't lived yet"
    ],
    perfectTripPreview: "Iconic morning landmark, lunch at the place no tourist knows, afternoon off-the-beaten-path neighborhood, dinner everyone will Instagram",
    emoji: "🤝"
  },
  story_seeker: {
    id: 'story_seeker',
    name: 'The Story Seeker',
    category: 'CONNECTOR',
    hookLine: "You travel for the moments you couldn't have planned",
    coreDescription: "You don't travel for the postcard moments. You travel for the stories no one would believe — the midnight swim, the local who invited you to dinner, the detour that became the whole trip. Polished AI itineraries make you nervous. You want unscripted, raw, 'you had to be there' energy. Your best memories are from saying yes to things you couldn't have planned.",
    whatThisMeans: [
      "At least one wildcard, free-form local discovery block per trip",
      "You'd skip the famous landmark for the local-only spot",
      "Memories matter more than completion"
    ],
    superpowers: [
      "Says yes to unexpected invitations",
      "Finds the actual local hangouts",
      "Comes home with the stories everyone wants to hear"
    ],
    growthEdges: [
      "Can over-romanticize chaos",
      "Sometimes misses the iconic stuff worth seeing"
    ],
    perfectTripPreview: "Morning market with no plan, follow the smell of bread to a bakery, end up at a backyard concert someone mentioned, sleep when tired",
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
    perfectTripPreview: "You finally find the quiet you need.",
    emoji: "🏝️"
  },
  sanctuary_seeker: {
    id: 'sanctuary_seeker',
    name: 'The Sanctuary Seeker',
    category: 'RESTORER',
    hookLine: "Travel is finding your perfect refuge.",
    coreDescription: "You travel to create your ideal environment, not to be drained by crowds and chaos. Luxury isn't about showing off. It's about building the perfect cocoon where you can truly relax on your own terms.",
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
    perfectTripPreview: "You create your own perfect refuge.",
    emoji: "🏛️"
  },
  digital_explorer: {
    id: 'digital_explorer',
    name: 'The Untethered Traveler',
    category: 'EXPLORER',
    hookLine: "Your laptop is your passport extension.",
    coreDescription: "You've cracked the code of working from anywhere. Coffee shops in Lisbon, co-working spaces in Bali, beach cafés in Thailand. Your office has the best views in the world.",
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
    perfectTripPreview: "Your office has the best views in the world.",
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
    perfectTripPreview: "You make friends everywhere you go.",
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
    perfectTripPreview: "You create memories that last forever.",
    emoji: "💕"
  },
  bucket_list_conqueror: {
    id: 'bucket_list_conqueror',
    name: 'The Milestone Voyager',
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
    perfectTripPreview: "You check off the experiences that matter most.",
    emoji: "✓"
  },
  collection_curator: {
    id: 'collection_curator',
    name: 'The Passport Collector',
    category: 'ACHIEVER',
    hookLine: "Your map is your scoreboard",
    coreDescription: "You count countries the way other people count years. Each new stamp matters. You'd rather hit three new places than spend a week in one. Breadth, not depth. The number on your passport is the metric — and you're optimizing for it. You don't need to be the expert; you just need to have been there.",
    whatThisMeans: [
      "Trips designed to maximize new-country/new-city count",
      "Iconic landmarks anchor each visit (the proof you were there)",
      "Less time per destination — coverage is the win"
    ],
    superpowers: [
      "Logistically efficient",
      "Always knows what flight deal makes the next country possible",
      "Has the receipts for everywhere"
    ],
    growthEdges: [
      "Sometimes trades depth for breadth in a way you regret later",
      "Can rush past the magic in pursuit of the next stamp"
    ],
    perfectTripPreview: "3-country, 6-day route hitting the must-see iconic site in each — passport stamped, photos taken, on to the next",
    emoji: "🗺️"
  },
  status_seeker: {
    id: 'status_seeker',
    name: 'The VIP Voyager',
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
    perfectTripPreview: "You travel in the style you have earned.",
    emoji: "👑"
  },
  retreat_regular: {
    id: 'retreat_regular',
    name: 'The Wellness Devotee',
    category: 'RESTORER',
    hookLine: "You travel to disappear from your life",
    coreDescription: "You travel TO escape — from the inbox, the noise, the obligations. You want to retreat from your normal life. Mostly stillness inside the retreat property — spa, meditation, yoga, real food, quiet space. But unlike someone who never leaves, you'll surface for one real day outside. Then back to the cocoon. The combo of escape + sanctuary + wellness is the whole point.",
    whatThisMeans: [
      "70-80% of the trip happens at the retreat/property",
      "One day outside the retreat for a real adventure",
      "Wellness amenities are non-negotiable: spa, meditation, yoga, or healthy dining"
    ],
    superpowers: [
      "Returns to life genuinely restored",
      "Knows when to log off",
      "Builds rituals that travel with you"
    ],
    growthEdges: [
      "Can over-isolate and miss the place you traveled to",
      "Same retreat-style trips can blur together"
    ],
    perfectTripPreview: "Mountain retreat with daily yoga, two spa treatments, one day at a local market and lunch in town, then back to the cocoon",
    emoji: "🧖"
  },
  beach_therapist: {
    id: 'beach_therapist',
    name: 'The Beach Therapist',
    category: 'RESTORER',
    hookLine: "Water is your home",
    coreDescription: "You're water. That's it. Give you the ocean, a lake, a river at sunset — and everything else falls into place. You don't need the fanciest hotel or the most packed itinerary. You need to hear waves. You need salt air or still water or the feeling of sand giving way under your feet. Other people plan trips around cities or food or culture. You plan around the water. Always have.",
    whatThisMeans: [
      "Water is accessible every day of the trip",
      "Hotel is waterfront or walkable to water",
      "Activities anchor around morning swim, sunset by the water"
    ],
    superpowers: [
      "Resets faster than anyone in saltwater",
      "Knows the difference between swim beaches and view beaches",
      "Brings the calm"
    ],
    growthEdges: [
      "Can struggle on landlocked trips",
      "Sometimes underrates the inland gems near coastal spots"
    ],
    perfectTripPreview: "Wake to ocean view, morning swim, beach lunch, sunset dinner with feet in sand — repeat",
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
    perfectTripPreview: "You see beauty others walk right past.",
    emoji: "🎨"
  },
  eco_ethicist: {
    id: 'eco_ethicist',
    name: 'The Mindful Voyager',
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
    perfectTripPreview: "You leave places better than you found them.",
    emoji: "🌱"
  },
  history_hunter: {
    id: 'history_hunter',
    name: 'The History Hunter',
    category: 'CURATOR',
    hookLine: "Every stone has a story. You just have to look.",
    coreDescription: "You don't just visit historical sites, you walk through time. Every ruin, monument, and ancient street has layers of meaning that others walk right past. You see the centuries stacked beneath your feet.",
    whatThisMeans: [
      "You read the plaques other tourists skip",
      "You've gotten emotional at ruins",
      "You plan trips around archaeological discoveries",
      "You can place a building's era by its architecture"
    ],
    superpowers: [
      "Deep appreciation for historical context and significance",
      "Patience to truly understand a place through its past",
      "Ability to find meaning in sites others find ordinary"
    ],
    growthEdges: [
      "May overlook modern culture in favor of the ancient",
      "Can spend so long at one site that the day slips away",
      "Might dismiss destinations without obvious historical significance"
    ],
    perfectTripPreview: "You walk through centuries, not just streets.",
    emoji: "🏛️",
    revealParagraph: `You've stood in a place that's a thousand years old and felt something shift. Not just "that's old," something deeper. You could feel the people who walked there before you. The guide says "built in the 12th century" and everyone nods, but you're already imagining what it looked like new. You read the footnotes. You notice the renovation layers. You ask the questions the guide wasn't expecting. History isn't dead to you. It's the most alive thing in the room.`,
    youProbably: [
      "Have a favorite historical period and defend it passionately",
      "Own more history books than novels",
      "Have visited the same ancient site more than once and found something new each time"
    ],
    itineraryPreview: [
      "Expert-guided historical walks",
      "Time at sites without rushing",
      "Museums with real depth",
      "Ancient quarters and layers of history"
    ]
  },
  gap_year_graduate: {
    id: 'gap_year_graduate',
    name: 'The Horizon Chaser',
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
    perfectTripPreview: "You come home changed.",
    emoji: "🎒"
  },
  midlife_explorer: {
    id: 'midlife_explorer',
    name: 'The Rediscovery Traveler',
    category: 'TRANSFORMER',
    hookLine: "It's never too late to become who you were meant to be.",
    coreDescription: "You're rewriting your travel story. Life experience has taught you what matters, and now you're going after it. These trips aren't escapes. They're homecomings to your true self.",
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
    perfectTripPreview: "You finally take the trip you always dreamed of.",
    emoji: "🦅"
  },
  sabbatical_scholar: {
    id: 'sabbatical_scholar',
    name: 'The Immersion Seeker',
    category: 'TRANSFORMER',
    hookLine: "Your vacation is your education",
    coreDescription: "Other people travel to relax. You travel to learn. Every meal, hotel, museum, walking tour is part of the curriculum. Your hotel is historically significant. Your dinner reservation is at the place that invented the dish. Your guide is the one who literally wrote the book. Vacation is class — and you're the eager student.",
    whatThisMeans: [
      "Almost every activity has an educational angle",
      "You'd choose a context-rich place over a luxurious one",
      "You actually read the museum placards"
    ],
    superpowers: [
      "Deep retention of cultural context",
      "Connects history across destinations",
      "Best travel companion for trivia"
    ],
    growthEdges: [
      "Can be intense for travel partners who want to relax",
      "Sometimes forgets to just enjoy the meal"
    ],
    perfectTripPreview: "Boutique hotel in a 17th-century palazzo, private guided tour with a historian, dinner at the restaurant that taught Florence what carbonara was",
    emoji: "📚"
  },
  healing_journeyer: {
    id: 'healing_journeyer',
    name: 'The Restoration Seeker',
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
    perfectTripPreview: "You find peace on the road.",
    emoji: "🕊️"
  },
  retirement_ranger: {
    id: 'retirement_ranger',
    name: 'The Boundless Explorer',
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
    perfectTripPreview: "You finally have the time to wander.",
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
    perfectTripPreview: "You balance adventure with rest, solo time with connection.",
    emoji: "📖"
  },
  flexible_wanderer: {
    id: 'flexible_wanderer',
    name: 'The Wildcard',
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
    perfectTripPreview: "You trust the journey to unfold.",
    emoji: "🌬️",
    revealParagraph: `You've tried making detailed itineraries. They last about two hours before you see something interesting and abandon the plan entirely. Your best travel memories weren't planned. They were the thing you stumbled into because you turned left instead of right. The restaurant you found because it looked good. The neighborhood you explored because why not. Other people get stressed without a plan. You get stressed with one.`,
    youProbably: [
      "Have extended a 'long weekend' into something much longer",
      "Make friends jealous with stories that start 'So I was wandering and...'",
      "Own a bag you can pack in 10 minutes"
    ],
    itineraryPreview: [
      "Suggestions, not schedules",
      "Plenty of unstructured time",
      "Permission to change everything",
      "Options, not obligations"
    ]
  },
};

export function getArchetypeNarrative(archetypeId: string): ArchetypeNarrative {
  // Normalize the ID - convert spaces/hyphens to underscores and lowercase
  // Also strip leading "the_" prefix (e.g. "The Social Butterfly" → "social_butterfly")
  const normalizedId = archetypeId.toLowerCase().replace(/[\s-]/g, '_').replace(/^the_/, '');
  
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
    'solo_explorer': 'flexible_wanderer',
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