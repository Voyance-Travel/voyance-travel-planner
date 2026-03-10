/**
 * Complete 29 Archetype Reveals - The "Screenshot Moments"
 * 
 * Each reveal is crafted to make users feel genuinely understood.
 * They should want to screenshot and share with friends.
 */

export interface ArchetypeReveal {
  id: string;
  name: string;
  category: 'EXPLORER' | 'CONNECTOR' | 'ACHIEVER' | 'RESTORER' | 'CURATOR' | 'TRANSFORMER';
  /** The main reveal paragraph - this is the screenshot moment */
  revealParagraph: string;
  /** "You probably..." observations that feel uncannily personal */
  youProbably: string[];
  /** What their itinerary will feel like */
  itineraryWillInclude: string[];
  /** What we'll protect them from */
  protectFrom: string[];
}

export const ARCHETYPE_REVEALS: Record<string, ArchetypeReveal> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // EXPLORERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  cultural_anthropologist: {
    id: 'cultural_anthropologist',
    name: 'The Cultural Anthropologist',
    category: 'EXPLORER',
    revealParagraph: `You've never been satisfied with just seeing a place. You want to understand it.

While others are checking off sights, you're noticing how people greet each other, what they eat for breakfast, why the streets are laid out the way they are. You've probably annoyed travel companions by spending an hour in a local market that "wasn't on the itinerary." You don't care. That market taught you more than any museum could.

You ask questions that other tourists don't think to ask. You learn a few words of the language, not because you have to, but because it changes how people respond to you. You've left places feeling like you actually know something about how people live there, not just what the buildings look like.

Your trips will prioritize depth over breadth. We'll build in time for wandering, for conversations, for the moments that can't be scheduled. Less "top ten attractions," more "how this place actually works."`,
    youProbably: [
      "Have learned basic phrases in languages you'll only use once",
      "Spent an hour talking to a local when you only meant to ask for directions",
      "Feel frustrated when tours skim the surface",
      "Keep travel journals full of observations, not just activities"
    ],
    itineraryWillInclude: [
      "Local neighborhood immersion, not just tourist centers",
      "Conversations and connections, not just transactions",
      "Context and history that explains why things are the way they are",
      "Time to observe, not just consume"
    ],
    protectFrom: [
      "Surface-level 'Instagram moment' tourism",
      "Rushing past the details that matter",
      "Missing the real story"
    ]
  },

  urban_nomad: {
    id: 'urban_nomad',
    name: 'The Urban Nomad',
    category: 'EXPLORER',
    revealParagraph: `Cities are your wilderness.

You come alive in urban environments: the energy of crowded streets, the endless options, the feeling that something is always happening. Mountains and beaches are fine, but they don't pull at you the way a new city does. You want to get lost in neighborhoods, find the bar where locals actually go, eat dinner at 10pm because that's when things get interesting.

You probably have a list of cities you need to see, Tokyo, Buenos Aires, Istanbul, Berlin, and each one feels like a different world to explore. You're not there to relax. You're there to absorb.

Your trips will be city-focused, neighborhood-deep, and paced for someone who wants to experience urban life, not observe it from a tour bus. We'll find the late-night spots, the local haunts, the parts of the city that don't show up on the first page of search results.`,
    youProbably: [
      "Judge cities by their coffee culture",
      "Have found your best meals by following your nose down an alley",
      "Feel more at home in new cities than on beaches",
      "Can navigate most metro systems within hours of arriving"
    ],
    itineraryWillInclude: [
      "Neighborhoods with character, not just famous squares",
      "The places locals actually go",
      "Room to wander without a destination",
      "Late-night options (because cities don't sleep at 10pm)"
    ],
    protectFrom: [
      "Suburban tourist zones",
      "'Must-see' lists that miss the soul",
      "Itineraries that ignore nightlife"
    ]
  },

  wilderness_pioneer: {
    id: 'wilderness_pioneer',
    name: 'The Wilderness Pioneer',
    category: 'EXPLORER',
    revealParagraph: `You don't go to nature to look at it. You go to be in it.

The trips that stay with you aren't the ones with the best hotels. They're the ones where you pushed yourself physically, where you were far enough from civilization that your phone was useless, where you earned the view. You've probably hiked in the rain, slept somewhere uncomfortable, and loved every minute of it.

When other people say "getting away from it all," they mean a beach resort. You mean somewhere you can't get cell service. Real nature, not a manicured version of it.

Your trips will take you off the beaten path, literally. Trails over tourist sites. Remote locations over convenient ones. Experiences that challenge you physically and reward you with the kind of beauty you can't reach by car.`,
    youProbably: [
      "Have hiked in the rain and called it the best day",
      "Choose destinations based on trail access, not hotel ratings",
      "Feel more rested after a challenging hike than a beach day",
      "Get twitchy in cities after more than two days"
    ],
    itineraryWillInclude: [
      "Real wilderness, not manicured parks",
      "Physical challenges if you want them",
      "Distance from crowds and cell service",
      "Views you have to earn"
    ],
    protectFrom: [
      "'Nature' that's actually a crowded tourist trail",
      "Over-scheduled wilderness (let the mountain breathe)",
      "City-heavy itineraries when you need trees"
    ]
  },

  digital_explorer: {
    id: 'digital_explorer',
    name: 'The Untethered Traveler',
    category: 'EXPLORER',
    revealParagraph: `You see the world through a frame - and that's not a bad thing.

For you, photography isn't just documentation. It's how you experience a place. You scout locations, time visits for golden hour, and notice details that others walk right past. The hunt for the perfect shot sharpens your attention and leads you to places you'd never find otherwise.

Some people roll their eyes at travelers who "just want photos." They don't understand. The camera makes you look closer, stay longer, see better. Your photos aren't just memories. They're proof that you were really paying attention.

Your trips will include the iconic spots (you want the shot), but also the hidden angles, the less-photographed gems, the moments that require patience and presence. We'll think about light, timing, and composition, because that's how you think.`,
    youProbably: [
      "Scout locations and time visits for golden hour",
      "Notice details others walk right past",
      "Have found amazing places by chasing the perfect shot",
      "Curate your feed as carefully as your itinerary"
    ],
    itineraryWillInclude: [
      "Photo-worthy moments (with the best times for light)",
      "The iconic spots AND the hidden angles",
      "Unique experiences worth capturing",
      "The spots the algorithms haven't killed yet"
    ],
    protectFrom: [
      "Tourist trap photo spots (oversaturated and underwhelming)",
      "Places where the photo is better than the reality",
      "Missing the moment because you're chasing the shot"
    ]
  },

  flexible_wanderer: {
    id: 'flexible_wanderer',
    name: 'The Wildcard',
    category: 'EXPLORER',
    revealParagraph: `Your best travel moments weren't planned. They happened.

You've learned to trust the detour, the wrong turn, the "let's see what's down here" impulse that rigid planners never follow. While others stress about reservations and schedules, you're open to whatever the day brings. That's when the real stuff happens.

You're not opposed to planning. You just know that the plan is the starting point, not the destination. You've changed course mid-trip because something better came up, and you've never regretted it.

Your trips will have structure without rigidity. Suggestions instead of schedules. Room to wander, discover, and follow whatever catches your eye. We'll give you the ingredients, not the recipe.`,
    youProbably: [
      "Have abandoned a carefully planned day within the first hour",
      "Trust your gut over reviews",
      "Get uncomfortable when every hour is accounted for",
      "Have your best travel stories from things that weren't in the plan"
    ],
    itineraryWillInclude: [
      "Breathing room and flexibility built in",
      "Suggestions instead of schedules",
      "The freedom to change everything",
      "Ingredients, not recipes"
    ],
    protectFrom: [
      "Over-scheduled days (we know you'll ignore half of it anyway)",
      "Reservations you can't escape",
      "The anxiety of 'missing' something"
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTORS
  // ═══════════════════════════════════════════════════════════════════════════

  social_butterfly: {
    id: 'social_butterfly',
    name: 'The Social Butterfly',
    category: 'CONNECTOR',
    revealParagraph: `For you, travel is a team sport.

The destination matters, sure. But you've had amazing trips to mediocre places because the people were right, and disappointing trips to dream destinations because you were with the wrong group. You come alive with others around.

The shared meals, the inside jokes, the "remember when" stories that last for years. You've made friends with strangers in hostel kitchens, on tours, at bars. Some of them you still talk to. Travel, for you, is as much about who you meet as where you go.

Your trips will be social by design. Group activities, shared experiences, places where you can meet people if you're traveling with a group or connect with others if you're not. We'll never stick you in isolation when you thrive on connection.`,
    youProbably: [
      "Have made lifelong friends in a hostel common room",
      "Can strike up a conversation with anyone, anywhere",
      "Choose social accommodations over private ones",
      "Come home with more contacts than photos"
    ],
    itineraryWillInclude: [
      "Social opportunities (tours, classes, communal experiences)",
      "Places where conversation happens naturally",
      "The energy of shared experiences",
      "Spots where you might meet interesting people"
    ],
    protectFrom: [
      "Isolation when you don't want it",
      "Private/exclusive experiences (unless you want them)",
      "Missing the social heartbeat of a place"
    ]
  },

  family_architect: {
    id: 'family_architect',
    name: 'The Family Architect',
    category: 'CONNECTOR',
    revealParagraph: `You travel to build something that lasts: your family's shared story.

Vacations aren't escapes for you. They're investments. You're thinking about what your kids will remember in twenty years, what photos will go on the wall, what moments will become family legends.

You've sat through long car rides and bedtime meltdowns because you know the payoff is worth it. You've learned to balance kid-friendly with parent-sane, adventure with nap time, new experiences with the comfort of routine. It's not always easy. But when it works, when you see your kid's face light up at something they've never seen before, nothing else comes close.

Your trips will be family-smart. Pacing that works for all ages, accommodations that make sense for your crew, experiences that are genuinely interesting for everyone (not just "kid-friendly" in name only). We'll help you build memories, not manage chaos.`,
    youProbably: [
      "Have researched nap-time-friendly activities",
      "Know which restaurants have good kids' menus AND good adult food",
      "Plan trips with everyone's needs in mind (including your own)",
      "Treasure the chaos because it makes the best stories"
    ],
    itineraryWillInclude: [
      "Activities that work for all ages",
      "Realistic pacing (kids have limits, adults do too)",
      "Some adult time (you're still a person)",
      "Memory-making moments the whole family will remember"
    ],
    protectFrom: [
      "Overly ambitious schedules (meltdown prevention)",
      "Kid-focused everything (you need things too)",
      "The exhaustion of constant logistics"
    ]
  },

  romantic_curator: {
    id: 'romantic_curator',
    name: 'The Romantic Curator',
    category: 'CONNECTOR',
    revealParagraph: `Travel is how you and your partner reconnect.

You've felt it: how being somewhere new together strips away the routine, the distractions, the autopilot of daily life. Suddenly you're seeing each other again. The long dinner with nowhere to be. The morning with no alarm. The experiences that become "our places" you'll talk about for years.

You care about atmosphere. The view from the room, the table at the restaurant, the timing of a sunset walk. These aren't frivolous details. They're the setting for what you're actually there for: each other.

Your trips will be designed for two. Romance isn't just about luxury (though we're not afraid of that). It's about intention. Experiences that bring you closer, environments that invite intimacy, and enough unscheduled time to actually be present with each other.`,
    youProbably: [
      "Request specific tables at restaurants",
      "Plan activities around sunset timing",
      "Know the difference between tourist-romantic and actually-romantic",
      "Remember small details your partner mentioned wanting"
    ],
    itineraryWillInclude: [
      "Genuinely romantic settings (not tourist-trap 'romantic')",
      "Intimate experiences over crowded ones",
      "Moments designed for two",
      "Beauty in the details"
    ],
    protectFrom: [
      "Crowds killing the mood",
      "Generic 'couples' packages (champagne and roses, yawn)",
      "Missing the quiet magic"
    ]
  },

  community_builder: {
    id: 'community_builder',
    name: 'The Community Builder',
    category: 'CONNECTOR',
    revealParagraph: `You travel with a conscience.

You've thought about where your money goes, who benefits from your visit, whether your presence helps or harms. Not in a preachy way. You just can't enjoy a place if you know your trip is extracting more than it gives.

You seek out local businesses, guides from the community, experiences that create connection rather than consumption. You've probably stayed places that weren't the most convenient because they felt more authentic, more responsible, more right.

Your trips will reflect your values. We'll prioritize locally-owned, community-positive experiences. Places where your presence matters in a good way. Travel that enriches the places you visit, not just your Instagram.`,
    youProbably: [
      "Research how to support local communities before visiting",
      "Avoid chain restaurants and hotels",
      "Learn basic phrases to connect more genuinely",
      "Feel uncomfortable with overtourism"
    ],
    itineraryWillInclude: [
      "Meaningful local connections",
      "Community-supported businesses",
      "Opportunities to give back (if you want them)",
      "Experiences that benefit both you and the place"
    ],
    protectFrom: [
      "Exploitative tourism",
      "Experiences that harm local communities",
      "The guilt of being a passive consumer"
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACHIEVERS
  // ═══════════════════════════════════════════════════════════════════════════

  bucket_list_conqueror: {
    id: 'bucket_list_conqueror',
    name: 'The Bucket List Conqueror',
    category: 'ACHIEVER',
    revealParagraph: `You have a list. And you're working through it.

You know where you want to go before you die, and each trip is a chance to check something off. The pyramids. Machu Picchu. The Northern Lights. You want to see the places that humans have talked about for centuries, not because they're trendy, but because they matter.

Some people call it tourist-y. You don't care. You're not traveling to prove you're different. You're traveling to witness the things that everyone should see at least once.

Your trips will include the icons, without the amateur mistakes. We'll get you there, but at the right time, from the right angle, with the right context. No waiting in unnecessary lines or missing the thing you came for. You want to see it all, and we'll make sure you do.`,
    youProbably: [
      "Have a written list of places you'll visit before you die",
      "Feel genuine satisfaction when you cross something off",
      "Plan trips around specific experiences, not just destinations",
      "Know exactly what you came for and won't leave without it"
    ],
    itineraryWillInclude: [
      "The highlights (you should see them. They're famous for a reason)",
      "Efficient routing (time is precious)",
      "The experiences that will live on your wall",
      "Maximum impact within your time"
    ],
    protectFrom: [
      "Missing the thing you came for",
      "Inefficient scheduling that wastes time",
      "'Hidden gems' when you wanted the obvious gem"
    ]
  },

  adrenaline_architect: {
    id: 'adrenaline_architect',
    name: 'The Adrenaline Architect',
    category: 'ACHIEVER',
    revealParagraph: `You don't do "relaxing" vacations. You do stories.

The trips that stay with you are the ones where something happened, where you pushed yourself, took a risk, felt your heart pound. The moment you almost didn't make it. The view that required a climb. The thing that scared you a little before you did it.

Other people need to "recover" from vacation. You come back charged. The discomfort, the challenge, the not-knowing-how-it-would-turn-out. That's not a bug. That's the feature.

Your trips will have edge. We'll find the experiences that require something from you and give something back. Not reckless, but not safe either. You want to feel alive, and we'll make sure you do.`,
    youProbably: [
      "Have a story that starts with 'So I signed the waiver...'",
      "Feel restless after two hours on a beach",
      "Have convinced reluctant friends to try something that terrified them",
      "Come back from trips more energized than when you left"
    ],
    itineraryWillInclude: [
      "Real adventure (not 'adventure-lite')",
      "Physical challenges that mean something",
      "The rush of doing something hard",
      "Stories you'll tell forever"
    ],
    protectFrom: [
      "Boring days with nothing happening",
      "'Adventure' that's actually just a bus tour",
      "Over-cautious itineraries"
    ]
  },

  collection_curator: {
    id: 'collection_curator',
    name: 'The Passport Collector',
    category: 'ACHIEVER',
    revealParagraph: `You have a thing. And it shapes how you see the world.

Maybe it's wine regions. Maybe it's modernist architecture. Maybe it's stadiums, or jazz clubs, or ancient ruins. Whatever it is, it gives you a lens that most travelers don't have, and it leads you to places they'll never find.

You've probably planned entire trips around your interest while others thought you were obsessive. You know better. The obsession is what makes it interesting. Going deep on something is more rewarding than going wide on everything.

Your trips will feed your focus. We'll build around your interest, not despite it. The hidden gems, the expert experiences, the places that only matter if you know why they matter. Your thing is the organizing principle.`,
    youProbably: [
      "Have a niche interest that drives your travel choices",
      "Know more about your specialty than most tour guides",
      "Have spent hours on something others walked past in minutes",
      "Plan trips around a single experience related to your passion"
    ],
    itineraryWillInclude: [
      "Deep focus on what you actually care about",
      "Expert-level experiences in your interest",
      "The freedom to spend hours on one thing",
      "Access to the serious stuff"
    ],
    protectFrom: [
      "Generalist tourism that bores you",
      "Rushing past the things you came for",
      "'Well-rounded' itineraries that round off your passion"
    ]
  },

  status_seeker: {
    id: 'status_seeker',
    name: 'The VIP Voyager',
    category: 'ACHIEVER',
    revealParagraph: `You want the experiences that aren't available to everyone.

Not because you're showing off, though you're not embarrassed by nice things, but because access opens doors that regular travel can't reach. The private tour after hours. The table that's not on the reservation system. The room that most guests don't know exists.

You've worked hard. You've earned the right to travel at a level that matches your life. The premium isn't wasted on you. You actually notice the difference, appreciate the details, and take full advantage of what you're paying for.

Your trips will reflect that. VIP access, exclusive experiences, the insider track that most travelers never see. Not flashy for flashy's sake, but premium where it actually matters.`,
    youProbably: [
      "Know which credit card points get the best upgrades",
      "Have a preferred hotel chain (and status to match)",
      "Appreciate the difference between expensive and excellent",
      "Expect service that matches what you're paying"
    ],
    itineraryWillInclude: [
      "Premium experiences worth talking about",
      "VIP access where it exists",
      "Quality that justifies the investment",
      "Impressive without being ostentatious"
    ],
    protectFrom: [
      "Tourist-trap 'luxury' (we know the difference)",
      "Overpaying for underwhelming experiences",
      "Missing the actually exclusive stuff"
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RESTORERS
  // ═══════════════════════════════════════════════════════════════════════════

  zen_seeker: {
    id: 'zen_seeker',
    name: 'The Zen Seeker',
    category: 'RESTORER',
    revealParagraph: `You travel to find something inside yourself.

It sounds abstract, but you know exactly what it means. The retreats, the meditation sessions, the places that strip away distraction and let you hear your own thoughts. You're not escaping. You're arriving. At yourself.

Not everyone understands this kind of travel. They think vacation means sightseeing, activities, doing. You know that sometimes the most valuable trip is one where you do almost nothing, and return completely different.

Your trips will honor that. Contemplative spaces, spiritual depth, room for silence. We won't fill your days with noise when what you need is stillness. The inner journey is just as valid as the outer one.`,
    youProbably: [
      "Have meditated on multiple continents",
      "Choose destinations by energy, not attractions",
      "Seek silence as actively as others seek activities",
      "Return from trips more centered than when you left"
    ],
    itineraryWillInclude: [
      "Spiritual and contemplative spaces",
      "Silence and solitude when you need it",
      "Time for practice (meditation, yoga, whatever yours is)",
      "Peace over stimulation"
    ],
    protectFrom: [
      "Noise and crowds when you need quiet",
      "Over-scheduled days (space is sacred)",
      "Surface-level 'wellness' tourism"
    ]
  },

  retreat_regular: {
    id: 'retreat_regular',
    name: 'The Retreat Regular',
    category: 'RESTORER',
    revealParagraph: `You've learned that real rest requires structure.

Left to your own devices, you'd still check email on the beach, squeeze in one more sight, not fully unplug. You need something external to hold the space: a program, a schedule, a setting designed for restoration.

That's why retreats, spas, and wellness resorts work for you. They give you permission to do what you actually need: nothing. Yoga at 7am. Massage at 2pm. Dinner at a set time. The structure liberates you from having to decide.

Your trips will be restoration-forward. We'll find the places that know how to take care of you, where everything is designed to help you let go, not keep going.`,
    youProbably: [
      "Have a go-to retreat you return to",
      "Consider spa time essential, not extra",
      "Feel no guilt about unstructured days",
      "Return from vacation genuinely rested (not needing another one)"
    ],
    itineraryWillInclude: [
      "Real restoration (not 'relaxing' that's actually exhausting)",
      "Wellness without the woo-woo (unless you want it)",
      "Permission to do nothing",
      "Coming home better than you left"
    ],
    protectFrom: [
      "Feeling guilty about rest",
      "Itineraries that exhaust you",
      "'Wellness' that's actually work"
    ]
  },

  beach_therapist: {
    id: 'beach_therapist',
    name: 'The Beach Therapist',
    category: 'RESTORER',
    revealParagraph: `Your happy place has sand and water.

You've discovered the simplest truth about vacation: sometimes you just need to be horizontal. The sound of waves. A book. A drink. Nowhere to be, nothing to do, no one expecting anything from you.

Other people feel guilty for "wasting" a trip on a beach. You've stopped caring what other people think. The beach isn't wasted time. It's the point.

Your trips will prioritize sun, water, and simplicity. We won't overload you with activities or make you feel bad about doing nothing. Sometimes the best trips are the ones where you come back tan, rested, and with very few photos.`,
    youProbably: [
      "Have a favorite beach you return to",
      "Can happily spend an entire day doing nothing",
      "Feel confused when people ask what you'll 'do' at the beach",
      "Find the sound of waves genuinely healing"
    ],
    itineraryWillInclude: [
      "Beach time (obviously)",
      "Minimal scheduling (the point is no schedule)",
      "Good spots to do nothing",
      "Maybe some good seafood (you're not dead)"
    ],
    protectFrom: [
      "Pressure to 'do' things",
      "Itineraries that ignore the beach",
      "Guilt about having no plans"
    ]
  },

  slow_traveler: {
    id: 'slow_traveler',
    name: 'The Slow Traveler',
    category: 'RESTORER',
    revealParagraph: `You've never understood people who "do" a city in two days.

For you, the best moments happen when you're not trying to get somewhere else. The three-hour lunch. The morning at a café with nowhere to be. The second day in a neighborhood, when you start to recognize faces.

You've been told you're "wasting time" by not seeing more. You know better. You're not missing anything. You're actually there, which is more than most travelers can say.

Your trips will have room to breathe. Fewer destinations, more depth. Time built in for the unscheduled, the spontaneous, the nothing. We'll never pack your days so tight that you're always rushing to the next thing.`,
    youProbably: [
      "Have a favorite café in at least three cities",
      "Prefer staying a week over rushing through three destinations",
      "Get stressed when someone says 'let's see everything'",
      "Have spent an entire vacation day reading and called it perfect"
    ],
    itineraryWillInclude: [
      "Long, unrushed meals (because a 45-minute dinner is a crime)",
      "Breathing room between activities",
      "Permission to do nothing",
      "Fewer things, experienced fully"
    ],
    protectFrom: [
      "Packed schedules that exhaust you",
      "The tyranny of 'must-sees'",
      "Feeling rushed (ever)"
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CURATORS
  // ═══════════════════════════════════════════════════════════════════════════

  culinary_cartographer: {
    id: 'culinary_cartographer',
    name: 'The Culinary Cartographer',
    category: 'CURATOR',
    revealParagraph: `You've planned entire trips around a single restaurant reservation.

Food isn't fuel. It's the point. Where others see eating as an interruption to sightseeing, you see sightseeing as what you do between meals. Your travel research is mostly menus, reviews, and reservation availability.

You've probably eaten things that made other people uncomfortable. You've waited in lines that weren't worth it, and lines that absolutely were. You know the difference between a tourist trap and the real thing, and you'll walk an extra mile for the latter.

Your trips will be built around food. We'll organize your days around meals, not the other way around. The reservations, the hidden gems, the places you can't find on the first page of Google. That's where we'll take you.`,
    youProbably: [
      "Have a list of restaurants in cities you haven't even booked yet",
      "Know the difference between 'authentic' and 'touristy' by smell alone",
      "Have made friends over a shared table at a tiny restaurant",
      "Consider market visits non-negotiable"
    ],
    itineraryWillInclude: [
      "Serious food experiences (not tourist traps)",
      "The places locals actually eat",
      "Markets, cooking classes, food tours",
      "Time to eat properly (no 45-minute dinners)"
    ],
    protectFrom: [
      "Bad food (the ultimate travel crime)",
      "Wasted meals on mediocre restaurants",
      "Schedules that don't respect digestion"
    ]
  },

  art_aficionado: {
    id: 'art_aficionado',
    name: 'The Art Aficionado',
    category: 'CURATOR',
    revealParagraph: `You've stood in front of paintings longer than most people spend in the entire museum.

Art isn't something you "appreciate". It's something you need. A city's museums, galleries, and public art tell you more about a place than any guidebook could. You travel to see original works you've only known from reproductions, to feel the scale of something that doesn't translate to a screen.

You've probably built trips around exhibitions, timed specifically to catch something before it closes. That's not obsessive. That's having priorities.

Your trips will put art at the center. We'll know what's showing where, which collections are worth your time, and how to see the major works without the major crowds. Your itinerary will treat museums as destinations, not checkboxes.`,
    youProbably: [
      "Have spent three hours in one room of a museum",
      "Choose destinations based on exhibitions",
      "Notice architecture that others walk past",
      "Feel genuinely moved by encountering beauty"
    ],
    itineraryWillInclude: [
      "The art that matters (and time to actually see it)",
      "Beyond the obvious collections",
      "Design, architecture, aesthetic experiences",
      "Hours when you want hours"
    ],
    protectFrom: [
      "Rushing through museums",
      "Missing the pieces that would move you",
      "Philistine itineraries that skip the good stuff"
    ]
  },

  luxury_luminary: {
    id: 'luxury_luminary',
    name: 'The Luxury Luminary',
    category: 'CURATOR',
    revealParagraph: `You know the difference between expensive and good.

You're not impressed by price tags or brand names. You've stayed in overpriced hotels that weren't worth it, and mid-range places that exceeded expectations. What you value is quality: the details, the craftsmanship, the feeling that something was done with care.

You're not trying to impress anyone. You just appreciate the difference between excellence and mediocrity, and you're willing to invest in the former.

Your trips will reflect your discerning eye. Not luxury for its own sake, but quality where it matters. The places, experiences, and accommodations that earn their reputation, not the ones that just charge for it.`,
    youProbably: [
      "Can tell the difference between expensive and excellent",
      "Notice details others miss - thread count, glassware, service timing",
      "Have been underwhelmed by 'luxury' and delighted by unexpected quality",
      "Believe travel should be seamless, not stressful"
    ],
    itineraryWillInclude: [
      "Genuine quality (not overpriced mediocrity)",
      "The best version of every experience",
      "Service that anticipates what you need",
      "Details that matter"
    ],
    protectFrom: [
      "'Luxury' that's actually just expensive",
      "Tourist-trap premium pricing",
      "Settling for less than excellent"
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFORMERS
  // ═══════════════════════════════════════════════════════════════════════════

  eco_ethicist: {
    id: 'eco_ethicist',
    name: 'The Mindful Voyager',
    category: 'TRANSFORMER',
    revealParagraph: `You can't enjoy a trip if you know it's doing harm.

It's not that you're preachy about it. You've just done the math. You know that tourism can damage the places we claim to love, and you're not willing to pretend otherwise. So you ask questions, do research, make choices that reflect what you actually value.

Some people think this makes travel less fun. For you, it makes it more meaningful. Knowing that your trip enriched a local community, preserved rather than degraded, contributed instead of extracted. That's not a burden. That's the point.

Your trips will align with your values. Locally-owned, environmentally-conscious, community-positive. We'll find the experiences that let you travel well in both senses of the word.`,
    youProbably: [
      "Research sustainability claims before booking",
      "Choose slower transport when feasible",
      "Feel the tension between travel and environmental impact",
      "Seek out genuinely responsible operators"
    ],
    itineraryWillInclude: [
      "Sustainable choices where they exist",
      "Experiences that give back",
      "Lower-impact options",
      "The truth about environmental trade-offs"
    ],
    protectFrom: [
      "Greenwashing (we know who's real)",
      "Guilt without alternatives",
      "Missing out on experiences that are actually responsible"
    ]
  },

  gap_year_graduate: {
    id: 'gap_year_graduate',
    name: 'The Gap Year Graduate',
    category: 'TRANSFORMER',
    revealParagraph: `You'll sleep on a bad mattress if it means another week on the road.

Budget isn't a limitation for you. It's a strategy. You've learned to stretch money in ways that let you travel more, see more, do more. The five-star hotel doesn't tempt you when that money could fund a whole other trip.

You've probably earned some incredulous looks from people who don't get it. "You went there? And stayed where?" But you know what they don't: that the best experiences aren't the most expensive ones, and that discomfort is a small price for adventure.

Your trips will maximize experience per dollar. We'll find the places where budget doesn't mean compromise, where your money goes to what actually matters.`,
    youProbably: [
      "Know which day of the week flights are cheapest",
      "Have slept in airports more than once",
      "Consider walking an hour to save on transport",
      "Find budget constraints creative, not limiting"
    ],
    itineraryWillInclude: [
      "Genuine value (not tourist trap cheap)",
      "The tricks that stretch your budget",
      "Experiences that don't require wealth",
      "More trip for less money"
    ],
    protectFrom: [
      "Overpaying for anything",
      "Missing the cheap but amazing stuff",
      "Feeling lesser for having a budget"
    ]
  },

  midlife_explorer: {
    id: 'midlife_explorer',
    name: 'The Unscripted Explorer',
    category: 'TRANSFORMER',
    revealParagraph: `You've reached the point where you know what you want, and you're done apologizing for it.

You've traveled enough to understand your own preferences. You're not interested in proving anything or chasing what's cool. You want comfort without stuffiness, quality without pretension, experiences that match who you actually are.

You've earned the right to travel exactly how you want. No guilt about skipping the thing everyone says you "have to see." No pressure to keep up with a pace that doesn't work for you. Just good travel, your way.

Your trips will reflect your self-knowledge. We won't give you the same itinerary we'd give a 25-year-old backpacker. We'll give you what actually works for who you are now, thoughtfully designed for someone who's past the phase of figuring it out.`,
    youProbably: [
      "No longer compromise on comfort",
      "Choose destinations that interest YOU, not what's trending",
      "Have zero interest in proving anything to anyone",
      "Know exactly what you like and don't like"
    ],
    itineraryWillInclude: [
      "Quality without pretense",
      "Comfort without guilt",
      "Experiences that genuinely interest YOU",
      "None of the 'should' destinations"
    ],
    protectFrom: [
      "Travel trends that don't serve you",
      "Discomfort in the name of 'authenticity'",
      "Anything that wastes your limited time"
    ]
  },

  sabbatical_scholar: {
    id: 'sabbatical_scholar',
    name: 'The Sabbatical Scholar',
    category: 'TRANSFORMER',
    revealParagraph: `Travel, for you, is education by another name.

You want to understand how the world got this way. The history, the context, the layers of meaning beneath the surface. A building isn't just a building. It's a story. A meal isn't just food. It's cultural transmission across generations.

You probably read about places before you go, and you definitely have more questions after you return. You've been accused of making trips "too serious." But you know that understanding makes everything richer.

Your trips will feed your curiosity. Historical context, local expertise, the stories that most visitors never hear. We'll give you the depth that turns sightseeing into genuine learning.`,
    youProbably: [
      "Read about destinations before visiting",
      "Get genuinely excited by historical context",
      "Find museums more energizing than exhausting",
      "Return home with new understanding, not just photos"
    ],
    itineraryWillInclude: [
      "Depth over breadth",
      "Expert access where possible",
      "The context that makes sites meaningful",
      "Time to actually learn, not just see"
    ],
    protectFrom: [
      "Surface-level tourism",
      "Missing the deeper story",
      "Itineraries that prioritize photos over understanding"
    ]
  },

  healing_journeyer: {
    id: 'healing_journeyer',
    name: 'The Healing Journeyer',
    category: 'TRANSFORMER',
    revealParagraph: `Travel has been medicine for you.

At some point, getting away wasn't just a vacation. It was survival. A breakup, a loss, a burnout, a life that needed to be processed far from where it happened. You've learned that new places can help you become new versions of yourself.

Not everyone travels for healing. Some people can't understand why you'd go somewhere hard when you're already hurting. But you know: sometimes the distance is the treatment. Sometimes you need to be a stranger to find yourself again.

Your trips will be gentle where they need to be and restorative by design. We'll create space for processing, for solitude, for the kind of travel that helps you come back different, not just rested.`,
    youProbably: [
      "Have traveled specifically to process something",
      "Find distance from home clarifying",
      "Use travel as a way to reconnect with yourself",
      "Return from trips feeling more whole"
    ],
    itineraryWillInclude: [
      "Gentle experiences (nothing too demanding)",
      "Space for processing",
      "Beauty that heals",
      "Permission to feel whatever you feel"
    ],
    protectFrom: [
      "Pressure to be 'on'",
      "Exhausting itineraries",
      "Anything that depletes instead of restores"
    ]
  },

  retirement_ranger: {
    id: 'retirement_ranger',
    name: 'The Boundless Explorer',
    category: 'TRANSFORMER',
    revealParagraph: `You've been waiting for this.

For years, travel was squeezed into vacations between obligations. Now the obligations are fewer, and the time is yours. You have a list of places you've been putting off, experiences you've been saving for "someday," and someday is now.

You want to do it right. Not rushed, not uncomfortable, not compromised. You've earned the version of travel that works for your body and your preferences, without apology.

Your trips will honor both your ambition and your needs. The bucket list items, done smartly. The pacing that works for this chapter. Experiences that feel earned, not grueling, because you've put in enough grueling to last a lifetime.`,
    youProbably: [
      "Have a list of 'someday' destinations you're finally visiting",
      "Appreciate comfort more than you used to",
      "Have the time to do things properly",
      "Know exactly what you like after decades of learning"
    ],
    itineraryWillInclude: [
      "The bucket list items (no more 'someday')",
      "Comfortable pacing (you've earned it)",
      "Quality experiences (you've waited long enough)",
      "None of the rushing of younger years"
    ],
    protectFrom: [
      "Exhausting schedules",
      "Physical demands beyond your preference",
      "Anyone treating you like you're fragile (unless you want that)"
    ]
  },

  balanced_story_collector: {
    id: 'balanced_story_collector',
    name: 'The Balanced Story Collector',
    category: 'TRANSFORMER',
    revealParagraph: `You're not easily categorized, and that's a good thing.

You don't have a single dominant travel priority. You like good food, but you're not obsessed. You enjoy being active, but also value rest. You want cultural experiences, but not at the expense of having fun. You're the friend who's up for anything.

Some quizzes probably frustrate you with their forced choices. You want the balance, a little of this, a little of that, because variety is what makes travel interesting.

Your trips will reflect your range. We won't pigeonhole you into one type of experience. We'll build itineraries that mix adventure with relaxation, culture with pleasure, famous sites with hidden gems. A little of everything, well-executed, because that's what actually works for you.`,
    youProbably: [
      "Enjoy a mix of activities on any trip",
      "Get bored with too much of any one thing",
      "Appreciate both famous sites AND local secrets",
      "Like having a plan but leaving room for surprises"
    ],
    itineraryWillInclude: [
      "A bit of everything",
      "Balance between active and restful",
      "Famous sites AND hidden gems",
      "Flexibility within structure"
    ],
    protectFrom: [
      "Missing any major dimension of a place",
      "Too much of any one thing",
      "Itineraries that skew extreme"
    ]
  }
};

/**
 * Get reveal data for an archetype, with fallback
 */
export function getArchetypeReveal(archetypeId: string): ArchetypeReveal | null {
  const normalizedId = archetypeId.toLowerCase().replace(/\s+/g, '_');
  return ARCHETYPE_REVEALS[normalizedId] || null;
}

/**
 * Get all archetypes in a category
 */
export function getArchetypesByCategory(category: ArchetypeReveal['category']): ArchetypeReveal[] {
  return Object.values(ARCHETYPE_REVEALS).filter(a => a.category === category);
}
