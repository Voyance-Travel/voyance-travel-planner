// src/lib/schema-compiler/schema-to-prompt.ts
// Converts a compiled DaySchema into AI prompts.
// Part of the isolated schema generation system (Fix 22A-E)
//
// ISOLATION: This file imports ONLY from schema-generation types
// and pattern-group-configs. It does NOT import from
// generate-itinerary/ or any existing prompt files.

import type { DaySchema, DaySlot, PatternGroupConfig } from '@/types/schema-generation';
import { getPatternGroupConfig } from '@/config/pattern-group-configs';

/**
 * Output of the serializer — the two prompt strings the AI needs.
 */
export interface SerializedPrompt {
  systemPrompt: string;
  userPrompt: string;
  estimatedTokens: number;   // rough char count for logging
}

/**
 * Additional context the serializer needs beyond the DaySchema.
 * These are existing data points already available in the generation pipeline.
 */
export interface SerializerContext {
  // === EXISTING FIELDS (from Fix 22C) ===
  // Traveler profile data
  archetypeDescription: string;   // 2-3 sentence description of the archetype
  archetypeAvoidList: string[];   // things this archetype dislikes
  experiencePriorities: string[]; // what this archetype values most

  // Destination context (existing prompt content that survives)
  destinationContext: string;     // city knowledge, local tips, etc.

  // Budget
  budgetTier: string;             // e.g., "moderate", "luxury", "budget"
  budgetConstraints: string;      // existing budget prompt text

  // Existing prompt sections that survive the schema transition
  bookingRules: string;           // when to mark bookingRequired: true
  tipInstructions: string;        // how to write the tips field
  personalizationInstructions: string; // how to write personalization
  hiddenGemInstructions: string;  // how to identify hidden gems

  // Group trip
  isGroupTrip: boolean;
  allTravelerIds: string;         // comma-separated IDs for suggestedFor

  // === NEW FIELDS (Fix 22G — Gap Fixes) ===

  /** Gap 1: Raw user constraints text to inject into the prompt. */
  userConstraintsText?: string;

  /** Gap 3: First-time vs returning visitor guidance. */
  visitorGuidance?: string;

  /** Gap 5: Trip purpose / additional notes. */
  tripPurpose?: string;

  /** Gap 6: Interest category weighting. */
  interestWeighting?: string;

  /** Gap 7: Must-haves checklist text. */
  mustHavesText?: string;

  /** Gap 8: Skip list — venues/activities from previous days. */
  skipList?: string;
}

/**
 * Convert a DaySchema + context into AI prompts.
 */
export function serializeSchemaToPrompt(
  schema: DaySchema,
  context: SerializerContext
): SerializedPrompt {
  const config = getPatternGroupConfig(schema.patternGroup);
  const systemPrompt = buildSystemPrompt(schema, config, context);
  const userPrompt = buildUserPrompt(schema);

  return {
    systemPrompt,
    userPrompt,
    estimatedTokens: systemPrompt.length + userPrompt.length,
  };
}

/**
 * Build the system prompt — role, traveler profile, destination, rules.
 * This REPLACES the existing ~17 system prompt sections with focused sections.
 */
function buildSystemPrompt(
  schema: DaySchema,
  config: PatternGroupConfig,
  ctx: SerializerContext
): string {
  const sections: string[] = [];

  // Section 1: ROLE AND VOICE
  sections.push(`## ROLE AND VOICE

You are Voyance's itinerary AI. You fill pre-structured day schemas with specific places, times, costs, and tips for ${schema.destination}.

CRITICAL: You do NOT decide the day's structure — that is already defined in the schema below. Your job is to populate EMPTY slots with excellent, personalized recommendations. FILLED slots are LOCKED — do not modify them.`);

  // Section 2: TRAVELER PROFILE
  sections.push(`## TRAVELER PROFILE

Name: ${schema.travelers.map(t => t.name).join(' & ')}
DNA Type: ${schema.archetypeName} (${config.displayName})
${ctx.archetypeDescription}

AVOID: ${ctx.archetypeAvoidList.join(', ')}

PRIORITIES: ${ctx.experiencePriorities.join(', ')}`);

  // Section 3: DESTINATION KNOWLEDGE
  if (ctx.destinationContext) {
    sections.push(`## DESTINATION KNOWLEDGE

${ctx.destinationContext}`);
  }

  // Section 4: BUDGET
  sections.push(`## BUDGET

Tier: ${ctx.budgetTier}
${ctx.budgetConstraints}`);

  // Section 5: SLOT FILLING RULES
  let slotRules = `## SLOT FILLING RULES

1. FILLED slots are LOCKED. Do not modify their title, time, cost, or any data. Include them in your response EXACTLY as provided.

2. EMPTY slots are yours to fill. Follow the time window, duration range, and instruction for each slot.

3. Every slot MUST have ALL of these fields:
   - id (generate a unique string)
   - title (specific place name, not generic)
   - startTime (HH:MM format, within the slot's time window)
   - endTime (HH:MM format, duration within the slot's range)
   - category (one of: dining, sightseeing, entertainment, nightlife, relaxation, shopping, transport, hotel, arrival, departure, free_time)
   - location (full address or specific location name)
   - cost (number, per person, in USD)
   - bookingRequired (boolean)
   - personalization (1-2 sentences explaining why this fits the traveler)
   - tips (1-2 practical tips for this specific activity)
   - crowdLevel (low, moderate, high)
   - isHiddenGem (boolean)
   - hasTimingHack (boolean)

4. Meals: ${config.mealInstruction} Duration: ${config.mealDuration.min}-${config.mealDuration.max} minutes.

5. No two consecutive activities should be in the same category.

6. Activities should be geographically logical — don't zigzag across the city.

7. Minimum ${config.bufferMinutes} minutes between the end of one activity and the start of the next (travel + transition time).`;

  if (ctx.isGroupTrip) {
    slotRules += `

8. REQUIRED — suggestedFor: "${ctx.allTravelerIds}" on EVERY activity. This is a group trip. EVERY slot must include suggestedFor. No exceptions.`;
  }

  sections.push(slotRules);

  // Section 6: ARCHETYPE-SPECIFIC INSTRUCTIONS
  if (config.specialInstructions.length > 0) {
    sections.push(`## ARCHETYPE-SPECIFIC INSTRUCTIONS

${config.specialInstructions.map(inst => `- ${inst}`).join('\n')}`);
  }

  // === NEW SECTIONS (Fix 22G — Gap Fixes) ===

  // Section 7: USER CONSTRAINTS (Gap 1)
  if (ctx.userConstraintsText) {
    sections.push(`## USER CONSTRAINTS

The traveler specified the following constraints and preferences:

${ctx.userConstraintsText}`);
  }

  // Section 8: VISITOR CONTEXT (Gap 3)
  if (ctx.visitorGuidance) {
    sections.push(`## VISITOR CONTEXT

${ctx.visitorGuidance}`);
  }

  // Section 9: TRIP PURPOSE (Gap 5)
  if (ctx.tripPurpose) {
    sections.push(`## TRIP PURPOSE

${ctx.tripPurpose}`);
  }

  // Section 10: INTEREST WEIGHTING (Gap 6)
  if (ctx.interestWeighting) {
    sections.push(`## INTEREST PREFERENCES

${ctx.interestWeighting}`);
  }

  // Section 11: MUST-HAVES CHECKLIST (Gap 7)
  if (ctx.mustHavesText) {
    sections.push(`## TRIP MUST-HAVES

The traveler wants to experience these things during their trip (not necessarily today — but work them in where they fit naturally):

${ctx.mustHavesText}`);
  }

  // Section 12: SKIP LIST (Gap 8)
  if (ctx.skipList) {
    sections.push(`## DO NOT REPEAT

The following activities and venues have already been scheduled on previous days. Do NOT suggest them again:

${ctx.skipList}`);
  }

  // Surviving sections from the existing prompt
  if (ctx.bookingRules) {
    sections.push(`## BOOKING RULES

${ctx.bookingRules}`);
  }
  if (ctx.tipInstructions) {
    sections.push(`## TIP WRITING

${ctx.tipInstructions}`);
  }
  if (ctx.personalizationInstructions) {
    sections.push(`## PERSONALIZATION

${ctx.personalizationInstructions}`);
  }
  if (ctx.hiddenGemInstructions) {
    sections.push(`## HIDDEN GEM IDENTIFICATION

${ctx.hiddenGemInstructions}`);
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Build the user prompt — the schema with slots to fill.
 * This REPLACES the existing ~16 user prompt sections.
 */
function buildUserPrompt(schema: DaySchema): string {
  const lines: string[] = [];

  lines.push(`Fill this schema for Day ${schema.dayNumber} in ${schema.destination} on ${schema.date}.`);
  lines.push('');
  lines.push('SCHEMA:');
  lines.push('');

  for (const slot of schema.slots) {
    lines.push(serializeSlot(slot));
    lines.push('---');
  }

  lines.push('');
  lines.push(`Return a JSON array of ALL ${schema.slots.length} slots (both filled and empty-now-filled) in order, using the create_day_itinerary tool.`);
  lines.push('');
  lines.push('IMPORTANT: Return EXACTLY the same number of activities as there are slots. Do not add extra activities. Do not skip slots.');

  return lines.join('\n');
}

/**
 * Serialize a single slot into prompt text.
 */
function serializeSlot(slot: DaySlot): string {
  const lines: string[] = [];

  const typeLabel = slot.mealType
    ? `${slot.slotType.toUpperCase()}: ${slot.mealType.toUpperCase()}`
    : slot.slotType.toUpperCase();

  lines.push(`SLOT ${slot.position}: [${typeLabel}] — ${slot.status.toUpperCase()}`);

  if (slot.status === 'filled' && slot.filledData) {
    lines.push('  LOCKED — DO NOT MODIFY');
    lines.push(`  Title: ${slot.filledData.title}`);
    lines.push(`  Time: ${slot.filledData.startTime} - ${slot.filledData.endTime}`);
    lines.push(`  Category: ${slot.filledData.category}`);
    if (slot.filledData.location) {
      lines.push(`  Location: ${slot.filledData.location}`);
    }
    if (slot.filledData.cost !== undefined) {
      lines.push(`  Cost: $${slot.filledData.cost}`);
    }
    if (slot.filledData.source === 'must_do') {
      lines.push('  ⚠ This is the traveler\'s must-do activity. Preserve exactly.');
    }
    if (slot.filledData.notes) {
      lines.push(`  Notes: ${slot.filledData.notes}`);
    }
  } else {
    lines.push('  FILL THIS SLOT');
    lines.push(`  Type: ${typeLabel}`);
    if (slot.timeWindow) {
      lines.push(`  Time window: ${slot.timeWindow.earliest} - ${slot.timeWindow.latest}`);
      lines.push(`  Duration: ${slot.timeWindow.duration.min}-${slot.timeWindow.duration.max} minutes`);
    }
    if (slot.required) {
      lines.push('  Required: YES — this slot must be filled');
    } else {
      lines.push('  Required: OPTIONAL — fill if the day has room');
    }
    if (slot.aiInstruction) {
      lines.push(`  Instruction: ${slot.aiInstruction}`);
    }
    if (slot.mealInstruction) {
      lines.push(`  Meal guidance: ${slot.mealInstruction}`);
    }
  }

  return lines.join('\n');
}
