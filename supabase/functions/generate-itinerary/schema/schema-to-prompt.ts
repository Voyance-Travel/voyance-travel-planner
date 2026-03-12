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

  // === Gap Analysis Fix: Ported from old path ===

  /** Core principle + general requirements block. */
  corePrinciple?: string;

  /** 12 numbered quality rules. */
  qualityRules?: string;

  /** Activity count hard limits with FAILURE language. */
  activityCountLimits?: string;

  /** 8-level generation hierarchy + comprehensive constraints. */
  generationHierarchy?: string;

  /** Timing instructions (arrival/departure/full-day structure). */
  timingInstructions?: string;

  /** Destination essentials (DB-driven city knowledge). */
  destinationEssentials?: string;

  /** Day-of-week awareness + venue hours cache. */
  operatingHoursContext?: string;

  /** Per-archetype budget ceilings. */
  budgetCeilings?: string;

  /** Banned experience types from previous days. */
  bannedExperienceTypes?: string;

  /** Multi-city context (city isolation, visitor status, hotel anchoring). */
  multiCityContext?: string;

  /** Voyance intelligence fields with examples and minimums. */
  voyanceIntelligenceFields?: string;

  /** Day-of-week name for scheduling awareness. */
  dayOfWeek?: string;

  /** Number of travelers. */
  travelerCount?: number;

  /** Daily budget per person. */
  dailyBudgetPerPerson?: number | null;

  /** Whether this is a full exploration day (not arrival/departure). */
  isFullDay?: boolean;

  /** Whether this is a Smart Finish polish. */
  isSmartFinish?: boolean;

  /** Budget-down rewrite detection text. */
  budgetDownRewrite?: string;
}

export function serializeSchemaToPrompt(
  schema: DaySchema,
  context: SerializerContext
): SerializedPrompt {
  const config = getPatternGroupConfig(schema.patternGroup);
  const systemPrompt = buildSystemPrompt(schema, config, context);
  const userPrompt = buildUserPrompt(schema, context);

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

  // Section 1: ROLE AND VOICE + CORE PRINCIPLE
  sections.push(`## ROLE AND VOICE

You are Voyance's itinerary AI — an expert travel concierge creating a COMPLETE hour-by-hour travel plan for ${schema.destination} — not a suggestion list.

CORE PRINCIPLE: A Voyance itinerary plans the traveler's ENTIRE day, hour by hour, from waking up to going to sleep. It handles logistics, meals, transit, and the little decisions that stress people out when traveling.

Below is a SUGGESTED structure for this day. It includes the general flow (arrival, transport, meals, activities, evening) and any confirmed details (flights, hotel, must-do events). Use this structure as your starting point, but apply common sense. If the suggested order doesn't make logical sense for this specific traveler's situation, adjust it.

CONFIRMED items (marked CONFIRMED below) must appear in your response with their exact title, time, and details preserved. Everything else is a suggestion you can reorder, combine, or adjust.

YOUR GOAL: Produce a day that a real traveler would look at and think "yes, this makes sense — I can actually do this in this order, at these times, without rushing or wasting time."`);

  // Section 2: GENERATION HIERARCHY (8-level priority chain + comprehensive constraints)
  if (ctx.generationHierarchy) {
    sections.push(`## GENERATION HIERARCHY & CONSTRAINTS

${ctx.generationHierarchy}`);
  }

  // Section 3: QUALITY RULES
  if (ctx.qualityRules) {
    sections.push(`## ${ctx.qualityRules}`);
  } else {
    sections.push(`## QUALITY RULES (STRICTLY ENFORCED)

1. Every activity MUST have a title, startTime, endTime, category, and location
2. Times MUST be in HH:MM format (24-hour, e.g., "09:00", "14:30")
3. Hotel check-in/checkout: bookingRequired=false, cost.amount=0
4. Airport transfers: bookingRequired=false (user arranges transport)
5. Free time/leisure: bookingRequired=false, cost.amount=0
6. Only tours, museums, and ticketed attractions should have bookingRequired=true
7. NO DUPLICATE ACTIVITIES: NEVER schedule the same type back-to-back. NEVER two of the same category on the same day (e.g., two comedy shows, two museum visits)
8. TRIP-WIDE UNIQUENESS: Each unique experience (cooking class, wine tasting) should appear AT MOST ONCE in the ENTIRE trip unless user explicitly requested it on multiple days
9. VARIETY PER DAY: Mix sightseeing, cultural sites, museums, outdoor activities, dining
10. ACTIVITY TITLE NAMING — CRITICAL: The "title" field MUST be the venue or experience name ONLY. NEVER append the category or type. WRONG: "Barton Springs Pool Pool". CORRECT: "Barton Springs Pool"
11. DINING TITLE — CRITICAL: For ALL dining activities, the "title" MUST be the restaurant name. NEVER use neighborhood as title. WRONG: { title: "Gaslamp Quarter" }. RIGHT: { title: "Juniper & Ivy", neighborhood: "Gaslamp Quarter" }
12. LAST DAY MUST end with: Checkout → Transfer → Departure`);
  }

  // Section 4: TRAVELER PROFILE
  sections.push(`## TRAVELER PROFILE

Name: ${schema.travelers.map(t => t.name).join(' & ')}
DNA Type: ${schema.archetypeName} (${config.displayName})
${ctx.archetypeDescription}

AVOID: ${ctx.archetypeAvoidList.join(', ')}

PRIORITIES: ${ctx.experiencePriorities.join(', ')}`);

  // Section 5: DESTINATION KNOWLEDGE
  if (ctx.destinationContext) {
    sections.push(`## DESTINATION KNOWLEDGE

${ctx.destinationContext}`);
  }

  // Section 5b: DESTINATION ESSENTIALS (DB-driven)
  if (ctx.destinationEssentials) {
    sections.push(`## DESTINATION ESSENTIALS

${ctx.destinationEssentials}`);
  }

  // Section 6: BUDGET
  let budgetSection = `## BUDGET

Tier: ${ctx.budgetTier}
${ctx.budgetConstraints}`;

  if (ctx.budgetCeilings) {
    budgetSection += `\n\n${ctx.budgetCeilings}`;
  }

  if (ctx.budgetDownRewrite) {
    budgetSection += `\n\n${ctx.budgetDownRewrite}`;
  }

  sections.push(budgetSection);

  // Section 7: TIMING INSTRUCTIONS (arrival/departure/full-day structure)
  if (ctx.timingInstructions) {
    sections.push(`## DAY STRUCTURE & TIMING

${ctx.timingInstructions}`);
  }

  // Section 8: TRIP TYPE (honeymoon, family, solo, etc.)
  if (ctx.tripTypeContext) {
    sections.push(`## TRIP TYPE

${ctx.tripTypeContext}`);
  }

  // Section 9: HOW TO USE THIS STRUCTURE (updated with general requirements)
  let slotRules = `## HOW TO USE THIS STRUCTURE

The schema below is a SUGGESTED day plan. Here's how to work with it:

CONFIRMED items: Keep these exactly as shown — they come from real flight data, hotel bookings, or the traveler's must-do requests. Do not change their title, time, or details.

SUGGESTED items: These are recommendations for the flow of the day. Fill them with specific, real places in ${schema.destination}. You can:
- Adjust the suggested time windows if the flow makes more sense at different times
- Reorder suggestions if the original order is illogical for this specific day
- Skip an optional suggestion if the day is already full
- But do NOT skip required meals (breakfast, lunch, dinner) — every day needs proper meals at sensible times

GENERAL REQUIREMENTS:
- Include FULL street addresses for all locations
- Provide realistic cost estimates — prices on EVERYTHING (meals, tickets, transit)
- PRICE CONTEXT: Every estimatedCost MUST include "basis": "per_person" | "flat" | "per_room"
- Include TRANSIT between EVERY pair of consecutive activities as separate entries with category "transport"
- Include 3 MEALS per full day: breakfast, lunch, dinner — each a real named restaurant with price
- Each lunch/dinner must include 1 ALTERNATIVE option in its "tips" field
- Include at least 1 EVENING/NIGHTLIFE activity after dinner (bar, show, night market, jazz, rooftop)
- The LAST activity's tips must include a NEXT MORNING PREVIEW: "Tomorrow: Wake [time]. Breakfast at [place] (~[price])."
- For full exploration days: minimum 3 paid activities + 2 free activities + 3 meals + evening option
- ONLY recommend restaurants with 4+ star ratings

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
- tags (array of 5+ keyword strings for filtering — e.g. "outdoor", "romantic", "family-friendly", "historic", "waterfront")
- transportation: { method: "walk"|"metro"|"taxi"|"bus"|"rideshare", duration: "10 min", estimatedCost: { amount: number, currency: "USD" }, instructions: "Take the 6 train northbound" }
  • How to get here from the previous activity. Walking cost MUST be 0.
- contextualTips: array of 1-4 objects { type: "timing"|"booking"|"money_saving"|"transit"|"cultural"|"safety"|"hidden_gem"|"weather"|"general", text: "specific tip" }
- rating: { value: number (e.g. 4.5), totalReviews: number }
- website (URL string, if known)
- tips (1-2 practical, specific tips — real local knowledge, not generic advice)
- crowdLevel ("low", "moderate", or "high")
- isHiddenGem (boolean)
- hasTimingHack (boolean)`;

  // Activity count hard limits
  if (ctx.activityCountLimits) {
    slotRules += `\n\n${ctx.activityCountLimits}`;
  }

  slotRules += `

CURATED PICKS — ONE BEST CHOICE PER SLOT:
Generate exactly ONE activity per time slot. Do NOT generate multiple options or alternatives. Every slot must have a single, definitive, curated recommendation. You are delivering a finished plan — not a quiz.

BUFFER TIME — MANDATORY:
Include realistic travel and transition time between every activity. NEVER schedule back-to-back with zero gap. Minimum gaps:
- 5 minutes between activities at the same venue/location
- 10-15 minutes between nearby activities within walking distance
- 15-20 minutes for restaurant arrivals (be seated, review menu, order)
- 20-30 minutes for hotel check-in or check-out
- 30-60 minutes for airport-related activities (security, customs, boarding)
Include actual transit time between locations not within walking distance.

OPERATING HOURS — HARD CONSTRAINT${ctx.dayOfWeek ? ` (TODAY IS ${ctx.dayOfWeek.toUpperCase()})` : ''}:
Never schedule an activity before its opening time or after its closing time.${ctx.dayOfWeek === 'Monday' ? '\n⚠️ Many European museums close on MONDAYS. Do NOT schedule museum visits — use an alternative.' : ''}
When exact hours are unknown, use conservative defaults: attractions 09:30-17:00, restaurants lunch 11:30-14:00 and dinner 18:00-21:30.`;

  if (ctx.operatingHoursContext) {
    slotRules += `\n\n${ctx.operatingHoursContext}`;
  }

  slotRules += `

COMMON SENSE RULES:
- Meals go in meal slots. Do NOT put restaurants in activity or evening slots.
- One meal per meal period. One breakfast, one lunch, one dinner.
- If a must-do event covers a meal window (e.g., US Open 9am-5pm covers lunch), the traveler eats at the venue.
- Geographic logic. Don't zigzag across the city. Group nearby activities together.
- Buffer time. Allow at least ${config.bufferMinutes} minutes between activities.
- Chronological order. Activities must be in time order.

COMMON SENSE EXAMPLES:
- Traveler lands at 8:15 AM and has a 9:00 AM must-do → Do NOT go to hotel first. Drop bags, head to event.
- All-day event (9am-5pm) → Don't schedule during event. Schedule before and after.
- 5 PM after long event → Dinner first, then one evening activity. Not three dining experiences.
- Departing with 7 PM flight → Work backward: airport by 5 PM, leave last activity by 4 PM.

ARCHETYPE NAMES — EXACT MATCH ONLY:
Use ONLY the exact archetype name from the traveler's DNA profile. Never invent variations.

ARCHETYPE BALANCE:
Archetype influences 30-40% of activities. It is seasoning, NOT the meal. Every day must include a MIX of archetype-aligned and universally enjoyable activities.

OUTPUT QUALITY:
All text must be clean, correctly spelled English. No garbled characters, no non-Latin script, no leaked schema field names.

LANGUAGE — HARD RULE:
ALL text output MUST be in clean, correctly spelled English. For non-Latin-script destinations, use standard English transliterations. NEVER output Chinese, Japanese, Korean, Arabic, Cyrillic, or Thai script.`;

  if (ctx.isGroupTrip) {
    slotRules += `

GROUP TRIP: This is a trip for ${schema.travelers.map(t => t.name).join(' & ')}. Every single activity must include suggestedFor: "${ctx.allTravelerIds}". No exceptions.`;
  }

  slotRules += `

${config.mealInstruction ? 'MEAL STYLE: ' + config.mealInstruction : ''}
MEAL DURATION: ${config.mealDuration.min}-${config.mealDuration.max} minutes.`;

  sections.push(slotRules);

  // Section 10: VOYANCE INTELLIGENCE FIELDS (full block with examples)
  if (ctx.voyanceIntelligenceFields) {
    sections.push(ctx.voyanceIntelligenceFields);
  } else {
    sections.push(`## VOYANCE INTELLIGENCE FIELDS — MANDATORY FOR EVERY ACTIVITY

For EVERY activity you generate, you MUST include ALL of these intelligence fields:

1. "tips" (string, 30+ chars): A specific, actionable insider tip. NOT generic advice. Example: "Ask for the corner table with harbor view — regulars know it's the best seat"
2. "crowdLevel" (string): Must be "low", "moderate", or "high" — your estimate at the SCHEDULED time
3. "isHiddenGem" (boolean): true ONLY for genuine discoveries (not in top-10 TripAdvisor, not in mainstream guides). At least 1-2 per day should be true.
4. "hasTimingHack" (boolean): true if THIS specific time slot gives an advantage (crowd avoidance, golden hour, special access). At least 2-3 per day should be true.
5. "bestTime" (string): If hasTimingHack=true, explain WHY (e.g., "Arrives before the 10am tour bus rush")
6. "voyanceInsight" (string): One unique fact most travelers don't know. Example: "The second floor has a hidden terrace that's not on any map"
7. "personalization.whyThisFits" (string): MUST reference at LEAST ONE specific traveler trait by name.
   ❌ BAD: "This fits your travel style" (too generic)
   ✅ GOOD: "Your authenticity score of +7 means you'll prefer this local izakaya over the tourist-facing ramen chain"
   ✅ GOOD: "With your luxury budget tier and love of omakase, this 8-seat counter is your signature meal"
8. "contextualTips" (array): 1-4 TYPED tips. Types: timing, booking, money_saving, transit, cultural, safety, hidden_gem, weather, general.
   Every paid activity should have at least 1 contextual tip.

DO NOT leave these fields empty or omit them. They are the core intelligence layer.`);
  }

  // Section 11: ARCHETYPE-SPECIFIC INSTRUCTIONS
  if (config.specialInstructions.length > 0) {
    sections.push(`## ARCHETYPE-SPECIFIC INSTRUCTIONS

${config.specialInstructions.map(inst => `- ${inst}`).join('\n')}`);
  }

  // === PORTED SECTIONS (Gap Analysis Fix) ===

  // Section 12: USER CONSTRAINTS (Gap 1)
  if (ctx.userConstraintsText) {
    sections.push(`## USER CONSTRAINTS

The traveler specified the following constraints and preferences:

${ctx.userConstraintsText}`);
  }

  // Section 13: VISITOR CONTEXT (Gap 3)
  if (ctx.visitorGuidance) {
    sections.push(`## VISITOR CONTEXT

${ctx.visitorGuidance}`);
  }

  // Section 14: TRIP PURPOSE (Gap 5)
  if (ctx.tripPurpose) {
    sections.push(`## TRIP PURPOSE

${ctx.tripPurpose}`);
  }

  // Section 15: INTEREST WEIGHTING (Gap 6)
  if (ctx.interestWeighting) {
    sections.push(`## INTEREST PREFERENCES

${ctx.interestWeighting}`);
  }

  // Section 16: MUST-HAVES CHECKLIST (Gap 7)
  if (ctx.mustHavesText) {
    sections.push(`## TRIP MUST-HAVES

The traveler wants to experience these things during their trip (not necessarily today — but work them in where they fit naturally):

${ctx.mustHavesText}`);
  }

  // Section 17: SKIP LIST (Gap 8)
  if (ctx.skipList) {
    sections.push(`## DO NOT REPEAT

The following activities and venues have already been scheduled on previous days. Do NOT suggest them again:

${ctx.skipList}`);
  }

  // Section 18: BANNED EXPERIENCE TYPES
  if (ctx.bannedExperienceTypes) {
    sections.push(`## BANNED EXPERIENCE TYPES

${ctx.bannedExperienceTypes}`);
  }

  // Section 19: MULTI-CITY CONTEXT
  if (ctx.multiCityContext) {
    sections.push(`## MULTI-CITY TRIP CONTEXT

${ctx.multiCityContext}`);
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

  // Smart Finish anchor preservation
  if (ctx.isSmartFinish) {
    sections.push(`## SMART FINISH — ANCHOR PRESERVATION

HARD RULE: Keep ALL user-provided anchor activities by exact name and build additional activities around them — never replace or drop anchors.`);
  }

  return sections.join('\n\n---\n\n');
}

function buildUserPrompt(schema: DaySchema, ctx: SerializerContext): string {
  const lines: string[] = [];

  lines.push(`Plan Day ${schema.dayNumber} in ${schema.destination} on ${schema.date}${ctx.dayOfWeek ? ` (${ctx.dayOfWeek})` : ''}.`);

  if (ctx.travelerCount) {
    lines.push(`Travelers: ${ctx.travelerCount}`);
  }

  if (ctx.dailyBudgetPerPerson != null) {
    lines.push(`Budget: ${ctx.budgetTier} (~$${ctx.dailyBudgetPerPerson}/day per person)`);
    if (ctx.dailyBudgetPerPerson < 10) {
      lines.push(`🚨 EXTREMELY TIGHT BUDGET: Prioritize FREE activities. Use realistic local prices — do NOT invent fake low prices.`);
    } else if (ctx.dailyBudgetPerPerson < 30) {
      lines.push(`⚡ TIGHT BUDGET: Lean heavily on free attractions, street food, self-guided exploration.`);
    }
  }

  if (schema.dayType === 'transition') {
    lines.push('');
    lines.push('NOTE: This is a TRANSITION DAY between two cities. The morning takes place in the origin city and the evening takes place in the destination city. Recommendations must be geographically appropriate for each part of the day.');
  }

  if (ctx.isFullDay) {
    lines.push('');
    lines.push('DAY TYPE: Full exploration day — generate a COMPLETE hour-by-hour plan with 3 meals, transit between every stop, evening activity, and next-morning preview. Fill EVERY hour.');
  }

  lines.push('');
  lines.push(`Here's the suggested structure. CONFIRMED items are locked (real bookings/flight data). SUGGESTED items are yours to fill with great, specific recommendations. Use common sense — if the order below doesn't work for this traveler's situation, adjust it.`);
  lines.push('');

  for (const slot of schema.slots) {
    lines.push(serializeSlot(slot));
    lines.push('---');
  }

  lines.push('');

  // CRITICAL REMINDERS (ported from old path)
  lines.push(`CRITICAL REMINDERS:`);
  if (ctx.activityCountLimits) {
    lines.push(`1. ${ctx.activityCountLimits}`);
  }
  lines.push(`2. Check the archetype's avoid list. If it says "no spa", there are ZERO spa activities.`);
  lines.push(`3. Check the budget constraints. If value-focused, no €100+ experiences.`);
  if (ctx.isFullDay) {
    lines.push(`4. TRANSIT: Include a transport entry between EVERY pair of consecutive activities.`);
    lines.push(`5. PRICES: Every meal, every ticket, every taxi must have a price. No blanks.`);
  }

  lines.push('');
  lines.push(`Return ALL activities for this day as a JSON array using the create_day_itinerary tool. Include every CONFIRMED item exactly as shown, plus your recommendations for the SUGGESTED slots. Activities must be in chronological order.`);
  lines.push(`IMPORTANT: Pick DIFFERENT restaurants/activities than any listed in the skip list. Do not repeat.`);

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
