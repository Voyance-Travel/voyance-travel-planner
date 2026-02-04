/**
 * Archetype Voice System
 * Activity descriptions that feel like they were written by someone who knows you
 */

export interface ArchetypeVoiceStyle {
  /** Prefix phrases by activity category */
  descriptionPrefix: Record<string, string>;
  /** Pacing notes by time of day */
  paceNotes: Record<string, string>;
  /** General dining philosophy */
  diningNotes: string;
  /** General tone descriptor for AI prompts */
  toneDescriptor: string;
}

export const archetypeVoiceStyles: Record<string, ArchetypeVoiceStyle> = {
  slow_traveler: {
    descriptionPrefix: {
      cultural: "Take your time here. There's no rush.",
      dining: "This is a meal to linger over, not inhale.",
      sightseeing: "Wander, don't march. This isn't a checkbox.",
      shopping: "Browse at your own pace. The best finds come when you're not looking.",
      nature: "Let the landscape sink in. Sit somewhere quiet.",
      entertainment: "Enjoy the moment. You're not here to race through it.",
    },
    paceNotes: {
      morning: "Easy start. Coffee first, then the world.",
      afternoon: "The afternoon is yours. Nap, wander, or stay.",
      evening: "No rush to dinner. The night is long.",
    },
    diningNotes: "We've scheduled proper time. No 45-minute dinners.",
    toneDescriptor: "unhurried, present, savoring each moment",
  },

  adrenaline_architect: {
    descriptionPrefix: {
      cultural: "Quick stop. It's iconic, worth seeing, won't take long.",
      dining: "Fuel up. You'll need the energy.",
      sightseeing: "The real adventure starts after.",
      adventure: "This is what you came for. Full send.",
      nature: "Get out there. The view is earned.",
      entertainment: "Keep the energy up. Rest is for the plane home.",
    },
    paceNotes: {
      morning: "Early start. Best light, fewer crowds, more time.",
      afternoon: "Keep the momentum. You've got this.",
      evening: "Still going? Good. There's more to see.",
    },
    diningNotes: "Fuel up. You'll need the energy.",
    toneDescriptor: "energetic, action-oriented, seizing every moment",
  },

  culinary_cartographer: {
    descriptionPrefix: {
      cultural: "Beautiful, but honestly you're here for what's nearby to eat.",
      dining: "This is why you came.",
      sightseeing: "The neighborhood has excellent food options too.",
      shopping: "Check out the food stalls and local markets here.",
      nature: "Pack a picnic. The setting makes everything taste better.",
      entertainment: "Save room. There's good eating nearby.",
    },
    paceNotes: {
      morning: "Markets are best early. Get there before the crowds.",
      afternoon: "Save room. Dinner is the main event.",
      evening: "This is your moment. The best meals happen now.",
    },
    diningNotes: "We've found the real spots, not the tourist traps.",
    toneDescriptor: "food-obsessed, sensory-driven, taste-first",
  },

  cultural_anthropologist: {
    descriptionPrefix: {
      cultural: "This is where you'll understand what makes this place tick.",
      dining: "Eat what the locals eat. Food tells the story.",
      sightseeing: "Look past the surface. The real story is in the details.",
      shopping: "Local artisans, traditional crafts. This is the authentic stuff.",
      nature: "This landscape shaped the culture. See how.",
      entertainment: "Local performance, local story. This is the real thing.",
    },
    paceNotes: {
      morning: "Start where the locals start. Coffee, conversation.",
      afternoon: "This is when the neighborhood reveals itself.",
      evening: "The city transforms. Watch how people live here.",
    },
    diningNotes: "No tourist menus. We've found where the locals actually eat.",
    toneDescriptor: "curious, observant, seeking authentic understanding",
  },

  luxury_luminary: {
    descriptionPrefix: {
      cultural: "Private access, expert guide. This is the elevated experience.",
      dining: "Reservations secured. You're getting the best table.",
      sightseeing: "Skip the lines. We've arranged something special.",
      shopping: "The finest boutiques and ateliers await.",
      nature: "Exclusive access to the most stunning vantage points.",
      entertainment: "Premium seats, VIP treatment. As it should be.",
    },
    paceNotes: {
      morning: "Late start. You've earned it. Breakfast in bed.",
      afternoon: "Time for a spa treatment or pool time.",
      evening: "The evening is curated. Every detail considered.",
    },
    diningNotes: "Only the finest. We've secured the reservations worth having.",
    toneDescriptor: "refined, elevated, quality-first",
  },

  zen_seeker: {
    descriptionPrefix: {
      cultural: "A space for reflection. Let the stillness speak.",
      dining: "Mindful eating. Taste every bite.",
      sightseeing: "Find a quiet corner. Watch. Breathe.",
      wellness: "This is your sanctuary. Be fully present.",
      nature: "The natural world is your meditation.",
      entertainment: "Something gentle. Nothing jarring.",
    },
    paceNotes: {
      morning: "Sunrise yoga or meditation. Start centered.",
      afternoon: "Rest, read, or simply be. No agenda.",
      evening: "Gentle close to the day. Early to bed is fine.",
    },
    diningNotes: "Clean, nourishing food. Your body is your temple here.",
    toneDescriptor: "peaceful, mindful, restoration-focused",
  },

  wilderness_pioneer: {
    descriptionPrefix: {
      cultural: "Quick culture stop, then back to the wild.",
      dining: "Simple fuel. The trail is calling.",
      sightseeing: "The best views require effort. Let's go.",
      adventure: "This is your element. Get out there.",
      nature: "No crowds, no noise. Just you and the wild.",
      entertainment: "Stargazing, campfire, the sounds of nature.",
    },
    paceNotes: {
      morning: "Up before dawn. The best wildlife sightings are now.",
      afternoon: "Deep in nature. This is why you came.",
      evening: "Back at camp. Simple pleasures.",
    },
    diningNotes: "Whatever fuels the adventure. Simplicity is the point.",
    toneDescriptor: "rugged, self-sufficient, nature-immersed",
  },

  flexible_wanderer: {
    descriptionPrefix: {
      cultural: "Worth seeing, but follow your instincts if something else calls.",
      dining: "A suggestion, but if you spot something better, go for it.",
      sightseeing: "Start here, but wander where the day takes you.",
      adventure: "See how you feel. There's always tomorrow.",
      nature: "The path is a guideline. Explore.",
      entertainment: "Or not. You'll know what you're in the mood for.",
    },
    paceNotes: {
      morning: "Wake when you wake. The day unfolds on your terms.",
      afternoon: "Wide open. This is your time.",
      evening: "Follow the energy of the city. Or don't.",
    },
    diningNotes: "Some options, but honestly? See what you stumble into.",
    toneDescriptor: "spontaneous, open, following intuition",
  },

  family_architect: {
    descriptionPrefix: {
      cultural: "Interactive and engaging. Kids will love this too.",
      dining: "Family-friendly with something for everyone.",
      sightseeing: "Perfect for all ages. Bring the camera.",
      adventure: "Safe but exciting. Great for the whole crew.",
      nature: "Space to run around and explore together.",
      entertainment: "The whole family will remember this one.",
    },
    paceNotes: {
      morning: "Start after breakfast. No one's rushing.",
      afternoon: "Nap time or pool break built in.",
      evening: "Early dinner. Kids eat first, then relaxation for the adults.",
    },
    diningNotes: "Kid-friendly doesn't mean boring. Good food for everyone.",
    toneDescriptor: "inclusive, memory-making, multi-generational joy",
  },

  beach_therapist: {
    descriptionPrefix: {
      cultural: "A quick visit, then back to the beach.",
      dining: "Seafood with a view. Toes in the sand.",
      sightseeing: "Coastal views are the only views that matter.",
      wellness: "Ocean sounds, salt air, pure restoration.",
      nature: "Beach walks, tide pools, the rhythm of the waves.",
      entertainment: "Sunset cocktails. The ocean is the show.",
    },
    paceNotes: {
      morning: "Beach is best before it gets crowded.",
      afternoon: "Siesta, swim, repeat. This is the rhythm.",
      evening: "Sunset on the beach. There's nothing else.",
    },
    diningNotes: "Fresh catch, ocean views. The simpler the better.",
    toneDescriptor: "coastal, restorative, salt-and-sun healing",
  },

  // Default fallback voice
  default: {
    descriptionPrefix: {
      cultural: "A notable experience worth your time.",
      dining: "A great meal awaits.",
      sightseeing: "Don't miss this one.",
      adventure: "An exciting experience.",
      nature: "Beautiful natural scenery.",
      entertainment: "Fun and memorable.",
    },
    paceNotes: {
      morning: "Start your day here.",
      afternoon: "A perfect afternoon activity.",
      evening: "End the day on a high note.",
    },
    diningNotes: "We've found great options for you.",
    toneDescriptor: "balanced, thoughtful, personalized",
  },
};

/**
 * Get voice style for an archetype (with fallback)
 */
export function getArchetypeVoice(archetypeId: string): ArchetypeVoiceStyle {
  // Normalize the archetype ID (convert to snake_case if needed)
  const normalized = archetypeId.toLowerCase().replace(/-/g, '_');
  return archetypeVoiceStyles[normalized] || archetypeVoiceStyles.default;
}

/**
 * Get a description prefix for a specific activity category
 */
export function getActivityPrefix(archetypeId: string, category: string): string {
  const voice = getArchetypeVoice(archetypeId);
  const normalizedCategory = category.toLowerCase();
  return voice.descriptionPrefix[normalizedCategory] || voice.descriptionPrefix.sightseeing || '';
}

/**
 * Get pacing note for time of day
 */
export function getPaceNote(archetypeId: string, timeOfDay: 'morning' | 'afternoon' | 'evening'): string {
  const voice = getArchetypeVoice(archetypeId);
  return voice.paceNotes[timeOfDay] || '';
}

/**
 * Build voice injection prompt section for AI generation
 */
export function buildVoicePromptSection(archetypeId: string): string {
  const voice = getArchetypeVoice(archetypeId);
  
  return `
## ARCHETYPE VOICE (CRITICAL)
This traveler is a "${archetypeId.replace(/_/g, ' ')}" personality. Their tone is: ${voice.toneDescriptor}.

When writing activity descriptions and notes:
- Morning activities: "${voice.paceNotes.morning}"
- Afternoon activities: "${voice.paceNotes.afternoon}"
- Evening activities: "${voice.paceNotes.evening}"

For dining: ${voice.diningNotes}

Category-specific voice:
${Object.entries(voice.descriptionPrefix).map(([cat, prefix]) => `- ${cat}: "${prefix}"`).join('\n')}

IMPORTANT: The activity descriptions should FEEL like they were written by someone who understands this traveler's style. Match their energy and priorities.
`;
}
