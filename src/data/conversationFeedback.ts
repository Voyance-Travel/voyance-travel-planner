/**
 * Conversation Feedback System
 * Short, warm responses that make every interaction feel like a dialogue
 * 
 * The goal: "It's weird, I felt like it was actually talking to me."
 */

// ============================================================================
// QUIZ FEEDBACK - After each answer selection
// ============================================================================

export const quizFeedback: Record<string, Record<string, string>> = {
  // Pace/Energy
  pace: {
    slow: "No rushing. Got it.",
    moderate: "Balanced rhythm. Nice.",
    fast: "You like to move. We'll pack it in.",
    relaxed: "Permission to breathe. Noted.",
    flexible: "Read the room, adjust as you go.",
  },
  
  // Budget
  budget: {
    budget: "Stretch every dollar. We know the tricks.",
    moderate: "Splurge where it counts. Smart.",
    luxury: "Life's short. We'll make it exceptional.",
    value: "Maximum experience, minimum spend.",
    premium: "Quality first. We respect that.",
  },
  
  // Morning preference
  morning: {
    early: "First light is magic. We'll get you there.",
    late: "Sleep in. Mornings are optional.",
    flexible: "We won't force 6am anything.",
    depends: "Depends on the day. Fair enough.",
  },
  
  // Crowds
  crowds: {
    avoid: "Same. We'll route around the chaos.",
    tolerate: "You can handle it. Opens up options.",
    enjoy: "Energy of the crowd. We get it.",
    depends: "Context matters. We'll choose wisely.",
  },
  
  // Food importance
  food: {
    everything: "A fellow food person. This is going to be good.",
    priority: "Food is the trip. We get it.",
    important: "Good food matters. We'll find it.",
    fuel: "Eat to live. We'll keep it simple.",
  },
  
  // Adventure level
  adventure: {
    high: "You want stories. We'll give you stories.",
    moderate: "Some thrills, some chill. Balance.",
    low: "Comfort zone is underrated.",
    extreme: "Full send. We're here for it.",
  },
  
  // Planning style
  planning: {
    detailed: "You like to know what's coming.",
    loose: "Room to wander. We'll leave gaps.",
    spontaneous: "Plans are suggestions anyway.",
    delegator: "Let someone else figure it out. Valid.",
  },
  
  // Social preference
  social: {
    solo: "Just you. The most honest way to travel.",
    small_group: "Intimate crew. Quality over quantity.",
    large_group: "The more the merrier.",
    mix: "Depends on the moment. We'll balance.",
  },
  
  // Traveler type
  traveler_type: {
    explorer: "Curiosity is your compass.",
    relaxer: "Rest is the point. We agree.",
    adventurer: "Thrill-seeker. Noted.",
    cultural: "Deep diver. We'll go beneath the surface.",
    foodie: "Taste is how you travel. Perfect.",
    connector: "People make the place.",
    achiever: "Stories to tell. Goals to hit.",
  },
  
  // Accommodation
  accommodation: {
    budget: "Cheap and clean. We'll find it.",
    boutique: "Character over chain. Good taste.",
    luxury: "Only the best. We'll deliver.",
    unique: "Treehouse? Boat? We're into it.",
    airbnb: "Live like a local. Smart move.",
  },
  
};

// Generic positive responses for unmapped answers
const positiveResponses = [
  "Got it.",
  "Noted.",
  "Good choice.",
  "Makes sense.",
  "We hear you.",
  "Perfect.",
];

/**
 * Get feedback for a quiz answer
 * Returns a short, warm acknowledgment
 */
export function getQuizFeedback(questionId: string, answerValue: string): string | null {
  const normalized = answerValue.toLowerCase().replace(/[\s-]/g, '_');
  
  // Try exact match first
  const questionFeedback = quizFeedback[questionId];
  if (questionFeedback && questionFeedback[normalized]) {
    return questionFeedback[normalized];
  }
  
  // Try partial match
  if (questionFeedback) {
    for (const [key, value] of Object.entries(questionFeedback)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
  }
  
  // Return a random positive response
  return positiveResponses[Math.floor(Math.random() * positiveResponses.length)];
}

// ============================================================================
// TRIP SETUP FEEDBACK - As they fill the form
// ============================================================================

export const destinationFeedback: Record<string, string> = {
  // Major destinations
  tokyo: "Tokyo. Excellent choice.",
  kyoto: "Kyoto. Temples, gardens, and soul.",
  paris: "The eternal city. Always a good idea.",
  rome: "When in Rome... you know the rest.",
  florence: "Art, food, and magic around every corner.",
  barcelona: "Good food, great vibes.",
  london: "Brilliant. Cheers to that.",
  amsterdam: "Canals, bikes, and good times.",
  berlin: "History meets cool. Interesting pick.",
  new_york: "The city that never sleeps. Neither will you.",
  los_angeles: "LA. We'll find the real spots.",
  san_francisco: "Hills, fog, and fantastic food.",
  chicago: "Architecture, food, and culture. Solid.",
  miami: "Sun, sand, and Latin vibes.",
  bali: "Island time. We're jealous.",
  bangkok: "Temples, street food, and chaos. Perfect.",
  singapore: "Clean, green, and delicious.",
  hong_kong: "Dim sum alone is worth the trip.",
  seoul: "K-culture and incredible food.",
  sydney: "Beaches, coffee, and that bridge.",
  melbourne: "Coffee capital. Respect.",
  dubai: "Go big or go home. Got it.",
  lisbon: "Pastéis de nata await. Good call.",
  madrid: "Late nights and long lunches. We're in.",
  prague: "Fairy tale city. Beautiful choice.",
  vienna: "Coffee, culture, and classical music.",
  athens: "Where history comes alive.",
  istanbul: "East meets West. Fascinating pick.",
  marrakech: "Sensory overload in the best way.",
  cape_town: "Mountains, wine, and stunning views.",
  buenos_aires: "Tango, steak, and passion.",
  mexico_city: "Tacos, art, and incredible history.",
  hawaii: "Aloha. Paradise awaits.",
  iceland: "Fire and ice. Adventure time.",
  maldives: "Ultimate escape. You deserve it.",
  santorini: "Those sunsets. We get it.",
  amalfi: "Lemon groves and ocean views.",
  default: "Great destination. Let's plan this.",
};

/**
 * Get feedback for a destination
 */
export function getDestinationFeedback(destination: string): string {
  const normalized = destination.toLowerCase()
    .replace(/[,\s]+/g, '_')
    .replace(/[^a-z_]/g, '');
  
  // Try exact match
  if (destinationFeedback[normalized]) {
    return destinationFeedback[normalized];
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(destinationFeedback)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return destinationFeedback.default;
}

/**
 * Get feedback for trip duration
 */
export function getDurationFeedback(days: number): string {
  if (days <= 2) return "Quick escape. Every moment counts.";
  if (days <= 3) return "Short trip. We'll maximize it.";
  if (days <= 5) return "Perfect length. See enough, not too much.";
  if (days <= 7) return "A full week. Room to breathe.";
  if (days <= 10) return "Proper trip. We'll pace it right.";
  if (days <= 14) return "Extended adventure. Time to go deep.";
  return "Now that's a trip. We're impressed.";
}

/**
 * Get feedback for trip type
 */
export const tripTypeFeedback: Record<string, string> = {
  solo: "Solo. Total freedom.",
  couple: "Just the two of you. Special.",
  honeymoon: "Congratulations! Rest and romance incoming.",
  anniversary: "Celebrating the journey. Love that.",
  birthday: "Birthday trip! We'll make it memorable.",
  family: "Family mode. Kids covered.",
  "guys-trip": "The crew. We'll find the spots.",
  "girls-trip": "Squad trip. This is going to be fun.",
  friends: "Friends trip. Best kind of travel.",
  business: "Work trip with perks. Noted.",
  "business-leisure": "Bleisure. We'll maximize free time.",
  babymoon: "One last trip before everything changes.",
  graduation: "You earned this. Celebrate big.",
  retirement: "Freedom awaits. Let's plan it right.",
};

export function getTripTypeFeedback(tripType: string): string | null {
  const normalized = tripType.toLowerCase().replace(/[\s]/g, '-');
  return tripTypeFeedback[normalized] || null;
}

/**
 * Get feedback for first-time vs returning visitor
 */
export function getVisitorFeedback(isFirstTime: boolean, destination: string): string {
  const city = destination.split(',')[0].trim();
  if (isFirstTime) {
    return `First time in ${city}! Icons first, then the hidden gems.`;
  }
  return `Welcome back to ${city}. Time for the deeper cuts.`;
}

/**
 * Get feedback for child ages
 */
export function getChildAgeFeedback(age: number): string {
  if (age < 1) return "Baby on board. We'll keep it gentle.";
  if (age <= 3) return "Toddler detected. Nap time is sacred.";
  if (age <= 5) return "Little one coming. Short activities, lots of snacks.";
  if (age <= 8) return "Young explorer. Interactive stuff ahead.";
  if (age <= 12) return "Kid coming. We'll keep it fun for everyone.";
  if (age <= 15) return "Teenager. We'll include things they won't roll their eyes at.";
  return "Young adult. They can hang.";
}

/**
 * Get feedback for traveler count
 */
export function getTravelerCountFeedback(count: number): string {
  if (count === 1) return "Party of one. The purest way to travel.";
  if (count === 2) return "Two is perfect for exploring.";
  if (count <= 4) return `${count} travelers. Nimble crew.`;
  if (count <= 6) return `${count} people. We'll find group-friendly spots.`;
  if (count <= 10) return `${count} travelers! Big crew energy.`;
  return `${count} people. We'll work some magic.`;
}

// ============================================================================
// LOADING STATE MESSAGES - Personalized generation progress
// ============================================================================

/**
 * Build personalized loading messages based on trip context
 */
export function buildLoadingMessages(context: {
  archetype?: string;
  tripType?: string;
  hasToddler?: boolean;
  isFirstTime?: boolean;
  destination?: string;
  travelers?: number;
}): string[] {
  const messages: string[] = [];
  
  // Opening
  if (context.destination) {
    messages.push(`Building your ${context.destination.split(',')[0]} trip...`);
  } else {
    messages.push("Building your trip...");
  }
  
  // Archetype-specific
  switch (context.archetype?.toLowerCase().replace(/-/g, '_')) {
    case 'slow_traveler':
      messages.push("Adding breathing room between activities...");
      break;
    case 'adrenaline_architect':
      messages.push("Finding the adventures...");
      break;
    case 'culinary_cartographer':
      messages.push("Mapping out the best food spots...");
      break;
    case 'cultural_anthropologist':
      messages.push("Finding the authentic experiences...");
      break;
    case 'luxury_luminary':
      messages.push("Curating the finest options...");
      break;
    case 'zen_seeker':
      messages.push("Finding peaceful moments...");
      break;
    case 'flexible_wanderer':
      messages.push("Leaving room for spontaneity...");
      break;
    case 'beach_therapist':
      messages.push("Maximizing beach time...");
      break;
    case 'family_architect':
      messages.push("Making it work for everyone...");
      break;
    default:
      messages.push("Personalizing to your style...");
  }
  
  // Trip type specific
  switch (context.tripType?.toLowerCase()) {
    case 'honeymoon':
      messages.push("Adding romantic touches...");
      break;
    case 'family':
      messages.push("Finding family-friendly experiences...");
      break;
    case 'solo':
      messages.push("Curating solo-friendly spots...");
      break;
    case 'guys-trip':
    case 'girls-trip':
      messages.push("Finding the right group spots...");
      break;
    case 'anniversary':
      messages.push("Adding celebration moments...");
      break;
  }
  
  // Special conditions
  if (context.hasToddler) {
    messages.push("Protecting nap time (sacred)...");
  }
  
  if (context.isFirstTime) {
    messages.push("Including the icons you need to see...");
  } else if (context.isFirstTime === false) {
    messages.push("Skipping the tourist traps...");
  }
  
  if (context.travelers && context.travelers > 4) {
    messages.push("Finding group-friendly venues...");
  }
  
  // Closing
  messages.push("Almost there...");
  messages.push("You're going to love this.");
  
  return messages;
}

// ============================================================================
// MICRO-VALIDATIONS - Tiny acknowledgments throughout
// ============================================================================

export const microValidations = {
  saved: "Got it.",
  favorited: "Good eye. Saved.",
  removed: "Gone.",
  modified: "Your trip, your rules.",
  addedBuffer: "Smart. Best things happen in the gaps.",
  locked: "Locked in.",
  unlocked: "Flexible again.",
  regenerating: "Getting you something better...",
  swapped: "Better fit. Nice.",
};

// ============================================================================
// ITINERARY HEADER COPY - Archetype-specific headers
// ============================================================================

export const itineraryHeaderCopy: Record<string, {
  subtitle: string;
  note: string;
}> = {
  slow_traveler: {
    subtitle: "Slow pace",
    note: "We've left room to breathe. Long lunches, late starts, no 6am alarms. This is travel, not a marathon.",
  },
  adrenaline_architect: {
    subtitle: "Full throttle",
    note: "Packed but not insane. Every day has something memorable. You'll come back with stories.",
  },
  culinary_cartographer: {
    subtitle: "Food-focused",
    note: "Built around the meals. Markets, local spots, that dish you'll dream about. The sightseeing happens between bites.",
  },
  cultural_anthropologist: {
    subtitle: "Deep dive",
    note: "We went beyond the guidebooks. The real stories, the local rhythms, the places most miss.",
  },
  luxury_luminary: {
    subtitle: "Premium experience",
    note: "Only the finest. Skip the lines, best tables, experiences worth the investment.",
  },
  zen_seeker: {
    subtitle: "Peaceful pace",
    note: "Space to breathe, time to rest. You'll return renewed, not exhausted.",
  },
  flexible_wanderer: {
    subtitle: "Open ended",
    note: "Suggestions, not schedules. Follow your instincts. The best moments aren't planned.",
  },
  beach_therapist: {
    subtitle: "Coastal focus",
    note: "Maximum beach time. Salt air, ocean sounds, and not much else. Exactly right.",
  },
  family_architect: {
    subtitle: "Family mode",
    note: "Built around nap times, snack breaks, and keeping everyone happy. Parents, you're covered.",
  },
  wilderness_pioneer: {
    subtitle: "Adventure ahead",
    note: "Off the beaten path. Nature, challenge, and experiences you'll earn.",
  },
  default: {
    subtitle: "Your style",
    note: "Personalized to your preferences. This is travel done right.",
  },
};

/**
 * Get itinerary header copy for an archetype
 */
export function getItineraryHeaderCopy(archetypeId?: string): { subtitle: string; note: string } {
  if (!archetypeId) return itineraryHeaderCopy.default;
  const normalized = archetypeId.toLowerCase().replace(/-/g, '_');
  return itineraryHeaderCopy[normalized] || itineraryHeaderCopy.default;
}

// ============================================================================
// DAY HEADER FEEDBACK - Energy/mood indicators per day
// ============================================================================

/**
 * Get a day header note based on archetype and day context
 */
export function getDayHeaderNote(options: {
  archetype?: string;
  dayNumber: number;
  totalDays: number;
  isRestDay?: boolean;
  hasToddler?: boolean;
  tripType?: string;
}): { emoji: string; label: string; note: string } | null {
  const { archetype, dayNumber, totalDays, isRestDay, hasToddler, tripType } = options;
  const normalized = archetype?.toLowerCase().replace(/-/g, '_');
  
  // Special conditions first
  if (hasToddler) {
    return {
      emoji: "👶",
      label: "Toddler-paced",
      note: "Nap time protected. Early dinner. You know the drill.",
    };
  }
  
  if (tripType === 'honeymoon') {
    return {
      emoji: "💑",
      label: "Romance day",
      note: "Just the two of you. No rushing.",
    };
  }
  
  if (isRestDay) {
    return {
      emoji: "😌",
      label: "Rest day",
      note: "Take it easy. You've earned it.",
    };
  }
  
  // First day
  if (dayNumber === 1) {
    return {
      emoji: "✈️",
      label: "Arrival day",
      note: "Easy start. Shake off the travel, get your bearings.",
    };
  }
  
  // Last day
  if (dayNumber === totalDays) {
    return {
      emoji: "🧳",
      label: "Departure day",
      note: "We've kept it light. Enjoy those final moments.",
    };
  }
  
  // Archetype-specific for mid-trip days
  switch (normalized) {
    case 'slow_traveler':
      return {
        emoji: "😌",
        label: "Relaxed day",
        note: "No alarms today. Start when you start.",
      };
    case 'adrenaline_architect':
      return {
        emoji: "🔥",
        label: "Big day",
        note: "This is the one you'll remember. Pace yourself.",
      };
    case 'culinary_cartographer':
      return {
        emoji: "🍜",
        label: "Food day",
        note: "Today is about taste. Come hungry.",
      };
    case 'cultural_anthropologist':
      return {
        emoji: "🎭",
        label: "Culture day",
        note: "Go deep today. The real stories await.",
      };
  }
  
  return null; // No special note needed
}
