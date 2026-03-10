/**
 * Archetype Teasers for Value-First Homepage
 * Maps single-question answers to archetype previews for the "one question hook"
 */

export const ONE_QUESTION_HOOK = {
  question: "It's 2pm on vacation and you're fading. You...",
  options: [
    { 
      value: 'push', 
      label: "Push through. Sleep when I'm dead.", 
      archetype: 'adrenaline_architect' 
    },
    { 
      value: 'cafe', 
      label: "Find a café and people-watch for an hour.", 
      archetype: 'slow_traveler' 
    },
    { 
      value: 'hotel', 
      label: "Head back to the hotel. Nap is calling.", 
      archetype: 'retreat_regular' 
    },
    { 
      value: 'explore', 
      label: "Get lost somewhere new. Tired but curious.", 
      archetype: 'flexible_wanderer' 
    },
  ],
};

export interface ArchetypeTeaser {
  name: string;
  oneLiner: string;
  typicalTrip: string[];
  yourTrip: string[];
}

export const ARCHETYPE_TEASERS: Record<string, ArchetypeTeaser> = {
  slow_traveler: {
    name: "Present Traveler",
    oneLiner: "You'd rather do 3 things well than 10 things rushed.",
    typicalTrip: [
      "6am alarm for sunrise spot",
      "4 museums in one day",
      "45-minute dinner",
      "Exhausted by day 3"
    ],
    yourTrip: [
      "Wake up when you wake up",
      "One neighborhood per day",
      "3-hour lunch with nowhere to be",
      "Actually relaxed"
    ],
  },
  adrenaline_architect: {
    name: "Adrenaline Architect",
    oneLiner: "You don't do 'relaxing' vacations. You collect stories.",
    typicalTrip: [
      "Sleep in, miss the good stuff",
      "Play it safe",
      "Tourist-friendly activities",
      "Nice photos, no stories"
    ],
    yourTrip: [
      "First one on the trail",
      "The thing that scares you a little",
      "Local adventures, not tour buses",
      "Stories you'll tell for years"
    ],
  },
  retreat_regular: {
    name: "The Wellness Devotee",
    oneLiner: "Vacation should feel like vacation. Rest is the point.",
    typicalTrip: [
      "Packed schedule, no downtime",
      "Rushing to see everything",
      "Dinner reservations every night",
      "Need a vacation from your vacation"
    ],
    yourTrip: [
      "Built-in nothing time",
      "Permission to stay put",
      "Meals that happen when they happen",
      "Actually coming home rested"
    ],
  },
  flexible_wanderer: {
    name: "Flexible Wanderer",
    oneLiner: "Plans are suggestions. The best stuff isn't on the itinerary.",
    typicalTrip: [
      "Every hour accounted for",
      "Reservations you can't change",
      "Anxiety about 'missing' things",
      "Stressed if you're off-schedule"
    ],
    yourTrip: [
      "Options, not obligations",
      "Room to follow your nose",
      "Discovery over direction",
      "Your best story wasn't planned"
    ],
  },
  culinary_cartographer: {
    name: "Culinary Cartographer",
    oneLiner: "Your passport is basically a menu. Food is why you travel.",
    typicalTrip: [
      "Whatever's convenient",
      "Hotel breakfast",
      "Trip Advisor top 10",
      "Rushed meals between sights"
    ],
    yourTrip: [
      "Meals are the main event",
      "Markets, not malls",
      "The places only locals know",
      "Time to actually taste things"
    ],
  },
  cultural_anthropologist: {
    name: "Cultural Anthropologist",
    oneLiner: "You don't just visit places. You try to understand them.",
    typicalTrip: [
      "Photo of the landmark",
      "Move on quickly",
      "Surface-level experience",
      "Same trip as everyone else"
    ],
    yourTrip: [
      "Why does this place feel this way?",
      "Time with locals, not just tourists",
      "The story behind the thing",
      "Understanding, not just seeing"
    ],
  },
  urban_nomad: {
    name: "Urban Nomad",
    oneLiner: "Cities are your natural habitat. Give you coffee and chaos.",
    typicalTrip: [
      "Guided bus tour",
      "Famous squares only",
      "Hotel by 10pm",
      "Miss the real neighborhood"
    ],
    yourTrip: [
      "Metro like a local",
      "The neighborhood that feels right",
      "Late-night options",
      "City that never sleeps, neither do you"
    ],
  },
  wilderness_pioneer: {
    name: "Wilderness Pioneer",
    oneLiner: "WiFi is optional. Wilderness is essential.",
    typicalTrip: [
      "Nature as a day trip",
      "Crowded tourist trails",
      "Quick photo, back to city",
      "Nature-lite experience"
    ],
    yourTrip: [
      "Distance from everything",
      "Silence and sky",
      "Trails less traveled",
      "Feeling small in the best way"
    ],
  },
  zen_seeker: {
    name: "Zen Seeker",
    oneLiner: "Travel is medicine. You come home better than you left.",
    typicalTrip: [
      "Stimulation overload",
      "No time to process",
      "Constant go-go-go",
      "Exhausted, not restored"
    ],
    yourTrip: [
      "Space to breathe",
      "Intentional stillness",
      "Experiences that restore",
      "Return home transformed"
    ],
  },
  social_butterfly: {
    name: "Social Butterfly",
    oneLiner: "Travel is better with people. Especially ones you haven't met yet.",
    typicalTrip: [
      "Solo hotel room",
      "Eat alone at tourist spots",
      "Transactional interactions only",
      "Come home with photos, not friends"
    ],
    yourTrip: [
      "Communal experiences",
      "Places where conversation happens",
      "Group dinners, shared tables",
      "Friends you'll stay in touch with"
    ],
  },
  family_architect: {
    name: "Family Architect",
    oneLiner: "Making memories that outlive photo albums.",
    typicalTrip: [
      "Activities for adults OR kids",
      "Someone always bored",
      "Logistics nightmare",
      "More stress than fun"
    ],
    yourTrip: [
      "Everyone has their moment",
      "Age-appropriate adventure for all",
      "Smooth transitions built in",
      "Memories the whole family shares"
    ],
  },
  luxury_luminary: {
    name: "Luxury Luminary",
    oneLiner: "Life's too short for ordinary. Every detail matters.",
    typicalTrip: [
      "Inconsistent quality",
      "Details left to chance",
      "Settle for 'good enough'",
      "Small disappointments add up"
    ],
    yourTrip: [
      "Curated to your standards",
      "The suite, not the room",
      "Service that anticipates",
      "Worth remembering"
    ],
  },
};

/**
 * Popular destinations for quick shortcut buttons
 */
export const POPULAR_DESTINATIONS = [
  'Tokyo',
  'New York',
  'Paris',
  'Miami',
  'Austin',
  'Bali',
];
