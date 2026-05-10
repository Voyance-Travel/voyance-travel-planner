// =============================================================================
// GROUP ARCHETYPE BLENDING - Compromise Algorithm for Mixed Travel Styles
// =============================================================================
// When multiple travelers have different archetypes, this module creates a
// blended itinerary that satisfies everyone through:
// 1. Finding overlapping experience affinities
// 2. Alternating day themes to give each archetype "their day"
// 3. Identifying conflict zones and proposing compromises
// 4. Suggesting split activities where the group can do their own thing
// =============================================================================

import { getFullArchetypeContext, type ArchetypeContext } from './archetype-data.ts';

// =============================================================================
// TYPES
// =============================================================================

export interface TravelerArchetype {
  travelerId: string;
  name?: string;
  archetype: string;
  isPrimary: boolean; // The trip owner/planner
  /**
   * Optional secondary archetype identity. When set and distinct from `archetype`,
   * the day assigner may allocate up to one "deepening" middle day per traveler
   * to bias activities toward this secondary's affinity. Null/undefined skips it.
   */
  secondaryArchetype?: string | null;
}

export interface BlendingResult {
  /** Unified archetype guidance for the group */
  blendedGuidance: BlendedGuidance;
  /** Days assigned to specific archetype preferences */
  dayAssignments: DayArchetypeAssignment[];
  /** Conflicts that may need explicit handling */
  conflicts: ArchetypeConflict[];
  /** Suggested split-activity opportunities */
  splitOpportunities: SplitOpportunity[];
  /** Pre-built prompt section for injection */
  promptSection: string;
}

export interface BlendedGuidance {
  /** Activities everyone should enjoy */
  universalHighAffinity: string[];
  /** Activities to avoid for any member */
  universalNever: string[];
  /** Compromise activities (medium for all) */
  compromiseActivities: string[];
  /** Pace recommendation (slowest member wins) */
  recommendedPace: 'relaxed' | 'moderate' | 'active';
  /** Max activities per day (lowest preference wins) */
  maxActivitiesPerDay: number;
  /** Social calibration (blend of group preferences) */
  socialLevel: 'high' | 'medium' | 'low';
}

export interface DayArchetypeAssignment {
  dayNumber: number;
  /** For deepening days, this is the secondary archetype id; for primary days, the traveler's primary; for group days, 'group'. */
  primaryArchetype: string;
  theme: string;
  rationale: string;
  /** Discriminator. Missing = legacy ('group' if primaryArchetype === 'group', else 'primary'). */
  kind?: 'group' | 'primary' | 'deepening';
  /** For 'primary' and 'deepening' days, the traveler whose archetype the day is favoring. */
  travelerId?: string;
}

export interface ArchetypeConflict {
  type: 'pace' | 'social' | 'activity_preference' | 'time_preference';
  travelers: string[]; // archetype names
  description: string;
  resolution: string;
}

export interface SplitOpportunity {
  dayNumber?: number; // undefined = any day
  timeSlot: 'morning' | 'afternoon' | 'evening';
  description: string;
  forArchetypes: string[];
}

// =============================================================================
// ARCHETYPE COMPATIBILITY MATRIX
// =============================================================================

// Higher score = more compatible, easier to blend
const COMPATIBILITY_MATRIX: Record<string, Record<string, number>> = {
  // Same category = usually compatible
  'flexible_wanderer': {
    'urban_nomad': 0.9,
    'digital_explorer': 0.8,
    'cultural_anthropologist': 0.7,
    'wilderness_pioneer': 0.6,
    'slow_traveler': 0.8,
    'adrenaline_architect': 0.3, // Conflict: structure vs. freedom
    'bucket_list_conqueror': 0.4,
    'luxury_luminary': 0.4,
  },
  'slow_traveler': {
    'flexible_wanderer': 0.9,
    'zen_seeker': 0.9,
    'beach_therapist': 0.8,
    'adrenaline_architect': 0.2, // Major conflict
    'bucket_list_conqueror': 0.3,
    'social_butterfly': 0.5,
  },
  'adrenaline_architect': {
    'wilderness_pioneer': 0.9,
    'bucket_list_conqueror': 0.8,
    'slow_traveler': 0.2, // Major conflict
    'zen_seeker': 0.3,
    'family_architect': 0.4, // Kids need different activities
  },
  'social_butterfly': {
    'community_builder': 0.9,
    'culinary_cartographer': 0.8,
    'romantic_curator': 0.6,
    'wilderness_pioneer': 0.4,
    'slow_traveler': 0.5,
  },
  'family_architect': {
    'romantic_curator': 0.3, // Major conflict: kids vs. romance
    'adrenaline_architect': 0.4,
    'slow_traveler': 0.7,
    'cultural_anthropologist': 0.6,
  },
  'romantic_curator': {
    'luxury_luminary': 0.9,
    'culinary_cartographer': 0.8,
    'zen_seeker': 0.7,
    'family_architect': 0.3, // Kids disrupt romance
    'social_butterfly': 0.4, // Too many strangers
  },
};

function getCompatibilityScore(arch1: string, arch2: string): number {
  const normalized1 = arch1.toLowerCase().replace(/\s+/g, '_');
  const normalized2 = arch2.toLowerCase().replace(/\s+/g, '_');
  
  if (normalized1 === normalized2) return 1.0;
  
  const score = COMPATIBILITY_MATRIX[normalized1]?.[normalized2] 
    ?? COMPATIBILITY_MATRIX[normalized2]?.[normalized1]
    ?? 0.6; // Default moderate compatibility
  
  return score;
}

// =============================================================================
// MAIN BLENDING FUNCTION
// =============================================================================

export async function blendGroupArchetypes(
  travelers: TravelerArchetype[],
  totalDays: number,
  destination?: string
): Promise<BlendingResult> {
  console.log(`[GroupBlend] Blending ${travelers.length} travelers' archetypes`);
  
  // Solo trip + no usable secondary → no blending needed (legacy fast path).
  // Solo trip WITH a distinct secondary still falls through so a deepening day
  // can be allocated.
  const soloHasSecondary =
    travelers.length === 1 &&
    !!travelers[0]?.secondaryArchetype &&
    travelers[0].secondaryArchetype !== travelers[0].archetype;

  if (travelers.length <= 1 && !soloHasSecondary) {
    const archetype = travelers[0]?.archetype || 'flexible_wanderer';
    return {
      blendedGuidance: {
        universalHighAffinity: [],
        universalNever: [],
        compromiseActivities: [],
        recommendedPace: 'moderate',
        maxActivitiesPerDay: 5,
        socialLevel: 'medium',
      },
      dayAssignments: [],
      conflicts: [],
      splitOpportunities: [],
      promptSection: `## Traveler Profile\nSingle traveler with ${archetype} archetype.`,
    };
  }
  
  // Load all archetype contexts
  const contexts: Map<string, ArchetypeContext> = new Map();
  for (const t of travelers) {
    const ctx = getFullArchetypeContext(t.archetype, destination);
    contexts.set(t.archetype, ctx);
  }
  
  // Find universal preferences
  const blendedGuidance = computeBlendedGuidance(travelers, contexts);
  
  // Assign days to archetypes for variety
  const dayAssignments = assignDaysToArchetypes(travelers, totalDays);
  
  // Identify conflicts
  const conflicts = identifyConflicts(travelers, contexts);
  
  // Suggest split opportunities
  const splitOpportunities = suggestSplitActivities(travelers, contexts, totalDays);
  
  // Build prompt section
  const promptSection = buildGroupBlendingPrompt(
    blendedGuidance,
    dayAssignments,
    conflicts,
    splitOpportunities,
    travelers
  );
  
  return {
    blendedGuidance,
    dayAssignments,
    conflicts,
    splitOpportunities,
    promptSection,
  };
}

// =============================================================================
// BLENDING LOGIC
// =============================================================================

function computeBlendedGuidance(
  travelers: TravelerArchetype[],
  contexts: Map<string, ArchetypeContext>
): BlendedGuidance {
  const allHighAffinity: Set<string>[] = [];
  const allNever: Set<string>[] = [];
  const allPaces: number[] = [];
  const allMaxActivities: number[] = [];
  
  for (const t of travelers) {
    const ctx = contexts.get(t.archetype);
    if (!ctx) continue;
    
    // Collect high affinity categories (use 'high' property from ExperienceAffinity)
    const high = new Set<string>(ctx.affinity.high || []);
    allHighAffinity.push(high);
    
    // Collect never categories (use 'never' property from ExperienceAffinity)
    const never = new Set<string>(ctx.affinity.never || []);
    allNever.push(never);
    
    // Pace from intensity (walkingHours is a string like "3-4")
    // Parse walkingHours string (e.g., "3-4") to get average
    const walkingHoursStr = ctx.intensity?.walkingHours || '4';
    const walkingHoursParts = walkingHoursStr.split('-').map(s => parseFloat(s.trim()));
    const pace = walkingHoursParts.length > 1 
      ? (walkingHoursParts[0] + walkingHoursParts[1]) / 2 
      : walkingHoursParts[0] || 4;
    allPaces.push(pace);
    
    // Max activities
    allMaxActivities.push(ctx.definition?.dayStructure?.maxScheduledActivities ?? 5);
  }
  
  // Universal high affinity = intersection of all high affinities
  const universalHighAffinity = allHighAffinity.length > 0
    ? [...allHighAffinity[0]].filter(cat => allHighAffinity.every(set => set.has(cat)))
    : [];
  
  // Universal never = union of all never lists (if ANY traveler hates it, avoid)
  const universalNever = [...new Set(allNever.flatMap(set => [...set]))];
  
  // Pace = slowest member wins (minimum walking hours)
  const minPace = Math.min(...allPaces, 4);
  const recommendedPace: 'relaxed' | 'moderate' | 'active' = 
    minPace <= 2 ? 'relaxed' : minPace <= 4 ? 'moderate' : 'active';
  
  // Max activities = lowest preference wins
  const maxActivitiesPerDay = Math.min(...allMaxActivities, 5);
  
  // Social level = weighted by primary traveler but consider all
  const socialLevel: 'high' | 'medium' | 'low' = 'medium'; // Could be enhanced
  
  // Compromise activities = medium affinity for most travelers
  const compromiseActivities: string[] = [
    'scenic_viewpoints',
    'local_markets',
    'coffee_culture',
    'iconic_landmarks',
  ];
  
  return {
    universalHighAffinity,
    universalNever,
    compromiseActivities,
    recommendedPace,
    maxActivitiesPerDay,
    socialLevel,
  };
}

function assignDaysToArchetypes(
  travelers: TravelerArchetype[],
  totalDays: number
): DayArchetypeAssignment[] {
  // Single-traveler trips with no secondary: nothing to assign (status quo).
  // Single-traveler with a secondary: still allow a deepening day.
  const travelersWithSecondary = travelers.filter(
    t => t.secondaryArchetype && t.secondaryArchetype !== t.archetype
  );
  if (travelers.length <= 1 && travelersWithSecondary.length === 0) return [];

  if (totalDays <= 0) return [];

  // Allocate slot array: 0=group day, 1..N-2 candidate middle days, N-1=group.
  const assignments: (DayArchetypeAssignment | null)[] = new Array(totalDays).fill(null);

  // Day 1 — always group (arrival)
  assignments[0] = {
    dayNumber: 1,
    primaryArchetype: 'group',
    theme: 'Arrival & Orientation',
    rationale: 'First day focuses on group settling in together',
    kind: 'group',
  };

  // Last day — always group (departure). Skip when totalDays === 1.
  if (totalDays >= 2) {
    assignments[totalDays - 1] = {
      dayNumber: totalDays,
      primaryArchetype: 'group',
      theme: 'Departure & Last Experiences',
      rationale: 'Last day keeps everyone together',
      kind: 'group',
    };
  }

  // Middle slots: indices 1 .. totalDays-2 (1-based day = index+1)
  const middleIndices: number[] = [];
  for (let i = 1; i <= totalDays - 2; i++) middleIndices.push(i);

  // Need at least 1 middle day for any non-group assignment.
  if (middleIndices.length === 0) {
    return assignments.filter((a): a is DayArchetypeAssignment => a !== null);
  }

  // STEP A — Primaries first (round-robin). Multi-traveler trips only.
  // Single-traveler trips skip primary assignment (status quo: middle days were
  // implicit primary). The deepening day still gets allocated below.
  let primaryDays = 0;
  if (travelers.length > 1) {
    const primaryQueue = [...travelers];
    let cursor = 0;
    for (const idx of middleIndices) {
      const t = primaryQueue[cursor % primaryQueue.length];
      assignments[idx] = {
        dayNumber: idx + 1,
        primaryArchetype: t.archetype,
        theme: getArchetypeDayTheme(t.archetype),
        rationale: `This day prioritizes ${formatArchetypeName(t.archetype)}'s preferences`,
        kind: 'primary',
        travelerId: t.travelerId,
      };
      cursor++;
      primaryDays++;
    }
  }

  // STEP B — Deepening days replace existing primary slots when slack exists.
  // Slack = middle days minus the number needed to give each traveler at least
  // one primary day. For a 2-traveler 5-day trip, middle=3, slack=1 → exactly
  // one deepening day. For 3-traveler 5-day trip, middle=3, slack=0 → none.
  // For single-traveler trips, all middle days are slack.
  const minPrimariesNeeded = travelers.length > 1 ? Math.min(travelers.length, middleIndices.length) : 0;
  const slack = middleIndices.length - minPrimariesNeeded;

  if (slack > 0 && travelersWithSecondary.length > 0) {
    // Prefer middle of the trip first (splice from middle of remaining slot list).
    const remainingSlots = [...middleIndices];
    const seenSecondary = new Set<string>(); // dedup same-secondary-across-travelers
    let deepeningPlaced = 0;

    for (const t of travelersWithSecondary) {
      if (deepeningPlaced >= slack) break;
      if (remainingSlots.length === 0) break;

      const sec = t.secondaryArchetype!;
      if (seenSecondary.has(sec)) {
        console.log(`[GroupBlend] Skipped duplicate secondary ${sec} for traveler ${t.travelerId}`);
        continue;
      }

      // Pick the middle of the remaining slots list.
      const slotIdx = remainingSlots.splice(Math.floor(remainingSlots.length / 2), 1)[0];

      assignments[slotIdx] = {
        dayNumber: slotIdx + 1,
        primaryArchetype: sec,
        theme: getArchetypeDayTheme(sec),
        rationale:
          `Deepening day leaning toward ${t.name || 'this traveler'}'s secondary identity ` +
          `(${formatArchetypeName(sec)}) — keep within the group's avoid list, but bias ` +
          `activity selection toward this archetype's affinity.`,
        kind: 'deepening',
        travelerId: t.travelerId,
      };
      seenSecondary.add(sec);
      deepeningPlaced++;
    }
  }

  // STEP C — single-traveler trips: any middle slots NOT replaced by deepening
  // stay null. The legacy contract returned `[]` for single-traveler trips, so
  // emit `kind: 'primary'` only for the deepening case (already handled above).
  // Drop nulls before returning.
  const final = assignments.filter((a): a is DayArchetypeAssignment => a !== null);

  const counts = final.reduce(
    (acc, a) => {
      const k = a.kind ?? (a.primaryArchetype === 'group' ? 'group' : 'primary');
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log(
    `[GroupBlend] Day assignments: P=${counts.primary ?? 0} primary, ` +
    `D=${counts.deepening ?? 0} deepening, G=${counts.group ?? 0} group`
  );

  return final;
}

function identifyConflicts(
  travelers: TravelerArchetype[],
  contexts: Map<string, ArchetypeContext>
): ArchetypeConflict[] {
  const conflicts: ArchetypeConflict[] = [];
  
  // Check pairwise compatibility
  for (let i = 0; i < travelers.length; i++) {
    for (let j = i + 1; j < travelers.length; j++) {
      const t1 = travelers[i];
      const t2 = travelers[j];
      const score = getCompatibilityScore(t1.archetype, t2.archetype);
      
      if (score < 0.4) {
        conflicts.push({
          type: 'activity_preference',
          travelers: [t1.archetype, t2.archetype],
          description: `${formatArchetypeName(t1.archetype)} and ${formatArchetypeName(t2.archetype)} have significantly different travel styles`,
          resolution: `Schedule separate activities on some days, or find middle-ground experiences`,
        });
      }
      
      // Check pace conflict
      const ctx1 = contexts.get(t1.archetype);
      const ctx2 = contexts.get(t2.archetype);
      if (ctx1 && ctx2) {
        // Parse walkingHours strings to numbers
        const parseWalkingHours = (str: string | undefined): number => {
          if (!str) return 4;
          const parts = str.split('-').map(s => parseFloat(s.trim()));
          return parts.length > 1 ? (parts[0] + parts[1]) / 2 : parts[0] || 4;
        };
        const pace1 = parseWalkingHours(ctx1.intensity?.walkingHours);
        const pace2 = parseWalkingHours(ctx2.intensity?.walkingHours);
        if (Math.abs(pace1 - pace2) > 3) {
          conflicts.push({
            type: 'pace',
            travelers: [t1.archetype, t2.archetype],
            description: `Pace mismatch: ${formatArchetypeName(t1.archetype)} prefers ${pace1}h/day walking, ${formatArchetypeName(t2.archetype)} prefers ${pace2}h/day`,
            resolution: `Default to slower pace with optional extension activities for the more active traveler`,
          });
        }
      }
    }
  }
  
  return conflicts;
}

function suggestSplitActivities(
  travelers: TravelerArchetype[],
  contexts: Map<string, ArchetypeContext>,
  totalDays: number
): SplitOpportunity[] {
  const opportunities: SplitOpportunity[] = [];
  
  // If 3+ day trip with conflicting archetypes, suggest afternoon splits
  if (totalDays >= 3 && travelers.length >= 2) {
    const archetypeNames = travelers.map(t => t.archetype);
    
    opportunities.push({
      timeSlot: 'afternoon',
      description: 'Consider splitting up for a few hours - one group explores museums while another does outdoor activities',
      forArchetypes: archetypeNames,
    });
  }
  
  // Specific splits based on archetype combinations
  const hasAdventure = travelers.some(t => 
    t.archetype.includes('adventure') || t.archetype.includes('wilderness') || t.archetype.includes('adrenaline')
  );
  const hasRelaxation = travelers.some(t => 
    t.archetype.includes('slow') || t.archetype.includes('zen') || t.archetype.includes('beach')
  );
  
  if (hasAdventure && hasRelaxation) {
    opportunities.push({
      timeSlot: 'morning',
      description: 'Active travelers can do early morning hiking/activities while relaxed travelers enjoy a leisurely breakfast and spa time',
      forArchetypes: travelers.filter(t => 
        t.archetype.includes('adventure') || t.archetype.includes('slow')
      ).map(t => t.archetype),
    });
  }
  
  return opportunities;
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildGroupBlendingPrompt(
  blendedGuidance: BlendedGuidance,
  dayAssignments: DayArchetypeAssignment[],
  conflicts: ArchetypeConflict[],
  splitOpportunities: SplitOpportunity[],
  travelers: TravelerArchetype[]
): string {
  let prompt = `## GROUP TRAVEL DYNAMICS
This trip includes ${travelers.length} travelers with different travel styles:
${travelers.map((t: TravelerArchetype) => `- ${formatArchetypeName(t.archetype)}${t.isPrimary ? ' (primary planner)' : ''}`).join('\n')}

### BLENDED PREFERENCES
- **Universal favorites**: ${blendedGuidance.universalHighAffinity.join(', ') || 'None identified - use compromise activities'}
- **Never include**: ${blendedGuidance.universalNever.join(', ') || 'None'}
- **Compromise activities**: ${blendedGuidance.compromiseActivities.join(', ')}
- **Recommended pace**: ${blendedGuidance.recommendedPace} (${blendedGuidance.maxActivitiesPerDay} activities max per day)
- **Social calibration**: ${blendedGuidance.socialLevel}

### DAY ASSIGNMENTS
${dayAssignments.length > 0 
  ? dayAssignments.map(d => `- Day ${d.dayNumber}: ${d.theme} (${d.primaryArchetype === 'group' ? 'Group day' : `Favoring ${formatArchetypeName(d.primaryArchetype)}`})`).join('\n')
  : 'No specific day assignments - balance throughout'}
`;

  if (conflicts.length > 0) {
    prompt += `
### CONFLICTS TO MANAGE
${conflicts.map(c => `- **${c.type}**: ${c.description}
  Resolution: ${c.resolution}`).join('\n')}
`;
  }

  if (splitOpportunities.length > 0) {
    prompt += `
### SPLIT ACTIVITY OPPORTUNITIES
${splitOpportunities.map(s => `- **${s.timeSlot}**: ${s.description}`).join('\n')}
`;
  }

  prompt += `
### CRITICAL RULES FOR GROUP TRIPS
1. Every activity must work for the slowest/least adventurous member unless it's a split activity
2. Include at least one "group bonding" activity per day (shared meals count)
3. If suggesting split activities, always provide a reunification point
4. The primary planner's preferences get 60% weight, others 40%
5. Never schedule activities that any group member has in their "never" list
6. **IMPORTANT**: For each activity, include a "suggestedFor" field with the traveler ID whose preferences most influenced that choice. Use the traveler IDs below:
${travelers.map((t: TravelerArchetype) => `   - "${t.travelerId}" (${formatArchetypeName(t.archetype)}${t.isPrimary ? ', primary' : ''})`).join('\n')}
   If an activity is a group consensus pick, use the primary planner's ID.
`;

  return prompt;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatArchetypeName(archetype: string): string {
  return archetype
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getArchetypeDayTheme(archetype: string): string {
  const themes: Record<string, string> = {
    'flexible_wanderer': 'Spontaneous Exploration',
    'slow_traveler': 'Mindful Discovery',
    'adrenaline_architect': 'Adventure Day',
    'cultural_anthropologist': 'Deep Culture Immersion',
    'culinary_cartographer': 'Food & Flavor',
    'social_butterfly': 'Local Connections',
    'zen_seeker': 'Wellness & Reflection',
    'luxury_luminary': 'Refined Experiences',
    'romantic_curator': 'Intimate Moments',
    'family_architect': 'Family Fun',
    'wilderness_pioneer': 'Nature Immersion',
    'beach_therapist': 'Coastal Relaxation',
  };
  
  const normalized = archetype.toLowerCase().replace(/\s+/g, '_');
  return themes[normalized] || 'Mixed Exploration';
}

export { formatArchetypeName, getCompatibilityScore };

// =============================================================================
// TRAIT SCORE BLENDING - Shared algorithm for owner + companions
// =============================================================================

const BLEND_TRAIT_KEYS = ['pace', 'budget', 'social', 'planning', 'comfort', 'authenticity', 'adventure', 'cultural', 'transformation'];

/**
 * Blend trait scores: owner gets 50% weight, companions split the remaining 50%.
 * Returns blended trait scores as a Record<string, number>.
 */
export function blendTraitScores(
  ownerTraits: Record<string, number>,
  companionTraitsList: Record<string, number>[]
): Record<string, number> {
  if (companionTraitsList.length === 0) {
    // No companions — return owner traits as-is
    const result: Record<string, number> = {};
    for (const key of BLEND_TRAIT_KEYS) {
      result[key] = ownerTraits[key] ?? 0;
    }
    return result;
  }

  const ownerWeight = 0.5;
  const companionWeight = 0.5 / companionTraitsList.length;

  const blended: Record<string, number> = {};
  for (const key of BLEND_TRAIT_KEYS) {
    const ownerVal = ownerTraits[key] ?? 0;
    const companionSum = companionTraitsList.reduce((sum, ct) => sum + (ct[key] ?? 0) * companionWeight, 0);
    blended[key] = Math.round(ownerVal * ownerWeight + companionSum);
  }
  return blended;
}
