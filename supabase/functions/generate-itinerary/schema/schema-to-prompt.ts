// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/schema-to-prompt.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import type { DaySchema, DaySlot, PatternGroupConfig } from './types.ts';
import { getPatternGroupConfig } from './pattern-group-configs.ts';

export interface SerializedPrompt {
  systemPrompt: string;
  userPrompt: string;
  estimatedTokens: number;
}

export interface SerializerContext {
  // === EXISTING FIELDS (from Fix 22C) ===
  archetypeDescription: string;
  archetypeAvoidList: string[];
  experiencePriorities: string[];
  destinationContext: string;
  budgetTier: string;
  budgetConstraints: string;
  bookingRules: string;
  tipInstructions: string;
  personalizationInstructions: string;
  hiddenGemInstructions: string;
  isGroupTrip: boolean;
  allTravelerIds: string;

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

  // === Fix 22P: Fields passed by index.ts but previously undeclared ===
  transportPreferences?: string;
  voyancePicks?: string;
  tripTypeContext?: string;
  collaboratorAttribution?: string;
}

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

function buildSystemPrompt(
  schema: DaySchema,
  config: PatternGroupConfig,
  ctx: SerializerContext
): string {
  const sections: string[] = [];

  // Section 1: ROLE AND VOICE
  sections.push(`## ROLE AND VOICE

You are Voyance's itinerary AI — think of yourself as an expert travel concierge planning a day in ${schema.destination}.

Below is a SUGGESTED structure for this day. It includes the general flow (arrival, transport, meals, activities, evening) and any confirmed details (flights, hotel, must-do events). Use this structure as your starting point, but apply common sense. If the suggested order doesn't make logical sense for this specific traveler's situation, adjust it.

CONFIRMED items (marked CONFIRMED below) must appear in your response with their exact title, time, and details preserved. Everything else is a suggestion you can reorder, combine, or adjust.

YOUR GOAL: Produce a day that a real traveler would look at and think "yes, this makes sense — I can actually do this in this order, at these times, without rushing or wasting time."`);

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

  // Section 5: HOW TO USE THIS STRUCTURE
  let slotRules = `## HOW TO USE THIS STRUCTURE

The schema below is a SUGGESTED day plan. Here's how to work with it:

CONFIRMED items: Keep these exactly as shown — they come from real flight data, hotel bookings, or the traveler's must-do requests. Do not change their title, time, or details.

SUGGESTED items: These are recommendations for the flow of the day. Fill them with specific, real places in ${schema.destination}. You can:
- Adjust the suggested time windows if the flow makes more sense at different times
- Reorder suggestions if the original order is illogical for this specific day
- Skip an optional suggestion if the day is already full
- But do NOT skip required meals (breakfast, lunch, dinner) — every day needs proper meals at sensible times

OUTPUT FORMAT — every activity must include these fields (use EXACTLY this structure):
- id (unique string)
- title (specific real place name — never generic like "A Restaurant" or "Afternoon Activity")
- startTime and endTime (HH:MM 24-hour format)
- category (one of: "sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity")
  • Use "dining" for ALL meals, restaurants, cafés, food halls, brunch spots
  • Use "accommodation" for hotel check-in, check-out, bag drops
  • Use "transport" for taxis, trains, airport transfers
  • Use "activity" for generic activities, tours, shows, nightlife, entertainment
  • Use "cultural" for museums, galleries, historical sites, temples
- location: { name: "Place Name", address: "Full street address" }
- cost: { amount: number, currency: "USD", basis: "per_person" | "flat" | "per_room" }
  • amount is per person in USD. Use 0 for free activities.
- bookingRequired (boolean)
- personalization: { tags: ["tag1", "tag2"], whyThisFits: "1-2 sentences why this fits the traveler", confidence: 0.0-1.0, matchedInputs: ["input1"] }
- tips (1-2 practical, specific tips — real local knowledge, not generic advice)
- crowdLevel ("low", "moderate", or "high")
- isHiddenGem (boolean)
- hasTimingHack (boolean)

COMMON SENSE RULES:
- Meals go in meal slots. Do NOT put restaurants, dinner venues, or food-focused experiences in activity or evening slots. If the traveler needs dinner, use the dinner slot. If there's no dinner slot but it's dinner time, add one — don't disguise dinner as an "evening activity."
- One meal per meal period. One breakfast, one lunch, one dinner. Not two dinners. Not a "rooftop bar" followed by "a nice dinner" followed by "jazz dinner." Pick the best option and move on.
- If a must-do event covers a meal window (e.g., US Open 9am-5pm covers lunch), note that the traveler will eat at the venue — don't schedule a separate restaurant for that meal.
- Geographic logic. Don't zigzag across the city. Group nearby activities together.
- Buffer time. Allow at least ${config.bufferMinutes} minutes between activities for travel and transitions.
- Chronological order. Activities must be in time order. No activity should start before the previous one ends.

COMMON SENSE EXAMPLES:
- Traveler lands at 8:15 AM and has a 9:00 AM must-do event → Do NOT go to the hotel first. Drop bags at the hotel bell desk (15 min), then head straight to the event. Full hotel check-in happens later that evening.
- Traveler has an all-day event (9am-5pm) → Don't schedule activities during the event. Schedule before it (breakfast, transport to venue) and after it (dinner, evening entertainment). The traveler eats lunch at the venue.
- It's 5 PM after a long day at an event → Dinner first, then one evening activity (show, jazz, bar). Not three dining experiences in a row.
- Traveler is departing and flight is at 7 PM → Work backward: be at airport by 5 PM, leave last activity by 4 PM, so only schedule morning and early afternoon activities.`;

  if (ctx.isGroupTrip) {
    slotRules += `

GROUP TRIP: This is a trip for ${schema.travelers.map(t => t.name).join(' & ')}. Every single activity must include suggestedFor: "${ctx.allTravelerIds}". No exceptions.`;
  }

  slotRules += `

${config.mealInstruction ? 'MEAL STYLE: ' + config.mealInstruction : ''}
MEAL DURATION: ${config.mealDuration.min}-${config.mealDuration.max} minutes.`;

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

function buildUserPrompt(schema: DaySchema): string {
  const lines: string[] = [];

  lines.push(`Plan Day ${schema.dayNumber} in ${schema.destination} on ${schema.date}.`);

  if (schema.dayType === 'transition') {
    lines.push('');
    lines.push('NOTE: This is a TRANSITION DAY between two cities. The morning takes place in the origin city and the evening takes place in the destination city. Recommendations must be geographically appropriate for each part of the day.');
  }

  lines.push('');
  lines.push(`Here's the suggested structure. CONFIRMED items are locked (real bookings/flight data). SUGGESTED items are yours to fill with great, specific recommendations. Use common sense — if the order below doesn't work for this traveler's situation, adjust it.`);
  lines.push('');

  for (const slot of schema.slots) {
    lines.push(serializeSlot(slot));
    lines.push('---');
  }

  lines.push('');
  lines.push(`Return ALL activities for this day as a JSON array using the create_day_itinerary tool. Include every CONFIRMED item exactly as shown, plus your recommendations for the SUGGESTED slots. Activities must be in chronological order.`);

  return lines.join('\n');
}

function serializeSlot(slot: DaySlot): string {
  const lines: string[] = [];

  const typeLabel = slot.mealType
    ? `${slot.slotType} (${slot.mealType})`
    : slot.slotType;

  if (slot.status === 'filled' && slot.filledData) {
    lines.push(`${slot.position + 1}. [CONFIRMED] ${typeLabel}`);
    lines.push(`   ${slot.filledData.title}`);
    lines.push(`   Time: ${slot.filledData.startTime} - ${slot.filledData.endTime}`);
    lines.push(`   Category: ${slot.filledData.category}`);
    if (slot.filledData.location) {
      lines.push(`   Location: ${slot.filledData.location}`);
    }
    if (slot.filledData.cost !== undefined) {
      lines.push(`   Cost: $${slot.filledData.cost}`);
    }
    if (slot.filledData.notes) {
      lines.push(`   ${slot.filledData.notes}`);
    }
  } else {
    const reqLabel = slot.required ? '' : ' (optional)';
    lines.push(`${slot.position + 1}. [SUGGESTED] ${typeLabel}${reqLabel}`);
    if (slot.timeWindow) {
      lines.push(`   Suggested time: ${slot.timeWindow.earliest} - ${slot.timeWindow.latest}`);
      lines.push(`   Duration: ${slot.timeWindow.duration.min}-${slot.timeWindow.duration.max} min`);
    }
    if (slot.aiInstruction) {
      lines.push(`   ${slot.aiInstruction}`);
    }
    if (slot.mealInstruction) {
      lines.push(`   ${slot.mealInstruction}`);
    }
  }

  return lines.join('\n');
}
