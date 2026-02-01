/**
 * Anti-Sycophancy Validation
 * Be the knowledgeable friend, not the yes-man
 */

export interface TripConfig {
  activitiesPerDay?: number;
  tripDuration?: number; // in days
  pace?: 'relaxed' | 'balanced' | 'active' | 'intense';
  hasEarlyMornings?: boolean;
  hasLateNights?: boolean;
  adventureActivities?: number;
  restDays?: number;
}

export interface ValidationWarning {
  message: string;
  suggestion?: string;
  severity: 'gentle' | 'moderate' | 'strong';
}

/**
 * Validate trip configuration against archetype personality
 * Returns null if no conflicts, or a warning if something seems off
 */
export function validateAgainstArchetype(
  archetype: string,
  tripConfig: TripConfig
): ValidationWarning | null {
  const normalized = archetype.toLowerCase().replace(/-/g, '_');

  const rules: Record<string, (config: TripConfig) => ValidationWarning | null> = {
    slow_traveler: (config) => {
      if (config.activitiesPerDay && config.activitiesPerDay > 4) {
        return {
          message: "That's... a lot for you. Want us to spread this over more days so you can actually enjoy it?",
          suggestion: "Consider reducing to 3-4 activities per day",
          severity: 'moderate',
        };
      }
      if (config.tripDuration && config.tripDuration < 3) {
        return {
          message: "A weekend trip might feel rushed for your style. Consider adding a day?",
          severity: 'gentle',
        };
      }
      if (config.pace === 'intense' || config.pace === 'active') {
        return {
          message: "This pace doesn't really match your style. You tend to prefer savoring moments over rushing through them.",
          suggestion: "Switch to a 'balanced' or 'relaxed' pace",
          severity: 'moderate',
        };
      }
      return null;
    },

    adrenaline_architect: (config) => {
      if (config.activitiesPerDay && config.activitiesPerDay < 3) {
        return {
          message: "That's pretty light for you. Want us to pack in more?",
          severity: 'gentle',
        };
      }
      if (config.adventureActivities !== undefined && config.adventureActivities === 0) {
        return {
          message: "No adventure activities? That doesn't sound like you. Want to add some thrills?",
          severity: 'moderate',
        };
      }
      if (config.pace === 'relaxed') {
        return {
          message: "A relaxed pace might leave you feeling restless. Sure about this?",
          severity: 'gentle',
        };
      }
      return null;
    },

    zen_seeker: (config) => {
      if (config.activitiesPerDay && config.activitiesPerDay > 3) {
        return {
          message: "That's a lot for someone seeking peace. Less might actually be more here.",
          severity: 'gentle',
        };
      }
      if (config.hasEarlyMornings && config.hasLateNights) {
        return {
          message: "Early mornings AND late nights? Your body needs rhythm to restore. Pick one.",
          severity: 'moderate',
        };
      }
      return null;
    },

    culinary_cartographer: (config) => {
      if (config.activitiesPerDay && config.activitiesPerDay > 5) {
        return {
          message: "With this many activities, when will you eat properly? Food is the experience for you.",
          suggestion: "Cut a few activities to leave room for proper meals",
          severity: 'moderate',
        };
      }
      return null;
    },

    wilderness_pioneer: (config) => {
      if (config.restDays !== undefined && config.restDays > config.tripDuration! / 2) {
        return {
          message: "Half the trip as rest days? You usually want to be out there exploring.",
          severity: 'gentle',
        };
      }
      return null;
    },

    luxury_luminary: (config) => {
      if (config.pace === 'intense') {
        return {
          message: "An intense pace can feel exhausting rather than luxurious. You tend to prefer quality over quantity.",
          severity: 'gentle',
        };
      }
      return null;
    },

    family_architect: (config) => {
      if (config.activitiesPerDay && config.activitiesPerDay > 4) {
        return {
          message: "With kids, more than 4 activities usually means meltdowns. Trust us on this one.",
          severity: 'moderate',
        };
      }
      if (config.hasLateNights) {
        return {
          message: "Late nights with kids? You're braver than we thought. Just make sure there's nap time built in.",
          severity: 'gentle',
        };
      }
      return null;
    },

    beach_therapist: (config) => {
      if (config.activitiesPerDay && config.activitiesPerDay > 3) {
        return {
          message: "That's a lot of scheduled activities for someone who heals by the ocean. Leave time for the beach.",
          severity: 'gentle',
        };
      }
      return null;
    },

    flexible_wanderer: (config) => {
      if (config.activitiesPerDay && config.activitiesPerDay > 5) {
        return {
          message: "This is really structured for you. Where's the room for happy accidents?",
          suggestion: "Leave some blank time for spontaneity",
          severity: 'moderate',
        };
      }
      return null;
    },
  };

  const validator = rules[normalized];
  if (!validator) return null;

  return validator(tripConfig);
}

/**
 * Get all applicable warnings for a trip configuration
 */
export function getAllValidationWarnings(
  archetype: string,
  tripConfig: TripConfig
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const warning = validateAgainstArchetype(archetype, tripConfig);
  if (warning) {
    warnings.push(warning);
  }
  return warnings;
}
