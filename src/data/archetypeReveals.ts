/**
 * Complete 27 Archetype Reveals - The "Screenshot Moments"
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

You ask questions that other tourists don't think to ask. You learn a few words of the language—not because you have to, but because it changes how people respond to you. You've left places feeling like you actually know something about how people live there, not just what the buildings look like.

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

You come alive in urban environments—the energy of crowded streets, the endless options, the feeling that something is always happening. Mountains and beaches are fine, but they don't pull at you the way a new city does. You want to get lost in neighborhoods, find the bar where locals actually go, eat dinner at 10pm because that's when things get interesting.

You probably have a list of cities you need to see—Tokyo, Buenos Aires, Istanbul, Berlin—and each one feels like a different world to explore. You're not there to relax. You're there to absorb.

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
    revealParagraph: `Nature isn't a day trip for you. It's the point.

You feel most yourself with dirt on your boots and no cell signal. The further from roads and crowds, the better. You've probably chosen destinations specifically because they're hard to get to. That's a feature, not a bug.

Other people need buildings and restaurants and museums. You need sky and silence and the feeling of being somewhere that doesn't care whether you're there or not. That's not lonely. That's freedom.

Travel for you is about the wild places that make you feel small in the best possible way.`,
    youProbably: [
      "Have slept under more stars than roofs",
      "Choose destinations based on trail access",
      "Feel more rested after a challenging hike than a beach day",
      "Get twitchy in cities after more than two days"
    ],
    itineraryWillInclude: [
      "Real nature, not manicured parks",
      "Distance from crowds and noise",
      "Physical challenge if you want it",
      "Space and silence"
    ],
    protectFrom: [
      "'Nature' that's actually a crowded tourist trail",
      "Over-scheduled wilderness (let the mountain breathe)",
      "City-heavy itineraries when you need trees"
    ]
  },

  digital_explorer: {
    id: 'digital_explorer',
    name: 'The Digital Explorer',
    category: 'EXPLORER',
    revealParagraph: `You experience travel through a modern lens—literally.

You've found amazing places through TikTok and planned trips around Instagram spots. Not because you're shallow, but because visual discovery is how you engage with the world. You want the shot. But you also want the experience that makes the shot worth taking.

You've probably been the one researching the best photo spots, the golden hour timing, the angle that makes the place come alive. That's not vanity—that's how you remember. How you share. How you connect.

Travel for you is worth capturing. And worth sharing.`,
    youProbably: [
      "Have discovered destinations through social media before any guidebook",
      "Know the best time of day for photos at places you haven't visited yet",
      "Curate your feed as carefully as your itinerary",
      "Get genuine joy from a perfectly captured moment"
    ],
    itineraryWillInclude: [
      "Photo-worthy moments (we'll tell you the best times)",
      "Places that look as good as they photograph",
      "Unique experiences worth sharing",
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
    name: 'The Flexible Wanderer',
    category: 'EXPLORER',
    revealParagraph: `Plans are suggestions. Good ones, maybe. But suggestions.

You've tried making detailed itineraries. They last about two hours before you see something interesting and abandon ship entirely. And honestly? Those detours are always the best part.

You trust your instincts more than any guidebook. The restaurant that looks good IS good. The street that seems interesting IS interesting. You don't need someone telling you what to do every hour—you need room to discover things yourself.

Other people get stressed without a plan. You get stressed WITH one.`,
    youProbably: [
      "Have abandoned a carefully planned day within the first hour",
      "Trust your gut over reviews",
      "Get uncomfortable when every hour is accounted for",
      "Have your best travel stories from things that weren't in the plan"
    ],
    itineraryWillInclude: [
      "Breathing room and flexibility built in",
      "Options, not obligations",
      "The freedom to change everything",
      "Discovery over direction"
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
    revealParagraph: `Travel is better with people. Especially people you haven't met yet.

You've made friends on trains, in hostels, at bars. You've had conversations with strangers that turned into dinner invitations. You've stayed in touch with people you met for one night in one city three years ago.

Solo travel doesn't mean lonely for you—it means open. Open to whoever shows up. The best trips have people in them. Stories. Laughter. That moment when you realize you're all in the same beautiful mess together.

Travel for you is a social experience. Even when you're alone.`,
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
    revealParagraph: `Travel is how you build memories with the people who matter most.

You've spent hours researching kid-friendly restaurants and activities that won't bore the adults. You've navigated the impossible balance of what the 5-year-old wants, what the teenager can tolerate, and what you and your partner actually need.

You know that the "perfect" trip isn't about perfect moments—it's about everyone being tired and happy at the end of the day. It's the inside jokes that start on vacation. The photo where everyone's laughing. The story you'll tell for years.

Travel for you is investment. In your family. In your memories.`,
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
    revealParagraph: `You believe travel should be beautiful. And shared.

You notice the details—the table with the view, the timing of sunset, the walk home through quiet streets. You don't just stumble into romantic moments; you create the conditions for them.

Some people think romance is cheesy. You know it's intentional. It's choosing the restaurant with the candlelight. It's finding the rooftop bar no one knows about. It's the effort of making something ordinary into something you'll both remember.

Travel for you is an act of love. For your partner. For beauty itself.`,
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
    revealParagraph: `Travel is a chance to give, not just take.

You've probably felt uncomfortable being "just a tourist"—taking photos, spending money, leaving nothing behind. You want to connect. To contribute. To leave a place a little better than you found it.

Maybe that's volunteering. Maybe it's supporting local businesses over chains. Maybe it's learning enough of the language to have a real conversation. You believe travelers have a responsibility to the places they visit.

Travel for you is exchange, not extraction.`,
    youProbably: [
      "Research how to support local communities before visiting",
      "Avoid chain restaurants and hotels",
      "Learn basic phrases to connect more genuinely",
      "Feel uncomfortable with overtourism"
    ],
    itineraryWillInclude: [
      "Meaningful local connections",
      "Opportunities to give back (if you want them)",
      "Community-supported businesses",
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
    revealParagraph: `You have a list. And you're checking it off.

Life is finite. The world is enormous. And there are things you WILL see before you die. The Northern Lights. Machu Picchu. That restaurant you've been reading about for years. You're not casual about this.

Some people meander through travel. You have goals. The trip isn't complete until you've done THE THING. Not because you can't enjoy the journey—but because the destination actually matters to you.

Travel for you is about making life count. One checked box at a time.`,
    youProbably: [
      "Have a written list of places you'll visit before you die",
      "Feel genuine satisfaction when you cross something off",
      "Plan trips around specific experiences, not just destinations",
      "Know exactly what you came for and won't leave without it"
    ],
    itineraryWillInclude: [
      "The highlights (you should see them—they're famous for a reason)",
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
    revealParagraph: `You don't do relaxing vacations. You do stories.

The best trips leave you with the moment you almost didn't make it. The thing that scared you until you did it. The challenge that made you feel more alive than any beach ever could.

Other people need to "recover" from vacation. You come back charged. The scrapes and sunburns are trophies. The fear you pushed through is the whole point.

Travel for you is testing yourself. And discovering you're capable of more than you thought.`,
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
    name: 'The Collection Curator',
    category: 'ACHIEVER',
    revealParagraph: `You don't just travel. You specialize.

Maybe it's wine regions. Maybe it's architecture. Maybe it's trains, or football stadiums, or contemporary art, or Michelin stars. Whatever your thing is, travel is how you pursue it deeply.

You've annoyed travel companions by spending three hours in one room of a museum while they wanted to move on. You've chosen destinations entirely because of one specific thing. You've read more about your interest than most experts.

Travel for you is depth, not breadth. Passion, not obligation.`,
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
    name: 'The Status Seeker',
    category: 'ACHIEVER',
    revealParagraph: `You've worked hard. Travel should reflect that.

You want the upgrade. The table they don't give to just anyone. The experience that isn't available to the general public. Not because you're showing off—because you know the difference between good and exceptional. And you've earned exceptional.

Some people settle. You don't. The details matter. The service matters. The story you tell when you get home matters. Life's too short for mediocre experiences.

Travel for you is living at the level you've achieved.`,
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
    revealParagraph: `Travel is spiritual practice.

You're not on vacation to see things. You're on vacation to be present. To breathe. To sit in silence somewhere beautiful and remember what actually matters.

You've probably sought out temples, retreats, meditation spaces. You've chosen destinations for their energy, not their attractions. You've come home from trips feeling more centered than when you left—and that was the whole point.

Travel for you is inner journey as much as outer one.`,
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
    revealParagraph: `You understand that rest is not laziness. It's necessity.

You've discovered that a week at a spa or wellness retreat isn't indulgent—it's how you function. You return to real life better. More patient. More present. More capable of handling everything that's waiting for you.

Some people feel guilty doing "nothing" on vacation. You know that nothing is something. The massage isn't extra. The slow morning isn't wasted time. The goal is restoration, and you take that seriously.

Travel for you is how you reset.`,
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
    revealParagraph: `Ocean. Sand. Done.

You don't need complex itineraries or cultural enrichment or bucket list achievements. You need the sound of waves, a book you may or may not read, and absolutely nothing on the schedule.

People ask "but what will you DO there?" and you genuinely don't understand the question. You'll swim. You'll nap. You'll watch the water. You'll finally think thoughts you've been too busy to think.

Travel for you is horizontal. And that's perfect.`,
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

What's the point of traveling if you're exhausted the whole time? If you're rushing from thing to thing, never actually experiencing any of it? If you come home needing a vacation from your vacation?

For you, the best moments happen when you're not trying to get somewhere else. The three-hour lunch. The morning at a café with nowhere to be. The afternoon you spent doing nothing and loved it.

You've been told you're "wasting time" when you travel. You know better. You're not missing anything. You're actually there.`,
    youProbably: [
      "Have a favorite café in at least three cities",
      "Have made friends abroad you still keep in touch with",
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

Food isn't fuel for you. It's the point. The market at 7am. The hole-in-the-wall only locals know. The thing you ate three years ago that you still think about.

You research restaurants the way other people research museums. You have opinions about bread. You've been known to evaluate a city by its food scene before considering anything else.

Other people see eating as an interruption to sightseeing. You see sightseeing as what you do between meals.`,
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
    revealParagraph: `You need beauty like you need oxygen.

You've stood in front of paintings until security thought something was wrong. You've chosen destinations for a single gallery. You've had your day made—truly made—by encountering something beautiful you didn't expect.

Some people "do" museums. You experience them. You have opinions. You see things others walk past. Art isn't decoration for you. It's essential.

Travel for you is a pilgrimage to beauty.`,
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

You've stayed in five-star hotels that weren't worth it and boutique gems that exceeded every expectation. You've learned that luxury isn't about price—it's about craft, attention, and getting every detail right.

You're not flashy about it. You just know what quality feels like. The sheets. The service. The food that's clearly made by someone who cares. Life's too short for anything less than excellent.

Travel for you is an exercise in taste.`,
    youProbably: [
      "Can tell the difference between expensive and excellent",
      "Notice details others miss—thread count, glassware, service timing",
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
    name: 'The Eco-Ethicist',
    category: 'TRANSFORMER',
    revealParagraph: `You think about the footprint you leave.

You've chosen trains over planes when you could. You've researched which hotels actually care about sustainability versus which ones just say they do. You've felt the tension between wanting to see the world and knowing that seeing it has costs.

You don't want to stop traveling. You want to do it responsibly. In a way that leaves places better, or at least not worse. In a way you can feel good about.

Travel for you is exploration with conscience.`,
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
    revealParagraph: `You stretch every dollar until it screams.

You've slept in airports, eaten grocery store dinners, and walked three miles to avoid a cab fare. Not because you had to—because that money buys another day somewhere amazing.

You've discovered that budget travel isn't lesser travel. It's often better. Closer to the ground. More connected to real places and real people. The hostel was better than the hotel would have been.

Travel for you is about maximum world, minimum cost.`,
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
    name: 'The Midlife Explorer',
    category: 'TRANSFORMER',
    revealParagraph: `You've reached the point where you know what you want.

You're past proving anything to anyone. Past choosing destinations for how they look on social media. Past suffering through uncomfortable experiences because you feel like you "should."

Now you travel for yourself. For the things that actually interest you. For comfort and quality without apology. For the simple pleasure of being somewhere beautiful with time to enjoy it.

Travel for you is finally doing it YOUR way.`,
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
    revealParagraph: `Travel is education that doesn't feel like it.

You want to understand how things work. Why cultures developed the way they did. What history left in the streets. You've read books about places before visiting them and felt the satisfaction of seeing what you studied.

Some people travel to relax. You travel to learn. Museums aren't obligations—they're the point. Historical context isn't boring—it's what makes everything make sense.

Travel for you is intellectual adventure.`,
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
    revealParagraph: `You travel to become whole again.

Maybe something broke. Maybe you're recovering. Maybe you just need distance from your regular life to remember who you are. Travel for you isn't escape—it's medicine.

You've discovered that new places can make you feel new. That walking streets where no one knows you can be profoundly healing. That sometimes you need to go far away to come back to yourself.

Travel for you is therapy. Literally.`,
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
    name: 'The Retirement Ranger',
    category: 'TRANSFORMER',
    revealParagraph: `You've waited your whole life for this.

All those trips you postponed. All those "somedays" that finally arrived. You have the time now. The freedom. And you're not wasting a minute of it.

You're not old—you're experienced. You know what you like. You've earned the right to comfort. And you've got a list of places you're finally going to see.

Travel for you is the reward for a life of work. Time to collect.`,
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
    revealParagraph: `You want it all—in moderation.

A little adventure. A little relaxation. Some culture. Some food. Famous things and hidden things. Plans and spontaneity. You don't need to specialize because you're genuinely interested in everything.

You've noticed that extreme travelers—the hardcore foodies, the adrenaline junkies, the total relaxers—seem to miss things. You want the whole picture. A trip that touches everything.

Travel for you is balanced, varied, and complete.`,
    youProbably: [
      "Enjoy a mix of activities on any trip",
      "Get bored with too much of any one thing",
      "Appreciate both famous sites and hidden gems",
      "Like having a plan but leaving room for surprises"
    ],
    itineraryWillInclude: [
      "A bit of everything",
      "Balance between active and restful",
      "Famous sites AND local secrets",
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
