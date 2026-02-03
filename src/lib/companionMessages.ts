/**
 * Complete Companion Message Library
 * 
 * All messages the companion uses throughout the site, organized by state and context.
 * These messages are what make Voyance feel like a knowledgeable friend, not a tool.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANION STATES
// ═══════════════════════════════════════════════════════════════════════════════

export type CompanionState = 
  | 'stranger'        // Before quiz - we don't know them yet
  | 'getting_to_know' // During quiz - learning about them
  | 'revealed'        // Just saw archetype - excited/validated
  | 'planning'        // Creating a trip - collaborative
  | 'booked'          // Has an upcoming trip - anticipatory
  | 'traveling'       // Currently on trip - supportive
  | 'returned'        // Back from trip - reflective
  | 'loyal';          // Multiple trips - familiar

// ═══════════════════════════════════════════════════════════════════════════════
// STRANGER MESSAGES (Pre-Quiz)
// ═══════════════════════════════════════════════════════════════════════════════

export const strangerMessages = {
  homepage: {
    hero: "Travel planning that actually gets you.",
    subhero: "Most tools treat everyone the same. We learn how you actually travel.",
    cta: "Discover your travel style",
  },
  
  browse: {
    prompt: "Looking around? Smart. Take the quiz when you're ready. It changes everything.",
    pricing: "See what's included. Then find out who you are.",
    about: "We built this because every other travel site treats everyone the same. You're not everyone.",
  },
  
  nudges: {
    idle: "Curious what kind of traveler you are? 5 minutes, no spam.",
    secondVisit: "Back again? The quiz is still waiting.",
    afterBrowsing: "Ready to see how you actually travel?",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GETTING TO KNOW MESSAGES (During Quiz)
// ═══════════════════════════════════════════════════════════════════════════════

export const gettingToKnowMessages = {
  intro: "Let's figure out how you actually like to travel. Not how you think you should.",
  
  progress: {
    early: "Starting to see a pattern here...",
    middle: "This is getting interesting.",
    late: "Almost there. One more section.",
    complete: "Got it. You're going to like this.",
  },
  
  sections: {
    pace: "First, let's talk about pace.",
    interests: "What draws you to a place?",
    style: "How do you like to experience things?",
    social: "Travel companions and social style.",
    priorities: "What matters most?",
  },
  
  transitions: [
    "Interesting.",
    "Starting to see a picture here.",
    "This is helpful.",
    "Got it.",
    "Makes sense.",
    "Noted.",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// REVEALED MESSAGES (Post-Quiz)
// ═══════════════════════════════════════════════════════════════════════════════

export const revealedMessages = {
  preReveal: "Here's who you are as a traveler...",
  
  postReveal: {
    validation: "This is who you are as a traveler.",
    promise: "Every trip we plan will honor this.",
    sharePrompt: "Know someone who needs to see this? Share it.",
    nextStep: "Ready to put this to work? Let's plan a trip.",
  },
  
  returnVisit: {
    greeting: "Welcome back.",
    prompt: "Ready to plan something?",
    withName: (name: string) => `Welcome back, ${name}.`,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLANNING MESSAGES (Creating Trip)
// ═══════════════════════════════════════════════════════════════════════════════

export const planningMessages = {
  start: {
    default: "Let's plan something.",
    withArchetype: (archetype: string) => `Let's plan something perfect for a ${archetype}.`,
  },
  
  destination: {
    prompt: "Where to?",
    unknownCity: "New territory. We're excited too.",
    knownCities: {
      tokyo: "Tokyo. Excellent choice.",
      paris: "The eternal city. Always a good idea.",
      rome: "When in Rome... you know the rest.",
      barcelona: "Good food, great vibes.",
      london: "Brilliant. Cheers to that.",
      new_york: "The city that never sleeps. Neither will you.",
      bali: "Island time. We're jealous.",
      lisbon: "Hidden gem, but not for long.",
      amsterdam: "Canals, bikes, and good times.",
      berlin: "Edge and history. Great pick.",
      kyoto: "Traditional and timeless.",
      bangkok: "Chaos in the best way.",
      dubai: "Go big or go home.",
      sydney: "Beaches and beyond.",
      singapore: "Clean, green, and delicious.",
      mexico_city: "Culture meets incredible food.",
      buenos_aires: "Passion in every corner.",
      marrakech: "Sensory overload. You'll love it.",
      cape_town: "Where mountains meet the sea.",
      iceland: "Fire and ice. Unforgettable.",
      default: "Great destination. Let's plan this.",
    },
  },
  
  dates: {
    prompt: "When?",
    responses: {
      weekend: (days: number) => `${days} days. Quick trip. We'll make every hour count.`,
      short: (days: number) => `${days} days. Short and sweet.`,
      week: (days: number) => `${days} days. Nice length. Room to breathe.`,
      extended: (days: number) => `${days} days. Proper trip. We'll pace it right.`,
      long: (days: number) => `${days} days. Time to really know the place.`,
    },
    getDurationResponse: (days: number): string => {
      if (days <= 3) return planningMessages.dates.responses.weekend(days);
      if (days <= 5) return planningMessages.dates.responses.short(days);
      if (days <= 8) return planningMessages.dates.responses.week(days);
      if (days <= 12) return planningMessages.dates.responses.extended(days);
      return planningMessages.dates.responses.long(days);
    },
  },
  
  tripType: {
    prompt: "What's the occasion?",
    responses: {
      solo: "Solo. Total freedom. We'll find the best spots for one.",
      couple: "Just the two of you. We'll make it special.",
      honeymoon: "Congratulations! We'll build in rest. You just survived a wedding.",
      anniversary: "Celebrating the journey. Love that.",
      birthday: "Birthday trip! We'll make it memorable.",
      family: "Family mode activated. We've got the kids covered.",
      'guys-trip': "The crew. We'll find the right spots.",
      'girls-trip': "Squad trip. This is going to be fun.",
      friends: "Friends trip. Best kind of travel.",
      business: "Work trip with perks. We'll maximize your free time.",
      babymoon: "Last trip before baby. Gentle and special.",
      default: "Got it. We'll plan accordingly.",
    },
  },
  
  context: {
    firstTime: {
      prompt: "Been here before?",
      yes: "Welcome back. Time for the deeper cuts.",
      no: "First time! We'll make sure you see the essentials.",
    },
    hotel: {
      prompt: "Know where you're staying?",
      provided: "Good to know. We'll plan around that.",
      skipped: "No problem. We'll keep it flexible.",
    },
    flights: {
      prompt: "Have flight times?",
      provided: "We'll work around those.",
      skipped: "We'll plan full days.",
      earlyDeparture: "Early flight. We'll get you out clean.",
      lateArrival: "Late arrival. Easy first day.",
    },
    children: {
      toddler: "Toddler aboard. Nap time is sacred.",
      young: "Young ones coming. We'll keep it manageable.",
      teen: "Teenager in tow. We'll keep it interesting for them.",
    },
  },
  
  generating: {
    start: (dest: string) => `Building your ${dest} trip...`,
    final: "Almost there...",
    complete: "You're going to love this.",
    archetypeMessages: {
      slow_traveler: [
        "Building in time to actually enjoy things...",
        "Making sure there's no rushing...",
        "Adding breathing room...",
      ],
      adrenaline_architect: [
        "Finding the adventures...",
        "Making sure every day has something big...",
        "Packing in the good stuff...",
      ],
      culinary_cartographer: [
        "Mapping out the best food spots...",
        "Finding the places locals actually eat...",
        "Building around the meals...",
      ],
      flexible_wanderer: [
        "Leaving lots of room to explore...",
        "Building in flexibility...",
        "Creating options, not obligations...",
      ],
      cultural_anthropologist: [
        "Finding the authentic experiences...",
        "Adding context and depth...",
        "Looking beyond the tourist zones...",
      ],
      urban_nomad: [
        "Finding the best neighborhoods...",
        "Adding places to walk and discover...",
        "Building in city vibes...",
      ],
      zen_seeker: [
        "Protecting space for peace...",
        "Adding quiet moments...",
        "Building in restoration...",
      ],
      family_architect: [
        "Making it work for everyone...",
        "Protecting family time...",
        "Adding kid-friendly magic...",
      ],
      romantic_curator: [
        "Adding romantic touches...",
        "Finding intimate spots...",
        "Creating moments for two...",
      ],
      bucket_list_conqueror: [
        "Including the highlights...",
        "Making sure you see the essentials...",
        "Maximizing your time...",
      ],
      default: [
        "Personalizing for your style...",
        "Finding the right experiences...",
        "Almost ready...",
      ],
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKED MESSAGES (Upcoming Trip)
// ═══════════════════════════════════════════════════════════════════════════════

export const bookedMessages = {
  countdown: {
    far: (days: number) => `${days} days away. Plenty of time to get excited.`,
    month: (days: number) => `${days} days. Starting to feel real?`,
    weeks: (days: number) => `${days} days. Time to think about packing.`,
    week: "Next week. It's happening.",
    days: (days: number) => `${days} days. So close.`,
    tomorrow: "Tomorrow. You ready?",
    today: "Today's the day.",
    
    getCountdown: (days: number): string => {
      if (days > 45) return bookedMessages.countdown.far(days);
      if (days > 21) return bookedMessages.countdown.month(days);
      if (days > 7) return bookedMessages.countdown.weeks(days);
      if (days > 1) return bookedMessages.countdown.days(days);
      if (days === 1) return bookedMessages.countdown.tomorrow;
      return bookedMessages.countdown.today;
    },
  },
  
  reminders: [
    "Checked your reservations?",
    "Don't forget: that restaurant needs booking.",
    "Weather's looking good for your trip.",
    "Passport? Tickets? The important stuff?",
    "Started your packing list?",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRAVELING MESSAGES (On Trip)
// ═══════════════════════════════════════════════════════════════════════════════

export const travelingMessages = {
  dayStart: {
    default: (day: number) => `Day ${day}. Here's what's ahead.`,
    byArchetype: {
      slow_traveler: "No alarm today. Start when you start.",
      adrenaline_architect: "Big day ahead. Let's go.",
      culinary_cartographer: "Coffee first. Then the food tour.",
      zen_seeker: "Breathe. The day will unfold.",
      flexible_wanderer: "Plans are suggestions. Follow your instincts.",
      beach_therapist: "Ocean's waiting.",
      default: "Good morning. Here's your day.",
    },
  },
  
  midDay: "How's it going out there?",
  evening: "Good day? Rest up. Tomorrow's got more.",
  
  flexibility: "Plans change. That's fine. Tap anything to adjust.",
  
  encouragement: [
    "You're doing it. You're actually there.",
    "How does it feel?",
    "This moment won't come again. Enjoy it.",
    "Present tense. This is happening.",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// RETURNED MESSAGES (Back from Trip)
// ═══════════════════════════════════════════════════════════════════════════════

export const returnedMessages = {
  welcomeBack: "You're back. How was it?",
  
  reflection: {
    prompt: "What was the highlight?",
    feedbackAsk: "What worked? What didn't? Help us get better.",
  },
  
  next: {
    nudge: "Already thinking about the next one?",
    suggestion: (dest: string) => `Based on that trip, you might love ${dest}.`,
  },
  
  memory: (destination: string, daysAgo: number) => 
    `That ${destination} trip was ${daysAgo} days ago. Still thinking about it?`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOYAL MESSAGES (Multiple Trips)
// ═══════════════════════════════════════════════════════════════════════════════

export const loyalMessages = {
  greeting: (name: string, archetype: string) => 
    `${name}. Good to see you. What's next for our favorite ${archetype}?`,
  
  tripCount: (count: number) => 
    `Trip ${count} together. We've got a good thing going.`,
  
  rememberPreferences: "We remember your preferences. Still the same?",
  
  suggestDestination: (destination: string) => 
    `Based on your trips, you might love ${destination} next.`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATES
// ═══════════════════════════════════════════════════════════════════════════════

export const emptyStateMessages = {
  noTrips: {
    headline: "No trips yet",
    subhead: "Your travel story starts with the first one.",
    cta: "Plan your first trip",
    note: "We're ready when you are.",
  },
  
  noSavedPlaces: {
    headline: "Nothing saved yet",
    subhead: "When you find something you love, save it here.",
    note: "The good stuff will pile up.",
  },
  
  noPastTrips: {
    headline: "No past trips",
    subhead: "Once you travel with us, your memories live here.",
    note: "Future you will thank present you.",
  },
  
  quizIncomplete: {
    headline: "We don't know you yet",
    subhead: "Take the quiz so we can plan trips that actually fit you.",
    cta: "Take the quiz",
    note: "5 minutes. Changes everything.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR STATES
// ═══════════════════════════════════════════════════════════════════════════════

export const errorMessages = {
  generic: {
    headline: "Something went wrong",
    subhead: "Not your fault. Let's try that again.",
    cta: "Try again",
  },
  
  network: {
    headline: "Connection trouble",
    subhead: "The internet hiccupped. Give it another shot.",
    cta: "Retry",
  },
  
  generationFailed: {
    headline: "Trip generation hit a snag",
    subhead: "Rare, but it happens. Let's try once more.",
    cta: "Generate again",
  },
  
  notFound: {
    headline: "Can't find that",
    subhead: "Whatever you're looking for isn't here. Let's get you somewhere useful.",
    cta: "Go home",
  },
  
  sessionExpired: {
    headline: "You got logged out",
    subhead: "It's been a while. Sign back in and pick up where you left off.",
    cta: "Sign in",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ITINERARY HEADERS BY ARCHETYPE
// ═══════════════════════════════════════════════════════════════════════════════

export const itineraryHeaders = {
  slow_traveler: (destination: string, duration: number) => ({
    title: `Your ${destination} ${duration > 7 ? 'Journey' : 'Escape'}`,
    subtitle: "We've left room to breathe. Long lunches, late starts, no 6am alarms. This is travel, not a marathon.",
  }),
  
  adrenaline_architect: (destination: string) => ({
    title: `Your ${destination} Adventure`,
    subtitle: "Packed but not insane. Every day has something worth doing. You'll come back with stories.",
  }),
  
  culinary_cartographer: (destination: string) => ({
    title: `Your ${destination} Food Journey`,
    subtitle: "Built around the meals. Markets, local spots, that place you'll dream about later. The sightseeing happens between bites.",
  }),
  
  cultural_anthropologist: (destination: string) => ({
    title: `Your ${destination} Immersion`,
    subtitle: "Beyond the surface. We've found the authentic, the local, the meaningful. You'll understand this place, not just see it.",
  }),
  
  urban_nomad: (destination: string) => ({
    title: `Your ${destination} Wander`,
    subtitle: "Neighborhood by neighborhood. The real city reveals itself to those who walk it.",
  }),
  
  wilderness_pioneer: (destination: string) => ({
    title: `Your ${destination} Expedition`,
    subtitle: "Into the wild. We've found the trails, the views, the spaces where nature speaks loudest.",
  }),
  
  zen_seeker: (destination: string) => ({
    title: `Your ${destination} Retreat`,
    subtitle: "Space to breathe. Peace to find. This trip is medicine, not activity.",
  }),
  
  beach_therapist: (destination: string) => ({
    title: `Your ${destination} Escape`,
    subtitle: "Ocean. Sand. Repeat. We've protected your nothing time.",
  }),
  
  family_architect: (destination: string) => ({
    title: `Your Family ${destination} Adventure`,
    subtitle: "Something for everyone. We've balanced kid magic with adult sanity.",
  }),
  
  romantic_curator: (destination: string) => ({
    title: `Your ${destination} Romance`,
    subtitle: "Moments designed for two. The details matter, and we've got them.",
  }),
  
  bucket_list_conqueror: (destination: string) => ({
    title: `Your ${destination} Checklist`,
    subtitle: "The highlights, efficiently planned. You came for the icons, you'll get the icons.",
  }),
  
  flexible_wanderer: (destination: string) => ({
    title: `Your ${destination} Options`,
    subtitle: "Ideas, not obligations. Change everything if you want. We won't mind.",
  }),
  
  default: (destination: string) => ({
    title: `Your ${destination} Trip`,
    subtitle: "Planned with your style in mind. Let's make it memorable.",
  }),
};

export function getItineraryHeader(archetype: string, destination: string, duration: number = 7) {
  const headerFn = itineraryHeaders[archetype as keyof typeof itineraryHeaders] 
    || itineraryHeaders.default;
  
  if (archetype === 'slow_traveler') {
    return (headerFn as typeof itineraryHeaders.slow_traveler)(destination, duration);
  }
  
  return (headerFn as (dest: string) => { title: string; subtitle: string })(destination);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAY MOODS
// ═══════════════════════════════════════════════════════════════════════════════

export interface DayMood {
  emoji: string;
  text: string;
}

export function getDayMood(
  dayType: 'arrival' | 'departure' | 'rest' | 'normal',
  intensity: 'low' | 'moderate' | 'high',
  archetype?: string
): DayMood {
  if (dayType === 'arrival') {
    return { emoji: '✈️', text: 'Arrival day. Take it easy.' };
  }
  
  if (dayType === 'departure') {
    return { emoji: '🧳', text: 'Departure day. One last walk?' };
  }
  
  if (dayType === 'rest') {
    return { emoji: '😌', text: 'Rest day. Permission to do nothing.' };
  }
  
  if (intensity === 'high') {
    if (archetype === 'slow_traveler') {
      return { emoji: '⚡', text: 'Fuller day. But still your pace.' };
    }
    return { emoji: '🔥', text: 'Big day. Let\'s go.' };
  }
  
  if (intensity === 'low') {
    return { emoji: '🌿', text: 'Light day. Room to breathe.' };
  }
  
  return { emoji: '🚶', text: 'Good day ahead.' };
}
