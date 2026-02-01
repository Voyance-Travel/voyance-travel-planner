// =============================================================================
// ARCHETYPE DATA - Single Source of Truth for All Archetype Information
// =============================================================================
// This module MERGES:
// - archetype-constraints.ts (definitions, avoid lists, day structure)
// - experience-affinity.ts (high/medium/low/never experience categories)
// - destination-guides.ts (city × archetype recommendations)
//
// ONE function: getFullArchetypeContext(archetype, destination?)
// Returns: EVERYTHING needed for prompt building in one object
// =============================================================================

// Re-export types from original modules for backward compatibility
export type { ArchetypeDefinition } from './archetype-constraints.ts';
export type { ExperienceAffinity, TimePreferences, EnvironmentPreferences, PhysicalIntensity } from './experience-affinity.ts';
export type { DestinationArchetypeGuide } from './destination-guides.ts';
export type { 
  MatchedAttraction, 
  AttractionQuery, 
  ArchetypeDestinationGuide as DynamicArchetypeGuide 
} from './attraction-matching.ts';

// Import from original modules (these still exist during migration)
import { 
  getArchetypeDefinition,
  buildAllConstraints,
  buildArchetypeConstraintsBlock,
  buildBudgetConstraints,
  buildTripWideVarietyRules,
  buildUnscheduledTimeRules,
  buildPacingRules,
  buildNamingRules,
  type ArchetypeDefinition 
} from './archetype-constraints.ts';

import {
  getExperienceAffinity,
  getTimePreferences,
  getEnvironmentPreferences,
  getPhysicalIntensity,
  buildExperienceGuidancePrompt,
  EXPERIENCE_CATEGORIES,
  type ExperienceAffinity,
  type TimePreferences,
  type EnvironmentPreferences,
  type PhysicalIntensity
} from './experience-affinity.ts';

import {
  getArchetypeDestinationGuide,
  hasDestinationGuide,
  buildDestinationGuidancePrompt,
  type DestinationArchetypeGuide
} from './destination-guides.ts';

// Import dynamic attraction matching
import {
  getMatchingAttractions,
  getOrGenerateArchetypeGuide,
  buildMatchedAttractionsPrompt,
  buildArchetypeGuidePrompt,
  getAttractionsNeedingEnrichment,
  updateAttractionTags,
  getValidExperienceCategories,
} from './attraction-matching.ts';

// Re-export attraction matching functions
export {
  getMatchingAttractions,
  getOrGenerateArchetypeGuide,
  buildMatchedAttractionsPrompt,
  buildArchetypeGuidePrompt,
  getAttractionsNeedingEnrichment,
  updateAttractionTags,
  getValidExperienceCategories,
  EXPERIENCE_CATEGORIES,
};

// =============================================================================
// UNIFIED ARCHETYPE CONTEXT
// =============================================================================

export interface ArchetypeContext {
  /** Archetype name (e.g., "flexible_wanderer") */
  archetype: string;
  
  /** Full definition with identity, meaning, avoid list, day structure */
  definition: ArchetypeDefinition;
  
  /** Experience affinity (high/medium/low/never categories) */
  affinity: ExperienceAffinity;
  
  /** Time preferences (start/end, peak energy) */
  timePrefs: TimePreferences;
  
  /** Environment preferences (indoor/outdoor, urban/nature, crowds) */
  envPrefs: EnvironmentPreferences;
  
  /** Physical intensity expectations */
  intensity: PhysicalIntensity;
  
  /** Destination-specific guide (if available) */
  destinationGuide: DestinationArchetypeGuide | null;
  
  /** Pre-built prompt blocks for direct injection */
  promptBlocks: {
    /** Identity and meaning block */
    identity: string;
    /** Full constraints block (archetype + budget + pacing + variety) */
    constraints: string;
    /** Experience affinity guidance */
    affinity: string;
    /** Destination-specific recommendations */
    destination: string;
  };
}

// =============================================================================
// MAIN FUNCTION: Get Full Archetype Context
// =============================================================================

/**
 * Returns EVERYTHING about an archetype needed for prompt building.
 * 
 * This is the SINGLE function that replaces multiple imports from
 * archetype-constraints.ts, experience-affinity.ts, and destination-guides.ts.
 * 
 * @param archetype - The archetype name (e.g., "flexible_wanderer")
 * @param destination - Optional destination for city-specific recommendations
 * @param budgetTier - Optional budget tier for constraints
 * @param traitScores - Optional trait scores for fine-tuning
 */
export function getFullArchetypeContext(
  archetype: string,
  destination?: string,
  budgetTier?: string,
  traitScores?: { pace: number; budget: number }
): ArchetypeContext {
  // Default trait scores if not provided
  const traits = traitScores || { pace: 0, budget: 0 };
  
  // Get all component data
  const definition = getArchetypeDefinition(archetype);
  const affinity = getExperienceAffinity(archetype);
  const timePrefs = getTimePreferences(archetype);
  const envPrefs = getEnvironmentPreferences(archetype);
  const intensity = getPhysicalIntensity(archetype);
  
  // Get destination-specific guide if available
  const destinationGuide = destination && hasDestinationGuide(destination)
    ? getArchetypeDestinationGuide(destination, archetype)
    : null;
  
  // Build pre-compiled prompt blocks
  const identityBlock = buildIdentityBlock(archetype, definition);
  const constraintsBlock = budgetTier 
    ? buildAllConstraints(archetype, budgetTier, traits)
    : buildArchetypeConstraintsBlock(archetype);
  const affinityBlock = buildExperienceGuidancePrompt(archetype);
  const destinationBlock = destination 
    ? buildDestinationGuidancePrompt(destination, archetype)
    : '';
  
  return {
    archetype,
    definition,
    affinity,
    timePrefs,
    envPrefs,
    intensity,
    destinationGuide,
    promptBlocks: {
      identity: identityBlock,
      constraints: constraintsBlock,
      affinity: affinityBlock,
      destination: destinationBlock,
    },
  };
}

// =============================================================================
// PROMPT BLOCK BUILDERS
// =============================================================================

/**
 * Builds a focused identity block for the system prompt
 */
function buildIdentityBlock(archetype: string, definition: ArchetypeDefinition): string {
  return `
${'='.repeat(70)}
🎭 TRAVELER IDENTITY: ${definition.identity}
${'='.repeat(70)}
Category: ${definition.category}

${definition.meaning}

ABSOLUTE AVOID LIST (violations = regeneration):
${definition.avoid.map(a => `• ${a}`).join('\n')}

DAY STRUCTURE:
• Max scheduled activities: ${definition.dayStructure.maxScheduledActivities}
${definition.dayStructure.minScheduledActivities ? `• Min scheduled activities: ${definition.dayStructure.minScheduledActivities}` : ''}
• Start time: ${definition.dayStructure.startTime}
${definition.dayStructure.endTime ? `• End time: ${definition.dayStructure.endTime}` : ''}
• Spa OK: ${definition.dayStructure.spaOK ? 'YES' : 'NO'}
• Michelin OK: ${definition.dayStructure.michelinOK ? 'YES' : 'NO'}
${definition.dayStructure.requiredUnscheduledBlocks ? `• Required unscheduled blocks: ${definition.dayStructure.requiredUnscheduledBlocks}` : ''}
${definition.dayStructure.unscheduledBlockMinHours ? `• Min unscheduled block hours: ${definition.dayStructure.unscheduledBlockMinHours}` : ''}
${definition.dayStructure.vipExpected ? '• VIP experiences expected' : ''}
${definition.dayStructure.nightlifeExpected ? '• Nightlife expected' : ''}
${definition.dayStructure.walkingExpected ? '• Walking expected' : ''}
${definition.dayStructure.sunsetRequired ? '• Sunset moment required' : ''}
`;
}

// =============================================================================
// QUICK ACCESSORS (for backward compatibility)
// =============================================================================

/**
 * Quick check if an experience category is allowed for this archetype
 */
export function isExperienceAllowed(archetype: string, category: string): boolean {
  const affinity = getExperienceAffinity(archetype);
  return !affinity.never.some(n => 
    n.toLowerCase().includes(category.toLowerCase()) || 
    category.toLowerCase().includes(n.toLowerCase())
  );
}

/**
 * Quick check if spa is OK for this archetype
 */
export function isSpaOK(archetype: string): boolean {
  const definition = getArchetypeDefinition(archetype);
  return definition.dayStructure.spaOK === true;
}

/**
 * Quick check if Michelin dining is OK for this archetype
 */
export function isMichelinOK(archetype: string): boolean {
  const definition = getArchetypeDefinition(archetype);
  return definition.dayStructure.michelinOK === true;
}

/**
 * Get max activities for an archetype
 */
export function getMaxActivities(archetype: string): number {
  const definition = getArchetypeDefinition(archetype);
  return definition.dayStructure.maxScheduledActivities;
}

/**
 * Check if archetype needs unscheduled time blocks
 */
export function needsUnscheduledTime(archetype: string): boolean {
  const definition = getArchetypeDefinition(archetype);
  return (definition.dayStructure.requiredUnscheduledBlocks || 0) > 0;
}

// =============================================================================
// COMBINED PROMPT BUILDER
// =============================================================================

/**
 * Builds the complete constraint and guidance section for the system prompt.
 * This replaces manually assembling multiple blocks in the main handler.
 */
export function buildFullPromptGuidance(
  archetype: string,
  destination: string,
  budgetTier: string,
  traitScores: { pace: number; budget: number }
): string {
  const context = getFullArchetypeContext(archetype, destination, budgetTier, traitScores);
  
  const sections = [
    // Generation hierarchy
    `
${'='.repeat(70)}
⚖️ GENERATION HIERARCHY — CONFLICT RESOLUTION RULES
${'='.repeat(70)}

When rules conflict, follow this priority order (1 = highest):

1. DESTINATION ESSENTIALS (highest priority)
   → First-time visitors MUST see iconic landmarks
   → These are non-negotiable unless user explicitly says "skip"

2. ARCHETYPE IDENTITY (critical - defines WHO the traveler is)
   → The archetype's meaning, avoid list, and day structure are LAW
   → If an activity violates the archetype's avoid list, DO NOT INCLUDE IT

3. EXPERIENCE AFFINITY (what TO prioritize - the "pull" side)
   → Each archetype has HIGH/MEDIUM/LOW/NEVER experience categories
   → PRIORITIZE experiences from HIGH categories
   → AVOID experiences from NEVER categories (hard block)

4. DESTINATION-SPECIFIC GUIDE (city × archetype recommendations)
   → When available, use mustDo/perfectFor/hiddenGems specific to this destination

5. BUDGET CONSTRAINTS
   → Budget tier + budget trait score determine price limits

6. PACING CONSTRAINTS
   → Pace trait determines activity density and timing

7. VARIETY RULES
   → Prevent repetition across days

8. NAMING RULES
   → No archetype names in activity titles
`,
    // All the blocks
    context.promptBlocks.identity,
    context.promptBlocks.constraints,
    context.promptBlocks.affinity,
    context.promptBlocks.destination,
  ];
  
  return sections.filter(Boolean).join('\n\n');
}

/**
 * Async version of buildFullPromptGuidance that includes dynamic attraction matching
 * and AI-generated destination guides (with caching).
 * 
 * Use this when you need the full power of the dynamic system.
 * Falls back to static guidance if dynamic features fail.
 */
export async function buildFullPromptGuidanceAsync(
  supabase: any,
  archetype: string,
  destination: string,
  destinationId: string | null,
  budgetTier: string,
  traitScores: { pace: number; budget: number },
  aiGatewayKey?: string
): Promise<string> {
  // Get static guidance first
  const staticGuidance = buildFullPromptGuidance(archetype, destination, budgetTier, traitScores);
  
  const dynamicSections: string[] = [];
  
  // Try to get matched attractions if we have a destination ID
  if (destinationId) {
    try {
      // Map budget tier to physical intensity based on typical patterns
      const intensityMap: Record<string, 'low' | 'moderate' | 'high'> = {
        luxury: 'low',      // Luxury travelers typically want less walking
        moderate: 'moderate',
        budget: 'high',     // Budget travelers often walk more
      };
      
      const attractions = await getMatchingAttractions(supabase, {
        destinationId,
        archetype,
        budgetTier: budgetTier as 'budget' | 'moderate' | 'luxury',
        physicalIntensity: intensityMap[budgetTier] || 'moderate',
        limit: 30,
      });
      
      if (attractions.length > 0) {
        const attractionsPrompt = buildMatchedAttractionsPrompt(attractions, archetype);
        if (attractionsPrompt) {
          dynamicSections.push(attractionsPrompt);
          console.log(`[buildFullPromptGuidanceAsync] Added ${attractions.length} matched attractions`);
        }
      }
    } catch (e) {
      console.warn('[buildFullPromptGuidanceAsync] Attraction matching failed, continuing with static:', e);
    }
    
    // Try to get or generate archetype × destination guide
    if (aiGatewayKey) {
      try {
        const guide = await getOrGenerateArchetypeGuide(
          supabase,
          archetype,
          destinationId,
          destination,
          aiGatewayKey
        );
        
        if (guide) {
          const guidePrompt = buildArchetypeGuidePrompt(guide, archetype, destination);
          if (guidePrompt) {
            dynamicSections.push(guidePrompt);
            console.log(`[buildFullPromptGuidanceAsync] Added dynamic archetype guide for ${archetype} × ${destination}`);
          }
        }
      } catch (e) {
        console.warn('[buildFullPromptGuidanceAsync] Dynamic guide generation failed, using static:', e);
      }
    }
  }
  
  // Combine static and dynamic sections
  if (dynamicSections.length > 0) {
    return staticGuidance + '\n\n' + dynamicSections.join('\n\n');
  }
  
  return staticGuidance;
}

// =============================================================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

// During migration, re-export functions that other modules might still use
export {
  getArchetypeDefinition,
  buildAllConstraints,
  buildArchetypeConstraintsBlock,
  buildBudgetConstraints,
  buildTripWideVarietyRules,
  buildUnscheduledTimeRules,
  buildPacingRules,
  buildNamingRules,
} from './archetype-constraints.ts';

export {
  getExperienceAffinity,
  getTimePreferences,
  getEnvironmentPreferences,
  getPhysicalIntensity,
  buildExperienceGuidancePrompt,
} from './experience-affinity.ts';

export {
  getArchetypeDestinationGuide,
  hasDestinationGuide,
  buildDestinationGuidancePrompt,
} from './destination-guides.ts';
