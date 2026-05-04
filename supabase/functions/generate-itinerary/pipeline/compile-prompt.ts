/**
 * Pipeline Phase 4: Compile Prompt
 *
 * Extracts ~930 lines of prompt assembly from action-generate-day.ts into a
 * single async function. Handles:
 *   - Preference loading & trip intents
 *   - Must-do parsing & scheduling
 *   - Interest categories, generation rules, pacing, visitor type
 *   - Pre-booked commitments & must-haves checklist
 *   - Additional notes / trip purpose injection
 *   - Schema compilation (calls compile-day-schema internally)
 *   - Timing instructions & meal policy derivation
 *   - Traveler profile & archetype guidance (unified loader)
 *   - Generation context (dietary, jet lag, weather, blending, etc.)
 *   - Budget resolution (trip-level + per-city override)
 *   - Voyance Picks
 *   - Collaborator attribution
 *   - System prompt & user prompt assembly
 *
 * Returns CompiledPrompt with the two prompt strings plus all metadata
 * needed by downstream post-processing stages.
 */

import { compileDaySchema } from './compile-day-schema.ts';
import type { CompiledFacts, LockedActivity } from './types.ts';

// External module imports (same as action-generate-day used)
import {
  getUserPreferences,
  getLearnedPreferences,
  buildPreferenceContext,
} from '../preference-context.ts';
import {
  parseMustDoInput,
  scheduleMustDos,
  buildMustHavesConstraintPrompt,
  getBlockedTimeRange,
  type ScheduledMustDo,
} from '../must-do-priorities.ts';
import { formatGenerationRules } from '../budget-constraints.ts';
import {
  analyzePreBookedCommitments,
  type PreBookedCommitment,
} from '../pre-booked-commitments.ts';
import {
  deriveMealPolicy,
  buildMealRequirementsPrompt,
  type MealPolicy,
  type MealPolicyInput,
} from '../meal-policy.ts';
import {
  buildTransitionDayPrompt,
} from '../prompt-library.ts';
import {
  loadTravelerProfile,
  type TravelerProfile as UnifiedTravelerProfile,
} from '../profile-loader.ts';
import {
  getFullArchetypeContext,
  buildFullPromptGuidanceAsync,
  getArchetypeDefinition,
} from '../archetype-data.ts';
import { getDiningConfig, buildDiningPromptBlock, buildGrandEntranceBlock, buildArrivalCulturalAnchorBlock } from '../dining-config.ts';
import {
  buildTripTypePromptSection,
} from '../trip-type-modifiers.ts';
import {
  getDestinationId,
  extractRestaurantVenueName,
} from '../generation-utils.ts';
import {
  normalizeTo24h,
} from '../flight-hotel-context.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LockedCard {
  title: string;
  start_time: string | null;
  end_time: string | null;
  category: string;
  venue_name: string | null;
  locked: true;
  lockedSource: string;
  dayNumber: number;
}

export interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;

  // Side-effects consumed by downstream post-processing
  mustDoEventItems: ScheduledMustDo[];
  dayMealPolicy: MealPolicy | null;
  allUserIdsForAttribution: string[];
  actualDailyBudgetPerPerson: number | null;
  profile: UnifiedTravelerProfile;
  effectiveBudgetTier: string;
  isSmartFinish: boolean;
  smartFinishRequested: boolean;
  metadata: Record<string, unknown> | null;
  mustDoActivitiesRaw: string;
  preferenceContext: string;

  // Schema outputs (updated by compileDaySchema)
  dayConstraints: string;
  flightContext: any;

  // Locked cards from perDayActivities (LOCK phase)
  lockedCards: LockedCard[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCK PHASE HELPERS — Parse user activities into immutable locked cards
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTimeStr(raw: string): string | null {
  // Strip leading tilde/approx markers
  const cleaned = raw.trim().replace(/^[~≈]\s*/, '');
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) {
    const h24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) return cleaned;
    return null;
  }
  let hour = parseInt(match[1]);
  const min = match[2] ? parseInt(match[2]) : 0;
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

function detectActivityCategory(text: string): string {
  const lower = text.toLowerCase();
  // Transit
  if (/\b(flight|depart|land|airport|lounge|train|transfer|arrive)\b/i.test(lower)) return 'transit';
  // Dining
  if (/breakfast|brunch/i.test(lower)) return 'dining';
  if (/lunch|dinner|supper/i.test(lower)) return 'dining';
  if (/\b(drinks?|cocktail|wine\b(?!\s*tasting)|bar|coffee)\b/i.test(lower)) return 'dining';
  // Accommodation
  if (/hotel|check.?in|check.?out/i.test(lower)) return 'accommodation';
  // Explore
  if (/museum|gallery|tour|visit|mosque/i.test(lower)) return 'explore';
  // Activity
  if (/spa|wellness|hammam|massage/i.test(lower)) return 'activity';
  if (/meeting|presentation|orientation|company|conference|workshop|session|panel/i.test(lower)) return 'activity';
  if (/pool|beach|relax/i.test(lower)) return 'activity';
  if (/shopping|market|souk|bazaar/i.test(lower)) return 'activity';
  if (/wine\s*tasting|volunteering/i.test(lower)) return 'activity';
  if (/\b(wake|get ready|freshen)\b/i.test(lower)) return 'activity';
  return 'activity';
}

/** Known activity words that precede a venue name after a dash separator */
const VENUE_PREFIX_WORDS = /^(dinner|lunch|breakfast|brunch|spa|transfer|drinks?|cocktails?|check.?in|wine\s*(?:bar|tasting)?)\b/i;

function extractVenueName(activityText: string): string | null {
  // Pattern 1: "at Venue" or "@ Venue"
  const atMatch = activityText.match(/(?:\bat\b|\b@)\s+(.+)$/i);
  if (atMatch) return atMatch[1].trim();

  // Pattern 2: "Dinner - Venue Name" (dash-separated after a known activity word)
  const dashMatch = activityText.match(/^(.+?)\s*-\s*(.+)$/);
  if (dashMatch && VENUE_PREFIX_WORDS.test(dashMatch[1].trim())) {
    const venue = dashMatch[2].trim();
    // Avoid returning sub-descriptions like time qualifiers
    if (venue && !/^\d/.test(venue)) return venue;
  }

  return null;
}

/** Map vague period words to approximate 24h start times */
function vagueTimeToStart(period: string): string | null {
  switch (period.toLowerCase()) {
    case 'morning': return '08:00';
    case 'afternoon': return '14:00';
    case 'evening': return '18:00';
    case 'night': return '21:00';
    case 'day': return '10:00';
    default: return null;
  }
}

function parseUserActivities(dayActivitiesString: string, dayNumber: number): LockedCard[] {
  const lockedCards: LockedCard[] = [];

  // Normalize en-dashes and em-dashes to hyphens for consistent regex matching
  const normalized = dayActivitiesString.replace(/[–—]/g, '-');

  // Split by comma, respecting time-prefixed entries and vague period entries
  const entries = normalized.split(/,\s*(?=~?\d{1,2}(?::\d{2})?\s*(?:AM|PM)|[A-Z])/i);

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Parse time: "9:00AM Activity" or "~7:15 AM Activity" or "9AM-11:30AM Activity"
    const timeMatch = trimmed.match(/^~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*(?:-\s*~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?\s*-?\s+(.+)$/i);

    let startTime: string | null = null;
    let endTime: string | null = null;
    let activityText: string = trimmed;

    if (timeMatch) {
      startTime = normalizeTimeStr(timeMatch[1]);
      endTime = timeMatch[2] ? normalizeTimeStr(timeMatch[2]) : null;
      activityText = timeMatch[3].trim();
      // Strip leading dash from activity text if present
      activityText = activityText.replace(/^-\s*/, '');
    } else {
      // Check for vague period prefix: "Morning - Breakfast", "Night - Pool"
      const vagueMatch = trimmed.match(/^(Morning|Afternoon|Evening|Night|Day)\s*-\s*(.+)$/i);
      if (vagueMatch) {
        startTime = vagueTimeToStart(vagueMatch[1]);
        activityText = vagueMatch[2].trim();
      }
    }

    // TBD entries handled by AI, not locked
    if (/\bTBD\b|to be determined|choose|pick\b/i.test(activityText)) continue;

    const category = detectActivityCategory(activityText);
    const venueName = extractVenueName(activityText);

    lockedCards.push({
      title: activityText,
      start_time: startTime,
      end_time: endTime,
      category,
      venue_name: venueName,
      locked: true,
      lockedSource: trimmed,
      dayNumber,
    });
  }

  return lockedCards;
}

function findTimeGaps(lockedCards: LockedCard[], dayNumber: number, totalDays: number): Array<{ from: string; to: string; suggestion: string }> {
  const gaps: Array<{ from: string; to: string; suggestion: string }> = [];
  const sorted = lockedCards
    .filter(c => c.start_time)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const dayStart = dayNumber === 1 ? '10:00' : '08:00';
  const dayEnd = dayNumber === totalDays ? '18:00' : '22:00';

  let cursor = dayStart;
  for (const card of sorted) {
    const cardStart = card.start_time!;
    const cardEnd = card.end_time || _addTime(cardStart, 60);
    if (cursor < cardStart) {
      const gapMins = _timeDiffMinutes(cursor, cardStart);
      if (gapMins >= 60) {
        gaps.push({ from: cursor, to: cardStart, suggestion: `activity matching traveler DNA (${gapMins} min)` });
      }
    }
    if (cardEnd > cursor) cursor = cardEnd;
  }
  if (cursor < dayEnd) {
    const gapMins = _timeDiffMinutes(cursor, dayEnd);
    if (gapMins >= 60) {
      gaps.push({ from: cursor, to: dayEnd, suggestion: `activity matching traveler DNA (${gapMins} min)` });
    }
  }
  return gaps;
}

function _addTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function _timeDiffMinutes(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return (bh * 60 + bm) - (ah * 60 + am);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────


export async function compilePrompt(
  supabase: any,
  userId: string,
  LOVABLE_API_KEY: string,
  params: Record<string, any>,
  facts: CompiledFacts,
): Promise<CompiledPrompt> {
  const {
    tripId, dayNumber, totalDays, destination, date, travelers,
    tripType, budgetTier, preferences, previousDayActivities,
    currentActivities,
    isTransitionDay: paramIsTransitionDay,
    mustDoActivities: paramMustDoActivities,
    interestCategories: paramInterestCategories,
    generationRules: paramGenerationRules,
    pacing: paramPacing,
    isFirstTimeVisitor: paramIsFirstTimeVisitor,
    isFirstDayInCity: paramIsFirstDayInCity,
    restaurantPool: paramRestaurantPool,
    usedRestaurants: paramUsedRestaurants,
    usedVenues: paramUsedVenues,
    hotelOverride: paramHotelOverride,
  } = params;

  const {
    resolvedIsTransitionDay, resolvedTransitionFrom, resolvedTransitionTo,
    resolvedTransportMode, resolvedTransportDetails,
    resolvedNextLegTransport, resolvedNextLegCity, resolvedNextLegTransportDetails,
    resolvedHotelOverride, resolvedIsMultiCity, resolvedIsLastDayInCity,
    resolvedDestination, resolvedCountry,
    lockedActivities, lockedSlotsInstruction,
    isFirstDay, isLastDay,
    transportPreferencePrompt, resolvedTransportModes,
    arrivalAirportDisplay, airportTransferMinutes,
  } = facts;
  let flightContext = facts.flightContext;

  // ═══════════════════════════════════════════════════════════════════════
  // PREFERENCE CONTEXT
  // ═══════════════════════════════════════════════════════════════════════
  const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
  const userPrefs = userId ? await getUserPreferences(supabase, userId) : null;
  const preferenceContext = buildPreferenceContext(insights, userPrefs);

  // ═══════════════════════════════════════════════════════════════════════
  // TRIP INTENTS
  // ═══════════════════════════════════════════════════════════════════════
  let tripIntentsContext = '';
  if (tripId) {
    const { data: intents } = await supabase
      .from('trip_intents')
      .select('intent_type, intent_value')
      .eq('trip_id', tripId)
      .eq('active', true);
    if (intents && intents.length > 0) {
      const formatted = intents.map((i: any) => `${i.intent_type}: ${i.intent_value}`).join(', ');
      tripIntentsContext = `\nTrip-specific requests from user: ${formatted}`;
      console.log(`[compile-prompt] Loaded ${intents.length} trip intents`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MUST-DO PARSING & SCHEDULING
  // ═══════════════════════════════════════════════════════════════════════
  let mustDoPrompt = '';
  let mustDoEventItems: ScheduledMustDo[] = [];
  let lockedCardsForDay: LockedCard[] = [];
  let metadata: Record<string, unknown> | null = null;
  if (tripId) {
    const { data: tripMeta } = await supabase
      .from('trips')
      .select('metadata, creation_source')
      .eq('id', tripId)
      .single();
    metadata = (tripMeta?.metadata as Record<string, unknown> | null) || null;
  }

  const requestMustDoText = Array.isArray(paramMustDoActivities)
    ? paramMustDoActivities.join('\n')
    : (typeof paramMustDoActivities === 'string' ? paramMustDoActivities : '');

  const mustDoActivitiesRaw = requestMustDoText || (() => {
    const raw = metadata?.mustDoActivities;
    return Array.isArray(raw) ? raw.join('\n') : (raw as string || '');
  })();

  const interestCategories = (
    Array.isArray(paramInterestCategories) && paramInterestCategories.length > 0
      ? paramInterestCategories
      : ((metadata?.interestCategories as string[]) || [])
  );

  const genRules = (
    Array.isArray(paramGenerationRules) && paramGenerationRules.length > 0
      ? paramGenerationRules
      : ((metadata?.generationRules as any[]) || [])
  );

  const effectivePacing = typeof paramPacing === 'string'
    ? paramPacing
    : ((metadata?.pacing as string) || 'balanced');

  const effectiveIsFirstTimeVisitor = typeof paramIsFirstTimeVisitor === 'boolean'
    ? paramIsFirstTimeVisitor
    : ((metadata?.isFirstTimeVisitor as boolean) ?? true);

  const isSmartFinish = metadata?.smartFinishMode === true || (metadata?.smartFinishSource || '').toString().includes('manual_builder');
  const smartFinishRequested = !!metadata?.smartFinishRequestedAt || isSmartFinish;

  // ═══════════════════════════════════════════════════════════════════════
  // PER-DAY ACTIVITIES (structured day-level user plan) — takes priority
  // Prefer request-level (params) over metadata so chat-extracted intent
  // is honored even if metadata write was lossy.
  // ═══════════════════════════════════════════════════════════════════════
  const paramPerDayActivities = (params as any)?.perDayActivities as Array<{ dayNumber: number; activities: string }> | undefined;
  const metaPerDayActivities = metadata?.perDayActivities as Array<{ dayNumber: number; activities: string }> | undefined;
  const perDayActivities = (Array.isArray(paramPerDayActivities) && paramPerDayActivities.length > 0)
    ? paramPerDayActivities
    : metaPerDayActivities;
  const currentDayActivities = perDayActivities?.find(d => d.dayNumber === dayNumber);

  if (currentDayActivities) {
    // === LOCK PHASE: Parse user activities into locked cards ===
    lockedCardsForDay = parseUserActivities(currentDayActivities.activities, dayNumber);

    // Extract TBD entries for AI to fill
    const tdbEntries: string[] = [];
    for (const entry of currentDayActivities.activities.split(/,\s*(?=\d{1,2}(?::\d{2})?\s*(?:AM|PM)|[A-Z])/i)) {
      const t = entry.trim();
      if (/\bTBD\b|to be determined|choose|pick\b/i.test(t)) tdbEntries.push(t);
    }

    if (lockedCardsForDay.length > 0) {
      // Build a timeline showing the AI what's locked
      const timeline = lockedCardsForDay
        .filter(c => c.start_time)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        .map(c => `${c.start_time}${c.end_time ? '-' + c.end_time : ''}: [LOCKED] ${c.title}`)
        .join('\n');

      const gaps = findTimeGaps(lockedCardsForDay, dayNumber, totalDays);

      mustDoPrompt = `
## 🔒 PRE-FILLED TIMELINE FOR DAY ${dayNumber} (LOCKED — DO NOT MODIFY)

The following activities are ALREADY CONFIRMED and will be inserted automatically.
DO NOT generate activities for these time slots. DO NOT rename or modify these entries.

${timeline}

${tdbEntries.length > 0 ? `
SLOTS FOR YOU TO FILL:
${tdbEntries.map(t => `- ${t}`).join('\n')}
` : ''}

${gaps.length > 0 ? `
OPEN TIME GAPS (generate activities for these windows only):
${gaps.map(g => `- ${g.from} to ${g.to}: Generate ${g.suggestion}`).join('\n')}
` : ''}

RULES:
1. Only generate activities for the gaps and TBD slots listed above.
2. Do NOT generate activities that overlap with any [LOCKED] time slot.
3. Do NOT generate duplicates of locked activities.
4. Transit between locked activities will be calculated automatically — you do not need to generate transit cards adjacent to locked activities.
5. Match the traveler's DNA for gap-filling activities.
6. Do NOT add meals the user didn't specify. If they said "Breakfast" and "Dinner" but no lunch, there is no lunch.
7. Do NOT inject activities from other cities. Only plan for the current city: ${resolvedDestination}.
`;
      console.log(`[compile-prompt] LOCK PHASE: ${lockedCardsForDay.length} locked cards for Day ${dayNumber}, ${gaps.length} gaps, ${tdbEntries.length} TBD slots`);
    } else {
      // No parseable locked cards, fall back to original prompt style
      mustDoPrompt = `
## 🚨 USER-SPECIFIED ACTIVITIES FOR DAY ${dayNumber} (MANDATORY — DO NOT CHANGE)

The traveler has personally planned these activities for today. You MUST follow this schedule:
${currentDayActivities.activities}

RULES FOR USER-SPECIFIED ACTIVITIES:
- Use these EXACT restaurants, venues, and times. Do not substitute.
- If a restaurant name is given (e.g., "Dinner at Jnane Tamsna 7PM"), use THAT restaurant at THAT time.
- If an activity is "TBD" (e.g., "Dinner TBD"), YOU choose a real local restaurant.
- If a time block is work-related (Company Visit, Presentation, Volunteering, Orientation), create it as an ACTIVITY with the exact times. Do NOT replace it with tourist activities.
- Fill gaps between user-specified activities with appropriate activities matching the traveler's DNA.
- Do NOT add meals the user didn't specify. If they said "Breakfast" and "Dinner" but no lunch, there is no lunch.
- Hotel transfers are activities too. "4PM Transfer to Radisson Blu" = create a transit/check-in activity.
- Do NOT inject activities from other cities. Only plan for the current city: ${resolvedDestination}.
`;
    }
    console.log(`[compile-prompt] Using perDayActivities for Day ${dayNumber}: ${currentDayActivities.activities.substring(0, 100)}...`);
  } else if (mustDoActivitiesRaw.trim()) {
    const forceAllMust = !!isSmartFinish || !!smartFinishRequested;
    const mustDoAnalysis = parseMustDoInput(mustDoActivitiesRaw, destination, forceAllMust, preferences?.startDate || date?.split('T')[0], totalDays);
    if (mustDoAnalysis.length > 0) {
      const scheduled = scheduleMustDos(mustDoAnalysis, totalDays);
      const dayItems = scheduled.scheduled.filter((s: any) => s.assignedDay === dayNumber);
      mustDoEventItems = dayItems.filter((s: any) =>
        s.priority.activityType === 'all_day_event' || s.priority.activityType === 'half_day_event'
      );
      if (dayItems.length > 0) {
        const blockedTimeLines = mustDoEventItems.map((ev: any) => {
          const { blockedStart, blockedEnd } = getBlockedTimeRange(ev);
          return `⏰ "${ev.priority.title}" — BLOCKED TIME: ${blockedStart}–${blockedEnd}
  YOU MUST CREATE AN ACTIVITY ENTRY for "${ev.priority.title}" with startTime: "${blockedStart}", endTime: "${blockedEnd}".
  This MUST appear as a real activity card in the JSON output. Do NOT schedule any OTHER activities in this window.`;
        }).join('\n');
        mustDoPrompt = `\n## 🚨 USER'S MUST-DO VENUES FOR DAY ${dayNumber} (MANDATORY)\n\nThe traveler has PERSONALLY RESEARCHED these venues. You MUST include them:\n${dayItems.map((item: any) => `- ${item.priority.title} (${item.priority.priority})${item.priority.activityType === 'all_day_event' ? ' [ALL-DAY EVENT — YOU MUST generate an activity card for this event]' : item.priority.activityType === 'half_day_event' ? ' [HALF-DAY EVENT — YOU MUST generate an activity card for this event]' : ''}`).join('\n')}\n${blockedTimeLines ? '\n' + blockedTimeLines + '\n' : ''}\nRULES:\n- EVERY must-do venue listed above MUST appear as its own activity entry in the JSON output\n- For ALL-DAY events: CREATE the event as an activity card, then do NOT schedule OTHER activities during its time window\n- For HALF-DAY events: CREATE the event as an activity card, then fill the OTHER half of the day\n- Any OTHER activity overlapping a BLOCKED TIME window is a HARD FAILURE\n- Only add AI recommendations to fill remaining slots OUTSIDE blocked windows\n- CRITICAL DEDUP RULE: Do NOT generate a SEPARATE activity that is the same TYPE as a must-do. For example, if the user has "Comedy Show" as a must-do, do NOT also add your own "Stand-Up Comedy" or "Comedy Night" activity. The user's must-do IS the comedy show — you just need to create the card for it with a proper venue, not add a second one.\n- When creating the activity card for a must-do, use a PROPERLY FORMATTED title with a specific venue name (e.g., "Comedy Show at Comedy Cellar" not just the raw user text).\n`;
      } else {
        const unscheduledItems = scheduled.unschedulable || [];
        if (unscheduledItems.length > 0) {
          mustDoPrompt = `\n## User's Researched Venues (try to include if appropriate)\n${unscheduledItems.map((u: any) => `- ${u.priority.title} (${u.priority.priority})`).join('\n')}\n`;
        }
      }
      console.log(`[compile-prompt] Must-do: ${mustDoAnalysis.length} total, Day ${dayNumber}: ${dayItems.length} assigned, ${mustDoEventItems.length} events`);

      // Global must-do context
      const otherDayItems = scheduled.scheduled.filter((s: any) => s.assignedDay !== dayNumber);
      if (otherDayItems.length > 0) {
        mustDoPrompt += '\n\n📋 OTHER DAYS HAVE THESE COMMITTED ACTIVITIES (for your awareness — do NOT schedule these today):\n';
        for (const other of otherDayItems) {
          mustDoPrompt += `- Day ${other.assignedDay}: ${other.priority.title} (${other.priority.activityType})\n`;
        }
        mustDoPrompt += 'Keep today\'s schedule compatible with the overall trip plan.\n';
      }
    } else {
      mustDoPrompt = `\n## 🚨 USER'S RESEARCHED RESTAURANTS & VENUES (MANDATORY)\n\nThe traveler has researched these specific venues. Include as many as possible in the itinerary:\n"${mustDoActivitiesRaw.trim()}"\n`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTEREST CATEGORIES + GENERATION RULES + PACING
  // ═══════════════════════════════════════════════════════════════════════
  if (interestCategories.length > 0) {
    const categoryLabels: Record<string, string> = {
      history: 'History & Museums', food: 'Food & Dining', shopping: 'Shopping',
      nature: 'Parks & Nature', culture: 'Arts & Culture', nightlife: 'Nightlife',
    };
    const labels = interestCategories.map((c: string) => categoryLabels[c] || c).join(', ');
    mustDoPrompt += `\n## USER INTERESTS\nThe user is especially interested in: ${labels}. Weight recommendations toward these categories.\n`;
  }

  if (genRules.length > 0) {
    mustDoPrompt += formatGenerationRules(genRules);
  }

  mustDoPrompt += `\n## VISITOR TYPE\n${effectiveIsFirstTimeVisitor ? 'Traveler is a FIRST-TIME visitor. Prioritize iconic landmarks and essential highlights for this city.' : 'Traveler is a RETURNING visitor. Prioritize hidden gems, local favorites, and deeper neighborhood exploration over tourist staples.'}\n`;

  const pacingGuidance: Record<string, string> = {
    relaxed: 'PACING = RELAXED: Fewer activities with generous downtime and slower transitions.',
    balanced: 'PACING = BALANCED: Normal day density with a healthy mix of activities and breathing room.',
    packed: 'PACING = PACKED: Maximize meaningful activities while keeping sequencing realistic.',
  };
  mustDoPrompt += `\n## PACING\n${pacingGuidance[(effectivePacing || 'balanced').toLowerCase()] || pacingGuidance.balanced}\n`;

  // ═══════════════════════════════════════════════════════════════════════
  // MUST-HAVES + PRE-BOOKED COMMITMENTS
  // ═══════════════════════════════════════════════════════════════════════
  let mustHavesConstraintPrompt = '';
  let preBookedCommitmentsPrompt = '';
  if (tripId) {
    const metadataForConstraints = (tripId && mustDoPrompt !== undefined)
      ? (await supabase.from('trips').select('metadata').eq('id', tripId).single()).data?.metadata as Record<string, unknown> | null
      : null;

    const mustHavesList = (metadataForConstraints?.mustHaves as Array<{ label: string; notes?: string }>) || [];
    if (mustHavesList.length > 0) {
      mustHavesConstraintPrompt = buildMustHavesConstraintPrompt(mustHavesList, totalDays);
    }

    const preBookedList = (metadataForConstraints?.preBookedCommitments as PreBookedCommitment[]) || [];
    if (preBookedList.length > 0) {
      const startDate = preferences?.startDate || params.date?.split('T')[0] || '';
      const endDate = preferences?.endDate || '';
      const commitmentAnalysis = analyzePreBookedCommitments(preBookedList, startDate, endDate);
      const dayDate = params.date?.split('T')[0] || '';
      const dayAvail = commitmentAnalysis.dayBlocks.get(dayDate);
      if (dayAvail && dayAvail.blockedPeriods.length > 0) {
        preBookedCommitmentsPrompt = `\n## 📅 PRE-BOOKED COMMITMENTS FOR THIS DAY (NON-NEGOTIABLE)\n\nThe traveler has FIXED commitments today. You MUST schedule around them:\n${dayAvail.blockedPeriods.map((b: any) => `- "${b.commitment.title}" from ${b.startTime} to ${b.endTime}${b.commitment.location ? ` at ${b.commitment.location}` : ''} [${b.commitment.category}]`).join('\n')}\n\nAvailable time slots:\n${dayAvail.availableSlots.map((s: any) => `- ${s.startTime} to ${s.endTime} (${s.durationMinutes} min, ${s.period})`).join('\n')}\n\nRULES:\n- Do NOT schedule any activity during the blocked periods above\n- Include the pre-booked event AS an activity in the itinerary (category: "${dayAvail.blockedPeriods[0]?.commitment.category || 'event'}")\n- Plan activities ONLY in the available time slots\n`;
      } else if (commitmentAnalysis.promptSection) {
        preBookedCommitmentsPrompt = `\n## 📅 Pre-Booked Commitments (other days)\nThe traveler has pre-booked events on other days. No fixed events today — plan freely.\n`;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADDITIONAL NOTES / TRIP PURPOSE
  // ═══════════════════════════════════════════════════════════════════════
  // The structured Day Brief / Day Truth Ledger now carries every per-day user
  // intent (chat-planner extraction, fine-tune notes, manual paste, assistant
  // chat) as single-line bullets the AI is forbidden from rewriting. Re-injecting
  // the raw `additionalNotes` paragraph here used to encourage the model to
  // re-interpret and re-time the same wishes. We now only inject the raw blob
  // as a high-level "TRIP PURPOSE" section — the per-item enforcement lives in
  // the Day Brief, not here.
  let additionalNotesPrompt = '';
  const additionalNotes = (metadata?.additionalNotes as string) || '';
  if (additionalNotes.trim()) {
    additionalNotesPrompt = `\n## 🎯 TRAVELER'S TRIP PURPOSE
The traveler's overall trip context (do NOT use this to schedule individual items — the DAY BRIEF above is the only source of truth for per-day requests):

"${additionalNotes.trim()}"

If this describes a primary purpose (event, wedding, conference), dedicate appropriate days to it; specific items already appear in the DAY BRIEF.
`;

    if (!mustDoPrompt.trim()) {
      const detectedFromNotes = parseMustDoInput(additionalNotes, destination, false, preferences?.startDate || date?.split('T')[0], totalDays);
      const eventItems = detectedFromNotes.filter((p: any) => p.activityType === 'all_day_event' || p.activityType === 'half_day_event');
      if (eventItems.length > 0) {
        const scheduled = scheduleMustDos(eventItems, totalDays);
        const dayItems = scheduled.scheduled.filter((s: any) => s.assignedDay === dayNumber);
        if (dayItems.length > 0) {
          mustDoPrompt = `\n## 🚨 EVENT DETECTED FROM TRIP PURPOSE (MANDATORY)\n\nThe traveler's trip purpose includes a specific event. You MUST plan this day around it:\n${dayItems.map((item: any) => `- ${item.priority.title} (${item.priority.priority})${item.priority.activityType === 'all_day_event' ? ' [ALL-DAY EVENT — plan the ENTIRE day around this]' : ' [HALF-DAY EVENT]'}`).join('\n')}\n\nRULES:\n- This event is the PRIMARY purpose of the trip\n- Plan the entire day around this event\n- Supporting activities (meals, transport) should complement the event\n`;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPILED SCHEMA: Day mode classification & constraints
  // ═══════════════════════════════════════════════════════════════════════
  const schema = compileDaySchema({
    isFirstDay, isLastDay, dayNumber: dayNumber || 1, totalDays: totalDays || 1,
    destination: resolvedDestination || destination || '',
    flightContext,
    resolvedIsLastDayInCity, resolvedIsMultiCity,
    resolvedNextLegTransport, resolvedNextLegCity, resolvedNextLegTransportDetails,
    resolvedHotelOverride, resolvedIsTransitionDay,
    paramIsFirstDayInCity: !!paramIsFirstDayInCity,
    paramIsTransitionDay: !!paramIsTransitionDay,
    mustDoEventItems,
    arrivalAirportDisplay, airportTransferMinutes,
  });
  flightContext = schema.flightContext;
  const dayConstraints = schema.dayConstraints;

  // ═══════════════════════════════════════════════════════════════════════
  // TIMING INSTRUCTIONS + MEAL POLICY
  // ═══════════════════════════════════════════════════════════════════════
  let timingInstructions = '';
  let dayMealPolicy: MealPolicy | null = null;
  if (isFirstDay && dayConstraints) {
    dayMealPolicy = deriveMealPolicy({
      dayNumber, totalDays, isFirstDay: true, isLastDay: dayNumber === totalDays,
      arrivalTime24: flightContext.arrivalTime24 || undefined,
      earliestAvailable: flightContext.earliestFirstActivityTime || undefined,
    });
    console.log(`[compile-prompt] Day ${dayNumber} (arrival) meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}]`);
    timingInstructions = `
CRITICAL ARRIVAL DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

${buildMealRequirementsPrompt(dayMealPolicy)}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
  } else if (isLastDay && dayConstraints) {
    dayMealPolicy = deriveMealPolicy({
      dayNumber, totalDays, isFirstDay: false, isLastDay: true,
      departureTime24: flightContext.returnDepartureTime24 || flightContext.returnDepartureTime || undefined,
      latestAvailable: flightContext.latestLastActivityTime || undefined,
    });
    console.log(`[compile-prompt] Day ${dayNumber} (departure) meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}]`);
    timingInstructions = `
CRITICAL DEPARTURE DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

${buildMealRequirementsPrompt(dayMealPolicy)}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
  } else {
    const hotelNameForDay = flightContext.hotelName || '';
    const hotelNeighborhood = flightContext.hotelAddress || '';

    // On hotel-change days, breakfast should reference the PREVIOUS hotel
    // (the traveler hasn't checked out yet in the morning)
    const breakfastHotelName = (facts.resolvedIsHotelChange && facts.resolvedPreviousHotelName)
      ? facts.resolvedPreviousHotelName
      : flightContext.hotelName;

    const dayMealInput: MealPolicyInput = {
      dayNumber,
      totalDays,
      isFirstDay: false,
      isLastDay: false,
      isTransitionDay: resolvedIsTransitionDay,
      hasFullDayEvent: !!((metadata?.userConstraints as any[]) || []).find(
        (c: any) => c.type === 'full_day_event' && (c.day === dayNumber || !c.day)
      ),
      earliestAvailable: undefined,
      latestAvailable: undefined,
      lockedHours: (() => {
        const constraints = (metadata?.userConstraints as any[]) || [];
        let locked = 0;
        for (const c of constraints as any[]) {
          if (c.type === 'time_block' && c.day === dayNumber && c.time) locked += 2;
          if (c.type === 'full_day_event' && (c.day === dayNumber || !c.day)) locked += 12;
        }
        return locked;
      })(),
    };
    dayMealPolicy = deriveMealPolicy(dayMealInput);
    const mealRequirementsBlock = buildMealRequirementsPrompt(dayMealPolicy);
    console.log(`[compile-prompt] Day ${dayNumber} meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}], usableHours=${dayMealPolicy.usableHours}`);

    timingInstructions = `
${dayMealPolicy.isFullExplorationDay ? 'FULL EXPLORATION DAY' : dayMealPolicy.dayMode.replace(/_/g, ' ').toUpperCase()} — HOUR-BY-HOUR TRAVEL PLAN (NOT a suggestion list):

This day must be a COMPLETE itinerary from morning to night. Every hour accounted for.

REQUIRED DAY STRUCTURE:
${dayMealPolicy.requiredMeals.includes('breakfast') ? (breakfastHotelName ? ((isFirstDay || isLastDay) ? `1. BREAKFAST (category: "dining") — At the hotel's own restaurant (preferred) or a real café nearby. NEVER at a DIFFERENT hotel's restaurant. Use the hotel name: ${breakfastHotelName}. ~price, walking distance${facts.resolvedIsHotelChange && facts.resolvedPreviousHotelName ? `\n   ⚠️ HOTEL CHANGE DAY: You are still at ${facts.resolvedPreviousHotelName} in the morning. Breakfast MUST be at ${facts.resolvedPreviousHotelName} or nearby — NOT at ${flightContext.hotelName}, which you haven't checked into yet. The correct sequence is: Breakfast at ${facts.resolvedPreviousHotelName} → Checkout → Travel → Check-in at ${flightContext.hotelName}.\n   🚫 GEOGRAPHIC CONSTRAINT: ALL morning activities (breakfast, coffee, any stops BEFORE checkout) must be located near ${facts.resolvedPreviousHotelName}${facts.resolvedPreviousHotelAddress ? ` (${facts.resolvedPreviousHotelAddress})` : ''}. Do NOT place any morning activity at or near ${flightContext.hotelName}. The traveler physically cannot be at the new hotel until after checkout and transfer.` : ''}` : `1. BREAKFAST (category: "dining") — At a well-reviewed local café, bakery, or brasserie near your hotel. Do NOT use the hotel restaurant — choose a DIFFERENT breakfast venue each day. Every city has hundreds of excellent breakfast spots. NEVER repeat a breakfast restaurant from a previous day. ~price, walking distance`) : '1. BREAKFAST (category: "dining") — At a well-reviewed local café or bakery. Do NOT reference any hotel. ~price, walking distance') : ''}
2. TRANSIT between every pair of consecutive activities (category: "transport")
   - Include mode (${resolvedTransportModes.length > 0 ? resolvedTransportModes.join('/') : 'walk/taxi/metro/bus'}), duration, cost, route details
   - 10+ minute walks or any paid transit = separate activity entry
3. MORNING ACTIVITIES (MANDATORY 9:00 AM - 12:30 PM) — You MUST schedule at least 2 activities between breakfast and lunch. This is the MOST IMPORTANT part of the day. Examples: museum visit, landmark tour, market walk, neighborhood exploration, gallery, viewpoint, garden, historic site. A day with NO morning activities is a FAILED itinerary.
${dayMealPolicy.requiredMeals.includes('lunch') ? '4. LUNCH (category: "dining") — Restaurant near previous location, ~price, 1 alternative in tips' : ''}
5. AFTERNOON ACTIVITIES (MANDATORY 2:00 PM - 5:00 PM) — You MUST schedule at least 1-2 activities between lunch and the hotel return. Examples: museum, shopping street, park, boat ride, neighborhood walk, cultural site.  
${flightContext.hotelName ? `6. HOTEL RETURN (REQUIRED) — "Freshen up at [EXACT Hotel Name]" with category "accommodation", duration 30 min. Every full day MUST include a hotel return between afternoon activities and dinner. This MUST be a separate activity card with dedicated time, not just a transport entry. Include a preceding transport card to get back to the hotel.` : ''}
${dayMealPolicy.requiredMeals.includes('dinner') ? '7. DINNER (category: "dining") — Restaurant, price range, dress code, reservation needed?, 1 alternative in tips' : ''}
8. EVENING/NIGHTLIFE — Bar, jazz club, night market, show, rooftop, dessert spot (at least 1 suggestion). Use category: "dining" for bars, lounges, and cocktail venues. Use category: "activity" for shows, clubs, and entertainment. NEVER use "wellness", "nightlife", or "relaxation" as a category for bars/lounges.
${flightContext.hotelName ? `9. RETURN TO HOTEL (REQUIRED as LAST activity) — "Return to [EXACT Hotel Name]" with category "accommodation". This is the FINAL card of every day. MUST appear after ALL other activities including nightlife. Include transport mode in a preceding transport activity.` : ''}
10. NEXT MORNING PREVIEW — In the tips of the LAST activity: "Tomorrow: Wake [time]. Breakfast at [place] ([distance], ~[price])."

${mealRequirementsBlock}

TRANSIT RULES:
- Between EVERY pair of consecutive stops, include transit info
${resolvedTransportModes.length > 0 ? `- USER'S PREFERRED MODES: ${resolvedTransportModes.join(', ')} — use ONLY these modes` : '- For walks >10 min: create a separate transport activity entry'}
- For walks <5 min: note in the tips of the preceding activity
- Always include: mode, duration, cost (free for walking), and route/line for public transit

ACTIVITY MIX — NON-NEGOTIABLE MINIMUMS:
- A full day MUST have at least 5 non-dining, non-transport activities total
- At least 2 PAID activities (museums, tours, attractions with ticket prices)
- At least 2 FREE activities (parks, viewpoints, walks, markets, street art)
- At least 1 evening activity after dinner (bar, show, jazz, night walk)
- Place free activities between paid ones to prevent fatigue
- Include at least 1 coffee/snack opportunity between long gaps
- SELF-CHECK: Count your non-dining activities. If there are fewer than 4, you have NOT met the minimum. Add more before responding.

EVENING REQUIREMENT:
- The day does NOT end at dinner. Include at least 1 post-dinner suggestion:
  Jazz, rooftop bar, night market, show, river cruise, neighborhood walk, live music, dessert
- Mark as optional in description if appropriate

PRICES ON EVERYTHING:
- Every meal: approximate price per person
- Every attraction: entry/ticket fee
- Every transit: fare (walking = free)
- estimatedCost.amount = 0 for genuinely free activities
- Approximate is acceptable. MISSING is not.

PRACTICAL TIPS (in "tips" field of each activity):
- Booking requirements, queue advice, dress codes, closure days
- "Book online to skip the line" / "Closed Mondays" / "Best photos at sunset"

RESTAURANT UNIQUENESS — ABSOLUTE REQUIREMENT:
- EVERY restaurant across the ENTIRE trip must be UNIQUE. No restaurant name may appear on more than one day.
- This includes breakfast, lunch, dinner, cocktails, and nightcaps.
- You are given a list of already-used restaurants. You MUST NOT use ANY restaurant from that list.
- Even if an already-used restaurant seems like a perfect fit, choose a DIFFERENT one instead.
- For breakfast: every city has dozens of breakfast spots. NEVER repeat a breakfast venue.
- CHECK your output: if any restaurant name matches one in the used list, REPLACE it before responding.
${hotelNameForDay ? `\nHOTEL: ${hotelNameForDay}${hotelNeighborhood ? ` (${hotelNeighborhood})` : ''}\nStart and end the day near the hotel when practical.${facts.resolvedIsHotelChange && facts.resolvedPreviousHotelName ? `\n\n${'='.repeat(70)}\n🏨 HOTEL CHANGE DAY — MANDATORY SEQUENCE\n${'='.repeat(70)}\nToday the traveler switches from "${facts.resolvedPreviousHotelName}" to "${hotelNameForDay}".\nThe REQUIRED chronological order is:\n  1. Wake up at ${facts.resolvedPreviousHotelName}\n  2. Breakfast at/near ${facts.resolvedPreviousHotelName}${facts.resolvedPreviousHotelAddress ? ` (${facts.resolvedPreviousHotelAddress})` : ''}\n  3. Checkout from ${facts.resolvedPreviousHotelName} (category: "accommodation")\n  4. Transport/transfer to ${hotelNameForDay}\n  5. Check-in at ${hotelNameForDay} (category: "accommodation")\n  6. Afternoon/evening activities near ${hotelNameForDay}\n  7. Return to ${hotelNameForDay}\n\n🚫 NOTHING at or near ${hotelNameForDay} may appear BEFORE the check-in activity.\n   Morning activities MUST be geographically near ${facts.resolvedPreviousHotelName}.\n   The new hotel (${hotelNameForDay}) is only the "active" hotel AFTER check-in.\n${'='.repeat(70)}` : ''}` : '\n⚠️ NO HOTEL BOOKED: Do NOT reference any hotel in the itinerary. No hotel check-in, check-out, return to hotel, breakfast at hotel, or taxi to hotel. All meals should be at local restaurants or cafés.'}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSITION DAY OVERRIDE
  // ═══════════════════════════════════════════════════════════════════════
  if (resolvedIsTransitionDay && resolvedTransitionFrom && resolvedTransitionTo) {
    console.log(`[compile-prompt] 🚆 TRANSITION DAY: ${resolvedTransitionFrom} → ${resolvedTransitionTo} via ${resolvedTransportMode}`);
    const transitionDayPromptBlock = buildTransitionDayPrompt({
      transitionFrom: resolvedTransitionFrom,
      transitionFromCountry: resolvedCountry,
      transitionTo: resolvedTransitionTo,
      transitionToCountry: resolvedCountry,
      transportType: resolvedTransportMode || 'train',
      travelers: travelers || 1,
      budgetTier: budgetTier || 'moderate',
      currency: 'USD',
      transportDetails: resolvedTransportDetails || undefined,
    });
    timingInstructions = `
CRITICAL TRANSITION DAY INSTRUCTIONS — THIS IS A TRAVEL DAY, NOT AN EXPLORATION DAY:
${transitionDayPromptBlock}

FAILURE TO INCLUDE INTER-CITY TRAVEL IS UNACCEPTABLE. NO TELEPORTING.`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UNIFIED PROFILE LOADER
  // ═══════════════════════════════════════════════════════════════════════
  const profile = await loadTravelerProfile(supabase, userId, tripId, destination);
  const primaryArchetype = profile.archetype;
  const traitScores = profile.traitScores;
  console.log(`[compile-prompt] Profile: archetype=${primaryArchetype} (${profile.archetypeSource}), completeness=${profile.dataCompleteness}%`);
  if (profile.warnings.length > 0) {
    console.warn(`[compile-prompt] Profile warnings: ${profile.warnings.join(', ')}`);
  }

  const effectiveBudgetTier = profile.budgetTier || budgetTier || 'moderate';

  // ═══════════════════════════════════════════════════════════════════════
  // GENERATION CONTEXT (enrichment prompts from generate-trip)
  // ═══════════════════════════════════════════════════════════════════════
  let generationContextPrompts = '';
  let blendedTraitScores: Record<string, number> | null = null;
  let blendedDnaSnapshot: { travelers: Array<{ archetype: string }> } | null = null;
  let gcTravelerCount = 0;

  if (tripId) {
    try {
      const { data: gcTrip } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
      const gc = ((gcTrip?.metadata as Record<string, unknown>)?.generation_context as Record<string, unknown>) || {};

      const promptParts: string[] = [];
      if (gc.dietaryEnforcementPrompt) promptParts.push(gc.dietaryEnforcementPrompt as string);
      if (gc.jetLagPrompt && dayNumber <= 2) promptParts.push(gc.jetLagPrompt as string);
      if (gc.weatherBackupPrompt) promptParts.push(gc.weatherBackupPrompt as string);
      if (gc.tripDurationPrompt) promptParts.push(gc.tripDurationPrompt as string);
      if (gc.childrenAgesPrompt) promptParts.push(gc.childrenAgesPrompt as string);
      if (gc.reservationUrgencyPrompt) promptParts.push(gc.reservationUrgencyPrompt as string);
      if (gc.dailyEstimatesPrompt) promptParts.push(gc.dailyEstimatesPrompt as string);
      if (gc.groupBlendingPrompt) promptParts.push(gc.groupBlendingPrompt as string);
      if (gc.forcedSlotsPrompt) promptParts.push(gc.forcedSlotsPrompt as string);
      if (gc.scheduleConstraintsPrompt) promptParts.push(gc.scheduleConstraintsPrompt as string);
      if (gc.pastTripLearnings) promptParts.push(gc.pastTripLearnings as string);

      if (gc.recentlyUsedActivities) {
        const recentNames = gc.recentlyUsedActivities as string[];
        if (recentNames.length > 0) {
          promptParts.push(`\n## ⚠️ RECENTLY USED (avoid for variety):\nAvoid these activities/restaurants used in recent ${resolvedDestination} itineraries:\n- ${recentNames.join('\n- ')}\n`);
        }
      }

      if (gc.blendedTraitScores && typeof gc.blendedTraitScores === 'object') {
        blendedTraitScores = gc.blendedTraitScores as Record<string, number>;
        console.log(`[compile-prompt] ✓ BLENDED traits: pace=${blendedTraitScores.pace}, budget=${blendedTraitScores.budget}`);
      }

      if (gc.blendedDnaSnapshot && typeof gc.blendedDnaSnapshot === 'object') {
        blendedDnaSnapshot = gc.blendedDnaSnapshot as any;
        gcTravelerCount = (blendedDnaSnapshot?.travelers || []).length;
      }

      if (promptParts.length > 0) {
        generationContextPrompts = promptParts.join('\n\n');
        console.log(`[compile-prompt] Injected ${promptParts.length} enrichment prompts from generation_context`);
      }
    } catch (gcErr) {
      console.warn('[compile-prompt] Failed to read generation_context (non-blocking):', gcErr);
    }

    // Stale context detection
    if (gcTravelerCount > 0) {
      try {
        const [{ count: collabCount }, { count: memberCount }] = await Promise.all([
          supabase.from('trip_collaborators').select('*', { count: 'exact', head: true }).eq('trip_id', tripId).eq('include_preferences', true),
          supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', tripId),
        ]);
        const currentTravelerCount = 1 + (collabCount || 0) + (memberCount || 0);
        if (Math.abs(currentTravelerCount - gcTravelerCount) >= 1) {
          console.warn(`[compile-prompt] ⚠️ STALE CONTEXT: gc has ${gcTravelerCount} travelers, current ~${currentTravelerCount}`);
        }
      } catch (staleErr) {
        console.warn('[compile-prompt] Stale context check failed (non-blocking):', staleErr);
      }
    }
  }

  const effectiveTraitScores = blendedTraitScores
    ? { pace: blendedTraitScores.pace ?? traitScores.pace, budget: blendedTraitScores.budget ?? traitScores.budget }
    : { pace: traitScores.pace, budget: traitScores.budget };

  // ═══════════════════════════════════════════════════════════════════════
  // BUDGET RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════
  let actualDailyBudgetPerPerson: number | null = null;
  // Per-day per-person targets surfaced into the prompt so the model actually
  // distributes spend across food / activities / transit per the user's preset.
  let allocationPromptBlock = '';
  if (tripId) {
    try {
      const { data: tripBudgetData } = await supabase
        .from('trips')
        .select('budget_total_cents, flight_selection, hotel_selection, budget_allocations, budget_currency')
        .eq('id', tripId)
        .single();
      if (tripBudgetData?.budget_total_cents && tripBudgetData.budget_total_cents > 0) {
        const trav = travelers || 1;
        const days = totalDays || 1;
        const flightCents = tripBudgetData.flight_selection?.legs
          ? (tripBudgetData.flight_selection.legs as any[]).reduce((sum: number, leg: any) => sum + (leg.price || 0), 0) * 100
          : tripBudgetData.flight_selection?.outbound?.price ? Math.round((tripBudgetData.flight_selection.outbound.price + (tripBudgetData.flight_selection.return?.price || 0)) * 100) : 0;
        const hotelCents = tripBudgetData.hotel_selection?.pricePerNight ? Math.round(tripBudgetData.hotel_selection.pricePerNight * days * 100) : 0;
        const activityBudgetCents = Math.max(0, tripBudgetData.budget_total_cents - flightCents - hotelCents);
        actualDailyBudgetPerPerson = Math.round(activityBudgetCents / days / trav) / 100;
        console.log(`[compile-prompt] Budget: $${tripBudgetData.budget_total_cents / 100} total → $${actualDailyBudgetPerPerson}/day/person`);

        // Per-city override
        if (resolvedDestination && tripId) {
          try {
            const { data: cityRow } = await supabase
              .from('trip_cities')
              .select('allocated_budget_cents, hotel_cost_cents, nights, days_total')
              .eq('trip_id', tripId)
              .eq('city_name', resolvedDestination)
              .maybeSingle();
            if (cityRow?.allocated_budget_cents && cityRow.allocated_budget_cents > 0) {
              const cityNights = cityRow.nights || cityRow.days_total || 1;
              const cityHotelCents = cityRow.hotel_cost_cents || 0;
              const cityActivityCents = Math.max(0, cityRow.allocated_budget_cents - cityHotelCents);
              actualDailyBudgetPerPerson = Math.round(cityActivityCents / cityNights / trav) / 100;
              console.log(`[compile-prompt] Per-city budget override for "${resolvedDestination}": $${actualDailyBudgetPerPerson}/day/person`);
            }
          } catch (e) {
            console.warn('[compile-prompt] Per-city budget fetch failed:', e);
          }
        }

        // ── Spend allocation block — turn the user's preset into per-day targets ──
        try {
          const alloc = tripBudgetData.budget_allocations as any;
          if (alloc && typeof alloc.activities_percent === 'number' && actualDailyBudgetPerPerson != null) {
            const dailyTotalPP = actualDailyBudgetPerPerson;
            const foodPP = Math.round(dailyTotalPP * (alloc.food_percent || 0) / 100);
            const actsPP = Math.round(dailyTotalPP * (alloc.activities_percent || 0) / 100);
            const transitPP = Math.round(dailyTotalPP * (alloc.transit_percent || 0) / 100);
            const cur = tripBudgetData.budget_currency || 'USD';
            const isSplurge = (alloc.activities_percent || 0) >= 33 && (alloc.buffer_percent ?? 30) <= 20;
            const isValue = (alloc.buffer_percent || 0) >= 28;
            const styleGuidance = isSplurge
              ? `SPLURGE-FORWARD: Schedule ≥1 paid signature experience per day in the $${Math.max(40, Math.round(actsPP * 0.6))}–$${Math.max(120, Math.round(actsPP * 1.4))}/pp range — museum/exhibit tickets, guided tours, wine or food tastings, river/harbor cruises, cooking classes, premium attractions. Do NOT pad the day with only free landmarks; the user is paying for experiences, not just dinners.`
              : isValue
                ? `VALUE-FOCUSED: Lean on free landmarks, walking routes, markets. Limit paid activities to 1/day and keep them under $${actsPP}/pp.`
                : `BALANCED: At least 1 paid ticketed experience most days, mixed with free landmarks. Stay near $${actsPP}/pp on activities.`;
            allocationPromptBlock = `
SPEND ALLOCATION TARGETS (per person, per day, in ${cur}, derived from the user's "${isSplurge ? 'Splurge-Forward' : isValue ? 'Value-Focused' : 'Balanced'}" preset):
- Food: ~$${foodPP}
- Paid activities/experiences: ~$${actsPP}
- Local transit: ~$${transitPP}
${styleGuidance}
The Activities target is REAL spend on bookable experiences — free venues do NOT count toward it.`;
          }
        } catch (e) {
          console.warn('[compile-prompt] Allocation block failed:', e);
        }
      }
    } catch (e) {
      console.warn('[compile-prompt] Budget fetch failed:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ARCHETYPE GUIDANCE
  // ═══════════════════════════════════════════════════════════════════════
  const destinationId = await getDestinationId(supabase, resolvedDestination);
  const generationHierarchy = await buildFullPromptGuidanceAsync(
    supabase, primaryArchetype, resolvedDestination, destinationId,
    effectiveBudgetTier, effectiveTraitScores, LOVABLE_API_KEY
  );
  console.log(`[compile-prompt] Full guidance: ${generationHierarchy.length} chars`);

  let celebrationDay: number | undefined;
  if (tripId) {
    const { data: tripMeta } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
    celebrationDay = tripMeta?.metadata?.celebrationDay;
  }

  const tripTypePrompt = buildTripTypePromptSection(tripType, primaryArchetype, totalDays, celebrationDay);

  // Group avoid-list intersection
  let groupAvoidOverride: string[] | null = null;
  if (blendedDnaSnapshot && blendedDnaSnapshot.travelers.length > 1) {
    try {
      const allAvoidLists = blendedDnaSnapshot.travelers.map((t: any) => {
        const def = getArchetypeDefinition(t.archetype);
        return new Set(def.avoid.map((a: string) => a.toLowerCase()));
      });
      groupAvoidOverride = [...allAvoidLists[0]].filter((item: string) =>
        allAvoidLists.every((avoidSet: Set<string>) => avoidSet.has(item))
      );
    } catch (avoidErr) {
      console.warn('[compile-prompt] Group avoid-list intersection failed:', avoidErr);
    }
  }

  const archetypeContext = getFullArchetypeContext(primaryArchetype, resolvedDestination, effectiveBudgetTier, effectiveTraitScores);
  const archetypeTier = archetypeContext.definition.category || 'Explorer';
  const diningConfig = getDiningConfig(archetypeTier, archetypeContext.definition.identity || primaryArchetype);
  console.log(`[compile-prompt] Dining DNA: tier=${archetypeTier}, policy=${diningConfig.michelinPolicy}, style=${diningConfig.diningStyle.substring(0, 60)}...`);

  // Day 1 "Grand Entrance" dinner directive — only for luxury food audiences.
  if (isFirstDay) {
    const grandEntrance = buildGrandEntranceBlock(diningConfig, resolvedDestination || destination || '');
    if (grandEntrance) {
      timingInstructions = `${timingInstructions}\n${grandEntrance}\n`;
      console.log(`[compile-prompt] Day 1 Grand Entrance directive injected (tier=${archetypeTier}, policy=${diningConfig.michelinPolicy})`);
    }
  }
  const maxActivitiesFromArchetype = archetypeContext.definition.dayStructure.maxScheduledActivities;
  const minActivitiesFromArchetype = archetypeContext.definition.dayStructure.minScheduledActivities
    || Math.max(3, Math.ceil(maxActivitiesFromArchetype * 0.6));

  // ═══════════════════════════════════════════════════════════════════════
  // VOYANCE PICKS
  // ═══════════════════════════════════════════════════════════════════════
  let voyancePicksPrompt = '';
  try {
    const destCity = resolvedDestination.split(',')[0].trim();
    const { data: vpRows } = await supabase
      .from('voyance_picks')
      .select('*')
      .eq('is_active', true)
      .ilike('destination', `%${destCity}%`);
    if (vpRows && vpRows.length > 0) {
      const pickLines = vpRows.map((p: any, i: number) =>
        `${i + 1}. **${p.name}** (${p.category}) in ${p.neighborhood || destination} — ${p.why_essential}${p.insider_tip ? ` TIP: ${p.insider_tip}` : ''}${p.best_time ? ` BEST TIME: ${p.best_time}` : ''}`
      ).join('\n');
      voyancePicksPrompt = `\n${'='.repeat(70)}\n⭐ VOYANCE PICKS — MUST INCLUDE (HIGHEST PRIORITY)\n${'='.repeat(70)}\n${pickLines}\n- These MUST appear in the itinerary. Mark as isHiddenGem: true AND isVoyancePick: true.\n`;
      console.log(`[compile-prompt] Injecting ${vpRows.length} Voyance Picks`);
    }
  } catch (e) {
    console.warn('[compile-prompt] Voyance Picks fetch failed:', e);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COLLABORATOR ATTRIBUTION
  // ═══════════════════════════════════════════════════════════════════════
  let collaboratorAttributionPrompt = '';
  let allUserIdsForAttribution: string[] = [];
  if (tripId) {
    const [{ data: collabRows }, { data: memberRows }] = await Promise.all([
      supabase.from('trip_collaborators').select('user_id').eq('trip_id', tripId).eq('include_preferences', true),
      supabase.from('trip_members').select('user_id').eq('trip_id', tripId).not('user_id', 'is', null),
    ]);

    const participantIds = new Set<string>();
    (collabRows || []).forEach((c: any) => { if (c.user_id) participantIds.add(c.user_id); });
    (memberRows || []).forEach((m: any) => { if (m.user_id) participantIds.add(m.user_id); });
    participantIds.delete(userId);

    if (participantIds.size > 0) {
      const allUserIds = [userId, ...Array.from(participantIds)].filter(Boolean);
      allUserIdsForAttribution = allUserIds;
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, display_name, handle')
        .in('id', allUserIds);

      const profileMap = new Map((profileRows || []).map((p: any) => [p.id, p.display_name || p.handle || 'Guest']));
      const travelerList = allUserIds.map((uid: string) => `  - "${uid}" (${profileMap.get(uid!) || 'Traveler'})`).join('\n');

      collaboratorAttributionPrompt = `
${'='.repeat(70)}
🎯 GROUP TRIP ATTRIBUTION — suggestedFor REQUIRED
${'='.repeat(70)}
This is a GROUP TRIP. Some activities need a "suggestedFor" field to show which traveler's DNA inspired the choice.

Travelers in this group:
${travelerList}

All traveler IDs combined: "${allUserIdsForAttribution.join(',')}"

Rules:
- LOGISTICAL activities (hotel check-in/check-out, airport arrival/departure, transfers, transit, packing, travel days) → DO NOT include suggestedFor. These are not DNA-driven.
- USER-REQUESTED must-do activities (things the user explicitly asked for, e.g. specific events or restaurants they named) → set suggestedFor to ALL traveler IDs comma-separated: "${allUserIdsForAttribution.join(',')}" — these were requested by the group, not inspired by any individual's DNA.
- AI-CHOSEN activities (restaurants, bars, experiences YOU picked based on personality traits) → set suggestedFor to the SINGLE traveler whose DNA most influenced the pick. Only use comma-separated IDs if the activity genuinely matches multiple travelers' unique traits.
- Use the primary planner's ID ("${userId}") ONLY when it specifically matches their profile, NOT as a default
`;
      console.log(`[compile-prompt] Attribution prompt for ${allUserIds.length} travelers`);
    }
  }

  // Group avoid-list relaxation prompt
  let groupAvoidPrompt = '';
  if (groupAvoidOverride && blendedDnaSnapshot && blendedDnaSnapshot.travelers.length > 1) {
    const ownerDef = getArchetypeDefinition(primaryArchetype);
    const ownerAvoidSet = new Set(ownerDef.avoid.map((a: string) => a.toLowerCase()));
    const relaxedItems = [...ownerAvoidSet].filter((item: string) => !groupAvoidOverride!.includes(item));
    if (relaxedItems.length > 0) {
      groupAvoidPrompt = `
${'='.repeat(70)}
🤝 GROUP TRIP AVOID-LIST RELAXATION
${'='.repeat(70)}
This is a GROUP trip. The owner's archetype normally avoids: ${ownerDef.avoid.join(', ')}.
However, since companions have different preferences, ONLY avoid items that ALL travelers' archetypes agree on:
${groupAvoidOverride.length > 0 ? `• Still avoid: ${groupAvoidOverride.join(', ')}` : '• No universal avoids — all activity types are fair game for this group.'}
• NOW ALLOWED (relaxed for group): ${relaxedItems.join(', ')}
Include some of the relaxed activities to satisfy companions' preferences.
`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SYSTEM PROMPT ASSEMBLY
  // ═══════════════════════════════════════════════════════════════════════
  const systemPrompt = `You are an expert travel planner creating a COMPLETE hour-by-hour travel plan — not a suggestion list.

${(() => {
  const arrT = (flightContext as any)?.arrivalTime24;
  const depT = (flightContext as any)?.returnDepartureTime24;
  if (!arrT && !depT) return '';
  let block = 'ARRIVAL/DEPARTURE TIMING (TOP PRIORITY — NEVER VIOLATE):\n';
  if (arrT && isFirstDay) {
    const arrMins = parseInt(arrT.split(':')[0], 10) * 60 + parseInt(arrT.split(':')[1] || '0', 10);
    const earliest = arrMins + 120;
    const eh = Math.floor(earliest / 60);
    const em = earliest % 60;
    block += `- This is DAY 1 (ARRIVAL DAY). Flight lands at ${arrT}. NEVER generate ANY non-transport activity before ${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')} (arrival + 2h for customs/baggage/travel).\n`;
    block += `- If arrival is after 18:00, only plan dinner and one evening activity.\n`;
  }
  if (depT && isLastDay) {
    const depMins = parseInt(depT.split(':')[0], 10) * 60 + parseInt(depT.split(':')[1] || '0', 10);
    const latest = depMins - 180;
    const lh = Math.floor(latest / 60);
    const lm = latest % 60;
    block += `- This is the LAST DAY (DEPARTURE DAY). Flight departs at ${depT}. NEVER generate activities after ${String(lh).padStart(2,'0')}:${String(lm).padStart(2,'0')} (departure - 3h for airport travel + security).\n`;
    if (depMins < 810) block += `- Departure before 13:30 — do NOT generate lunch.\n`;
  }
  return block + '\n';
})()}
ABSOLUTE RULE — REAL RESTAURANTS ONLY (TOP PRIORITY):
Every DINING activity MUST have:
1. A SPECIFIC, REAL restaurant name (not "a bistro", "a brasserie", "a café", "a boulangerie-café", "a neighborhood café")
2. A REAL street address (not the city name, not "the destination")
3. A realistic price based on the actual restaurant's menu
BANNED PATTERNS — if you generate any of these, the entire day will be rejected and regenerated:
- Title containing "at a bistro" or "at a brasserie" or "at a café" or "at a boulangerie" or "at a neighborhood"
- Venue name that is just a city name ("Paris", "Rome", "Berlin", "London")
- Venue name "the destination"
- Description containing "Get a restaurant recommendation"
- Any dining activity without a specific street address

${generationHierarchy}

${groupAvoidPrompt}

${tripTypePrompt}

${transportPreferencePrompt}

${timingInstructions}
${lockedSlotsInstruction}
${generationContextPrompts}

CORE PRINCIPLE: A Voyance itinerary plans the traveler's ENTIRE day, hour by hour, from waking up to going to sleep. It handles logistics, meals, transit, and the little decisions that stress people out when traveling.

General Requirements:
- Include FULL street addresses for all locations
- Provide realistic cost estimates in local currency — prices on EVERYTHING (meals, tickets, transit)
- PRICE CONTEXT IS MANDATORY: Every estimatedCost MUST include a "basis" field indicating what the price covers:
  • Attraction tickets: basis = "per_person" (tickets are individually priced). amount = price for ONE person.
  • Restaurant meals (à la carte): basis = "per_person" (average spend per diner). amount = per-person estimate.
  • Restaurant meals (set/tasting menu): basis = "per_person". amount = the set menu price per head.
  • Taxi/rideshare fares: basis = "flat" (shared ride). amount = total fare for the vehicle.
  • Public transit: basis = "per_person" (individual fare). amount = single fare.
  • Private tours: basis = "flat" (flat rate for the group). amount = total tour price.
  • Group tours: basis = "per_person". amount = per-person ticket.
  • Hotel/accommodation: basis = "per_room" (per room per night). amount = nightly rate.
  • Free activities: basis = "flat", amount = 0.
  This ensures the UI can calculate accurate group totals: per_person costs × travelers, flat costs as-is.
- Account for REALISTIC travel time between activities — if two places are in different neighborhoods, leave 30-60 min gap (not 15 min). Only use 15 min gaps for locations within walking distance. Travel time and rest/settling buffers are SEPARATE — add both.
TRANSIT TIME ESTIMATION GUIDE (use these as minimums, not maximums):
- Same building/venue: 3-5 min
- Same block/street (under 200m): 5-7 min
- Same neighborhood (200m-800m): 8-15 min walk
- Adjacent neighborhoods (800m-2km): 15-25 min (suggest metro/transit)
- Cross-city (2km+): 20-40 min (metro/taxi required)
- To/from airport: 45-90 min depending on city
NEVER output "5 min walk" between locations in different neighborhoods or arrondissements. If unsure of the distance, estimate 15 min as a safe default for same-city travel.
- NEVER schedule zero-gap transitions. Every activity needs settling/buffer time ON TOP of travel: +5 min after walking, +10 min for taxi pickup/dropoff, +10 min for restaurant seating, +15 min for hotel check-in, +10 min for museum entry (ticket queue, bag check). Show this naturally: "Arrive ~6:30 PM. Check in, freshen up. Ready by 7:30 PM."
- Include TRANSIT between every pair of consecutive activities as separate entries with category "transport" (mode, duration, cost, route/line info). Walks under 5 min can be noted in tips instead.
- TRANSPORT PRICING — BE SPECIFIC BY MODE:
  • Walking: estimatedCost.amount = 0 (always free)
  • Subway/Metro/Bus/Tram: Use the actual local fare (e.g., NYC subway = $2.90, London Tube = £2.80, Paris Métro = €2.15). DO NOT default to $30.
  • Train/Commuter Rail: Use realistic ticket price for the specific route
  • Taxi/Rideshare: Estimate based on distance and city rates (typically $10-40 depending on distance)
  • Ferry: Use the actual fare for the specific route
   • The title MUST include the mode: "Travel to [place] via [mode]" (e.g., "Travel to US Open via 7 Train", "Taxi to hotel")
 - RESTAURANT PRICING — USE REALISTIC PRICES (ALL CITIES):
   • Michelin 3-star / destination restaurants: minimum €250/pp
   • Michelin 2-star restaurants: minimum €180/pp
   • Michelin 1-star / high-end tasting menus: minimum €120/pp
   • Well-known fine dining (non-starred): minimum €60/pp
   • Famous seafood restaurants (e.g., cervejaria, marisqueira): minimum €40/pp
   • Mid-range sit-down restaurants: €20-50/pp
   • Street food, markets, bakeries: €5-15/pp
     When in doubt, price HIGHER. Underpricing makes the itinerary unreliable. Use the actual price a real diner would pay at that specific restaurant.
     SPECIFIC EXAMPLES — enforce these exact minimums regardless of city:
     • Guy Savoy (Paris, 3-star Michelin): minimum €250/pp. Do NOT price at €28 or below.
     • L'Ambroisie (Paris, 3-star Michelin): minimum €250/pp. Do NOT price at €17 or below.
     • Arpège (Paris, 3-star Michelin): minimum €250/pp.
     • Epicure at Le Bristol (Paris, 3-star Michelin): minimum €250/pp.
     • Facil (Berlin, 2-star Michelin): minimum €180/pp. Do NOT price at €140 or below.
     • Horváth (Berlin, 1-star Michelin): minimum €120/pp. Do NOT price at €28 or below.
     • Eleven Restaurant (Lisbon, 1-star Michelin): minimum €120/pp (tasting menu ~€120-150/pp). Do NOT price at €87 or below.
     • Belcanto (Lisbon, 2-star Michelin, chef José Avillez): minimum €180/pp. Do NOT price at €166 or below.
     • Alma (Lisbon, 2-star Michelin): minimum €180/pp.
     • Lasarte (Barcelona, 3-star Michelin): minimum €250/pp.
     • Disfrutar (Barcelona, 3-star Michelin): minimum €250/pp.
     • La Pergola (Rome, 3-star Michelin): minimum €250/pp.

DINING RULES — CRITICAL:
- Schedule exactly ONE dinner restaurant per evening. Never schedule two fine dining or Michelin-starred restaurants in the same evening.
- If you want to include a second evening venue, make it a bar, cocktail lounge, fado house, or nightcap — NOT another full-service restaurant.
- Michelin-starred restaurants should be priced at their actual tasting menu price: 1-star minimum €120/pp, 2-star minimum €180/pp, 3-star minimum €250/pp.
- Include meals as specified by the day's meal policy (see timing instructions above) — each a real named restaurant with price
- Each lunch and dinner recommendation should include 1 ALTERNATIVE option in its "tips" field
- ONLY recommend restaurants and dining spots with 4+ star ratings - no low-quality or poorly-reviewed venues
${buildDiningPromptBlock(diningConfig, totalDays || 1, destination || '')}
- Every dining activity MUST have a real, specific restaurant name and address — NEVER use "the destination", the city name, or "get a restaurant recommendation" as a venue

RESTAURANT NAMING RULES — CRITICAL (ABSOLUTE RULE — NO PLACEHOLDER RESTAURANTS):
- Every dining activity MUST include a SPECIFIC, REAL restaurant name. Never use generic placeholders like "a local spot", "a nearby café", "a local restaurant", "a bistro", "a nice place", "a charming spot", "the destination", or similar vague descriptions. ANY title matching "Meal at a/an/the [descriptor]" is BANNED.
- The title MUST contain the actual restaurant name (e.g., "Breakfast at Pastéis de Belém", "Dinner at Cervejaria Ramiro"), NOT a description like "Breakfast at a local spot".
- The location.name field MUST be the restaurant's actual name — NEVER "the destination", "a local spot", or any generic placeholder.
- If you cannot think of another unique restaurant for a meal, use the hotel restaurant or a well-known local chain café — NEVER fall back to a generic placeholder.
- NEVER generate any of these patterns:
  • "Breakfast at a neighborhood café" — BANNED
  • "Lunch at a bistro" — BANNED
  • "Dinner at a brasserie" — BANNED
  • "Breakfast at a boulangerie-café" — BANNED
  • "Lunch at a local restaurant" — BANNED
  • Any title with "at a [generic venue type]" — BANNED
  • Any venue named "the destination" or just the city name — BANNED
  • Any description saying "Get a restaurant recommendation" — BANNED
${(() => {
  const cityLower = (destination || '').toLowerCase().trim();
  if (cityLower.includes('paris')) return `- For Paris, use REAL restaurants like:
  BREAKFAST: Café de Flore, Angelina, Stohrer, Du Pain et des Idées, Claus, Ladurée, Carette, Holybelly, Boot Café, Ob-La-Di
  LUNCH: Le Comptoir du Relais, Bouillon Chartier, Chez Janou, Les Philosophes, Bouillon Pigalle, Bofinger, Robert et Louise, Le Bouillon Racine, Petit Bon
  DINNER: Sacré Fleur, Le Train Bleu, Brasserie Lipp, Le Relais de l'Entrecôte, Drouant, Le Voltaire, Chez Georges, Frenchie Bar à Vins
  ⚠️ NEVER use these as dinner: Petit Bon (tea sandwiches/lunch only), Angelina (tearoom/breakfast/snack only), Stohrer (patisserie/breakfast only), Ladurée (tearoom/breakfast only)`;
  if (cityLower.includes('berlin')) return `- For Berlin, use REAL restaurants like:
  BREAKFAST: The Barn, House of Small Wonder, Brammibal's Donuts, Father Carpenter, Five Elephant, Distrikt Coffee
  LUNCH: Curry 36, Monsieur Vuong, Katz Orange, Cocolo Ramen, Markthalle Neun, Mustafa's Gemüse Kebap
  DINNER: Pauly Saal, Ora, Lode & Stijn, eins44, Nobelhart & Schmutzig, Cordo`;
  if (cityLower.includes('rome') || cityLower.includes('roma')) return `- For Rome, use REAL restaurants like:
  BREAKFAST: Roscioli Caffè, Sciascia Caffè, Barnum Café, Forno Campo de' Fiori, Antico Forno Roscioli, Pasticceria Regoli
  LUNCH: Da Enzo al 29, Armando al Pantheon, Trattoria Da Teo, Salumeria Roscioli, Pizzarium, Tonnarello
  DINNER: Pierluigi, Felice a Testaccio, Grazia & Graziella, Osteria Fernanda, Roscioli, Da Danilo`;
  if (cityLower.includes('london')) return `- For London, use REAL restaurants like:
  BREAKFAST: The Wolseley, Dishoom, Buns from Home, Granger & Co, The Regency Café, E Pellicci
  LUNCH: Padella, Barrafina, Brasserie Zédel, Rochelle Canteen, Honest Burgers, The Barbary
  DINNER: St. John, The Palomar, Quo Vadis, Brat, The River Café, Gymkhana`;
  if (cityLower.includes('lisbon') || cityLower.includes('lisboa')) return `- For Lisbon, consider: Pastéis de Belém, Café A Brasileira, Copenhagen Coffee Lab, Dear Breakfast, Heim Café, Nicolau Lisboa, Fábrica Coffee Roasters, Landeau Chocolate, Time Out Market vendors, Cervejaria Ramiro, Sacramento do Chiado.`;
  return `- You MUST name specific, real restaurants for ${destination || 'this city'}. Search your knowledge for well-known local establishments.`;
})()}

DESTINATION CUISINE RULE:
- Restaurants MUST primarily serve the local/regional cuisine of the destination city. Paris → French, Rome → Italian, Tokyo → Japanese, Barcelona → Spanish/Catalan, Berlin → German/European, etc.
- At most ONE international-cuisine restaurant is acceptable per entire trip, and only if it is a well-known destination restaurant in that city (e.g., a famous Japanese restaurant in Paris like Zen or a renowned Italian in London like Padella).
- Do NOT default to international chains or generic "fusion" restaurants. Prioritize authentic local dining experiences.

ACTIVITY TYPE VARIETY RULE:
- Do NOT repeat the same special experience type on consecutive days. If the previous day included a spa/hammam, today must NOT include a spa/hammam. If the previous day had a cooking class, today must NOT have a cooking class. If the previous day had a boat tour, today must NOT have a boat tour.
- This applies to: spa, hammam, cooking class, wine tasting, bike tour, boat tour, food tour, market tour, yoga/wellness, and similar experiential activities.
- Standard activities (museums, restaurants, walks, shopping) are exempt from this rule.

- Parks, gardens, plazas, squares, viewpoints, miradouros, riverside walks, and neighborhood strolls are FREE (€0). Do NOT assign any price to these.

VENUE NAME RULES:
- venue_name must be a real place name, not a descriptive phrase.
- NEVER substitute proper nouns with English adjectives (Alphabetical, Sequential, Historical, Geographical, Chronological).
- BAD venue_name: "Alphabetical Heritage District Walk" — "Alphabetical" is not a place.
- GOOD venue_name: "Alfama District" or "Alfama Heritage Walk"
- venue_name should match the location referenced in the activity title.

HOTEL ADDRESS RULE — CRITICAL:
- ALL hotel-related activities (Check-in, Checkout, Freshen Up, Return to Hotel, Luggage Drop) MUST use the EXACT hotel address provided in the day constraints or hotel context. Do NOT invent, approximate, or vary the street number.
- On hotel-change days, pre-checkout activities use the PREVIOUS hotel's address; post-checkin activities use the NEW hotel's address.
- Specific known addresses (ALWAYS use these exact addresses when the hotel matches):
  • Palácio Ludovice Wine Experience Hotel: R. de São Pedro de Alcântara 39, 1250-238 Lisboa
- Every activity MUST have a "title" field (the display name)
- All times MUST be in 24-hour HH:MM format
- ACTIVITY COUNT: This includes meals, transit, and evening activities. Fill the day completely.
- Include at least 1 EVENING/NIGHTLIFE activity after dinner (bar, show, night market, jazz, rooftop, dessert spot)
- Include PRACTICAL TIPS inline: booking requirements, queue advice, dress codes, closure days, best times
- The LAST activity's tips field must include a NEXT MORNING PREVIEW: "Tomorrow: Wake [time]. Breakfast at [place] ([distance], ~[price])."
- For full exploration days: minimum 3 paid activities + 2 free activities + required meals (per meal policy) + evening option
${lockedActivities.length > 0 ? '- DO NOT generate activities for locked time slots listed above' : ''}
${collaboratorAttributionPrompt}
${voyancePicksPrompt}

CURATED PICKS — ONE BEST CHOICE PER SLOT (CRITICAL):
CRITICAL: Generate exactly ONE activity or restaurant per time slot. Do NOT generate multiple options, alternatives, or choices for any slot. Do NOT include isOption, optionGroup, or any selection/choice mechanism in the output. Every slot must have a single, definitive, curated recommendation. You are delivering a finished plan — not a quiz.

BUFFER TIME — MANDATORY:
Include realistic travel and transition time between every activity. NEVER schedule back-to-back with zero gap. Minimum gaps: 5 min same venue, 10-15 min walking distance, 15-20 min restaurant arrival, 20-30 min hotel check-in/out, 30-60 min airport. Include actual transit time for non-walking distances.

OPERATING HOURS — HARD CONSTRAINT:
Never schedule an activity before its opening time or after its closing time. Use conservative defaults when unknown: attractions 09:30-17:00, restaurants lunch 11:30-14:00 and dinner 18:00-21:30, outdoor activities sunrise to sunset.

ARCHETYPE NAMES — EXACT MATCH ONLY:
Use ONLY the exact archetype name from the traveler's DNA profile. Never invent variations like 'Luxury Luminary' or 'Culture Connoisseur'.

ARCHETYPE BALANCE:
Archetype influences 30-40% of activities. The rest must be universally enjoyable. Luxury ≠ $500 everything. Adventure ≠ 3 extreme sports per day. Food ≠ eating all day.

OUTPUT QUALITY:
All text must be clean, correctly spelled English. No garbled characters, no non-Latin script, no leaked schema field names.
Always use the full destination city name in all text. Never write "the" as a placeholder where the city name should go. For example, write "in the heart of Lisbon" not "in the heart of the". Write "A Goodbye to Lisbon" not "A Goodbye to the".
CRITICAL: Always use the ACTUAL city name in descriptions. Never use placeholder text like "the city" or generic references. Write "Lisbon" (or whatever the destination is) every time you reference the destination city. Do not use "the" as a substitute for the city name.

DAY TITLE RULES:
- Day titles must be complete, grammatically correct phrases under 60 characters.
- Every article (the, a, an) must be followed by a noun or adjective+noun, never directly by a preposition.
- BAD: "Arrival in Lisbon, the of Seven Hills" — GOOD: "Arrival in Lisbon, the City of Seven Hills"
- BAD: "A Journey to of Discovery" — GOOD: "A Journey of Royal Discovery"

TEXT QUALITY — NO META-COMMENTARY:
Never include parenthetical notes, internal reasoning, scheduling logic, or explanations of why an activity was chosen in any user-visible text field (title, description, tips, voyanceInsight, whyThisFits). All text must read as polished travel copy written for the end user. Do not include "(Note: ...)", "(Scheduled as ...)", "(Adjusted for ...)", "(Reflecting ...)", or any similar meta-commentary.

OPERATIONAL NOTES — NEVER INCLUDE:
Never include operational notes about checking hours, confirming availability, or verifying opening times in any description text. Never use generic database descriptor phrases like "Popular with locals", "A local favorite", "Hidden gem", "Must-visit", or "Highly recommended" as restaurant or activity descriptions. Every description must be a specific, unique sentence describing what makes this particular venue special. All descriptions should read as confident, polished travel recommendations.
Never include any Voyance branding, attribution, or "thank you" messages in activity descriptions, titles, or any user-visible text. No text should reference "Voyance" in any way.

CRITICAL GEOGRAPHIC RULE: Every restaurant and venue MUST be physically located within the trip destination city or its immediate metro area. Do not suggest restaurants from other cities or regions, even if they are famous. For example, for a Lisbon trip, only suggest restaurants actually located in the Lisbon metropolitan area — not restaurants in the Algarve, Porto, or other regions.
`;

  // ═══════════════════════════════════════════════════════════════════════
  // USER PROMPT ASSEMBLY
  // ═══════════════════════════════════════════════════════════════════════
  const isFullDay = dayMealPolicy?.isFullExplorationDay ?? (!isFirstDay && !isLastDay);

  // Import isRecurringEvent for previous day activity classification
  const { isRecurringEvent } = await import('../currency-utils.ts');

  // ── DAY BRIEF / DAY TRUTH LEDGER (deterministic ground truth, top of prompt) ──
  // The AI sees this BEFORE anything else. Anything in USER REQUIRED must
  // appear in the output verbatim. Anything in CLOSURES must NOT be
  // scheduled. Anything in ALREADY DONE must NOT be repeated. UPCOMING
  // DAYS warns against vibe clashes.
  let dayLedgerPromptBlock = '';
  try {
    const { buildDayLedger, renderDayLedgerPrompt } = await import('../day-ledger.ts');
    const { parseFineTuneIntoDailyIntents } = await import('../../_shared/parse-fine-tune-intents.ts');

    const ledgerAnchors = (lockedActivities || []).map((l: any) => ({
      title: l.title || l.name,
      startTime: l.startTime,
      endTime: l.endTime,
      category: l.category,
      source: l.lockedSource || 'pinned',
      lockedSource: l.lockedSource,
    }));
    const priorList: Array<{ title: string; dayNumber: number }> = [];
    for (const prev of (previousDayActivities || [])) {
      const t = (prev.title || prev.name || '').trim();
      const dn = (prev.dayNumber as number) || ((prev as any).day as number) || 0;
      if (t && dn) priorList.push({ title: t, dayNumber: dn });
    }

    // ── EXTRA INTENTS — soft user requests from structured `trip_day_intents` ──
    // PRIMARY source: rows in `trip_day_intents` (seeded by prepareContext from
    // all four entry points and by the assistant chat). FALLBACK: re-parse the
    // metadata blobs the legacy way. The blob fallback exists only for trips
    // generated before the structured table was introduced.
    const extraIntents: Array<Record<string, any>> = [];
    const tripWideNotes: string[] = [];
    let usedStructuredIntents = false;
    try {
      if (tripId) {
        const { fetchActiveDayIntents } = await import('../../_shared/day-intents-store.ts');
        const rows = await fetchActiveDayIntents(supabase, tripId);
        for (const r of rows) {
          // Trip-wide notes (no day_number) feed userConstraints.tripWideNotes
          if (r.day_number == null) {
            if (r.intent_kind === 'note' || r.intent_kind === 'constraint') {
              tripWideNotes.push(r.title);
            }
            continue;
          }
          if (r.day_number !== dayNumber) continue;
          if (r.status === 'fulfilled' && r.locked !== true) continue; // already done, don't re-inject
          extraIntents.push({
            title: r.title,
            startTime: r.start_time || undefined,
            endTime: r.end_time || undefined,
            kind: r.intent_kind,
            source: r.source_entry_point,
            priority: r.priority === 'avoid' ? 'avoid' : (r.priority === 'must' ? 'must' : 'should'),
            raw: r.raw_text || r.title,
            locked: !!r.locked,
            lockedSource: r.locked_source || undefined,
          });
        }
        if (rows.length > 0) usedStructuredIntents = true;
      }
    } catch (structErr) {
      console.warn('[compile-prompt] Structured intent fetch failed (non-blocking):', structErr);
    }

    // FALLBACK: legacy blob parsing — only if the structured table was empty.
    if (!usedStructuredIntents) {
      try {
        const fineTuneText = (metadata?.additionalNotes as string) || '';
        if (fineTuneText.trim()) {
          const parsed = parseFineTuneIntoDailyIntents({
            notes: fineTuneText,
            tripStartDate: (preferences?.startDate as string) || (date ? String(date).split('T')[0] : undefined),
            totalDays: totalDays || undefined,
          });
          for (const p of parsed.perDay) {
            if (p.dayNumber === dayNumber) {
              extraIntents.push({
                title: p.title,
                startTime: p.startTime,
                kind: p.kind,
                source: 'fine_tune',
                priority: p.priority,
                raw: p.raw,
              });
            }
          }
          for (const w of parsed.tripWide) tripWideNotes.push(w);
        }
      } catch (parseErr) {
        console.warn('[compile-prompt] Fine-tune parse failed (non-blocking):', parseErr);
      }

      try {
        const recordedIntents = Array.isArray((metadata as any)?.userIntents)
          ? ((metadata as any).userIntents as Array<Record<string, any>>)
          : [];
        for (const ri of recordedIntents) {
          if (Number(ri.dayNumber) !== dayNumber) continue;
          if (!ri.title || typeof ri.title !== 'string') continue;
          extraIntents.push({
            title: ri.title,
            startTime: ri.startTime,
            kind: ri.kind || 'activity',
            source: ri.source || 'assistant',
            priority: ri.priority === 'must' ? 'must' : 'should',
            raw: ri.raw || ri.title,
          });
        }
      } catch (intentErr) {
        console.warn('[compile-prompt] Recorded intents read failed (non-blocking):', intentErr);
      }
    }

    // ── FORWARD STATE — peek ahead 1–2 days to avoid vibe clashes ──
    // We piggyback on `previousDayActivities` ONLY if it carries forward items
    // (some callers attach future days as well). Caller may also pass a
    // dedicated `forwardActivities` field through metadata.
    const forwardActivities: Array<Record<string, any>> = [];
    try {
      const md = metadata as any;
      const fa = Array.isArray(md?.forwardActivities) ? md.forwardActivities : [];
      for (const f of fa) {
        const dn = Number(f.dayNumber);
        if (!isFinite(dn) || dn <= dayNumber || dn > dayNumber + 2) continue;
        forwardActivities.push({
          dayNumber: dn,
          title: f.title || f.name,
          name: f.name || f.title,
          category: f.category,
          startTime: f.startTime,
        });
      }
    } catch (_fwdErr) { /* non-blocking */ }

    // ── USER CONSTRAINTS — dietary / mobility / per-day budget ──
    const userConstraints: Record<string, any> = {};
    try {
      const dietaryFromPrefs = (preferences as any)?.dietaryRestrictions
        || (preferences as any)?.dietary
        || (metadata as any)?.dietaryRestrictions;
      if (Array.isArray(dietaryFromPrefs) && dietaryFromPrefs.length > 0) {
        userConstraints.dietary = dietaryFromPrefs.filter(Boolean);
      } else if (typeof dietaryFromPrefs === 'string' && dietaryFromPrefs.trim()) {
        userConstraints.dietary = [dietaryFromPrefs.trim()];
      }
      const mobility = (preferences as any)?.mobility || (metadata as any)?.mobility;
      if (mobility && typeof mobility === 'string') userConstraints.mobility = mobility;
      if (tripWideNotes.length > 0) userConstraints.tripWideNotes = tripWideNotes;
    } catch (_cErr) { /* non-blocking */ }

    const ledger = buildDayLedger({
      dayNumber,
      date: date || '',
      city: resolvedDestination,
      country: resolvedCountry || '',
      hardFacts: {
        isFirstDay: !!isFirstDay,
        isLastDay: !!isLastDay,
        isHotelChange: false,
        hotel: resolvedHotelOverride?.name
          ? {
              name: resolvedHotelOverride.name,
              address: resolvedHotelOverride.address,
              checkIn: resolvedHotelOverride.checkIn,
              checkOut: resolvedHotelOverride.checkOut,
            }
          : null,
      },
      anchors: ledgerAnchors,
      priorDayActivities: priorList,
      extraIntents,
      forwardActivities,
      userConstraints: Object.keys(userConstraints).length > 0 ? userConstraints : undefined,
    });
    dayLedgerPromptBlock = renderDayLedgerPrompt(ledger) + '\n\n';

    if (extraIntents.length > 0) {
      console.log(`[compile-prompt] Day ${dayNumber} brief: ${extraIntents.length} soft intent(s) injected`);
    }
  } catch (ledgerErr) {
    console.warn('[compile-prompt] Day Ledger render failed (non-blocking):', ledgerErr);
  }

  const userPrompt = `${dayLedgerPromptBlock}Generate Day ${dayNumber} of ${totalDays} in ${resolvedDestination}${resolvedCountry ? `, ${resolvedCountry}` : ''}.

Date: ${date}
Travelers: ${travelers}
Budget: ${effectiveBudgetTier}${actualDailyBudgetPerPerson != null ? ` (~$${actualDailyBudgetPerPerson}/day per person)
⚠️ HARD BUDGET CAP: The user has set a real budget of ~$${Math.round(actualDailyBudgetPerPerson * (travelers || 1))}/day total ($${actualDailyBudgetPerPerson}/person) for activities.
${actualDailyBudgetPerPerson < 10 ? `🚨 EXTREMELY TIGHT BUDGET: Do your best — prioritize FREE activities (parks, temples, markets, viewpoints, walking tours). For meals, suggest cheapest realistic options (street food, convenience stores). Do NOT invent fake low prices — use real local costs. Include a "budget_note" field with an honest 1-sentence note about budget feasibility.` : actualDailyBudgetPerPerson < 30 ? `⚡ TIGHT BUDGET: Lean heavily on free attractions, street food, self-guided exploration. Limit paid activities to 1-2/day. Use realistic local prices.` : `Stay within this cap. Balance expensive activities with free alternatives.`}` : ''}
${allocationPromptBlock}
ARCHETYPE: ${primaryArchetype}
${isFullDay ? `DAY TYPE: Full exploration day — generate a COMPLETE hour-by-hour plan with ${dayMealPolicy?.requiredMeals?.length ?? 3} meals (${dayMealPolicy?.requiredMeals?.join(', ') ?? 'breakfast, lunch, dinner'}), transit between every stop, evening activity, and next-morning preview.` : dayMealPolicy && !isFirstDay && !isLastDay ? `DAY TYPE: ${dayMealPolicy.dayMode.replace(/_/g, ' ')} — ${dayMealPolicy.mealInstructionText}` : `SIGHTSEEING ACTIVITY COUNT: ${minActivitiesFromArchetype}-${maxActivitiesFromArchetype} (adjust for arrival/departure constraints)`}
${preferences?.pace ? `Pace: ${preferences.pace}` : ''}
${preferences?.dayFocus ? `Day focus: ${preferences.dayFocus}` : ''}
${(() => {
  const focus = (preferences?.dayFocus || preferences?.rewriteInstructions || '').toLowerCase();
  const isBudgetDown = /cheap|budget|afford|save money|less expensive|lower cost|reduce.*cost|cut.*spending|frugal/i.test(focus);
  if (isBudgetDown && currentActivities?.length) {
const currentCosts = currentActivities.map((a: any) => a.cost?.amount ?? a.estimatedCost ?? 0);
const maxCurrent = Math.max(...currentCosts);
const avgCurrent = currentCosts.reduce((s: number, c: number) => s + c, 0) / (currentCosts.length || 1);
return `
🚨 BUDGET-DOWN REWRITE — HARD CONSTRAINT:
The user explicitly asked for CHEAPER options. Every replacement activity MUST cost LESS than what it replaces.
Current day average cost per activity: ~$${Math.round(avgCurrent)}. Current max: ~$${Math.round(maxCurrent)}.
Your replacements should average BELOW $${Math.round(avgCurrent * 0.5)} per activity.
Prefer FREE alternatives: public parks, free museums, self-guided walks, street food, markets, viewpoints.
NEVER suggest a more expensive alternative when the user asks for cheaper. This is non-negotiable.`;
  }
  return '';
})()}

CRITICAL TIME ORDERING & MEAL TIMING RULES:
- ALL activities MUST be in strict chronological order by startTime.
- Breakfast/brunch: 7:00 AM – 10:00 AM. NEVER schedule breakfast after 11:00 AM.
- Morning activities: 9:00 AM – 12:00 PM.
- Lunch: 11:30 AM – 1:30 PM.
- Afternoon activities: 1:00 PM – 5:00 PM.
- Dinner: 7:00 PM – 9:30 PM at a proper sit-down restaurant. NEVER schedule dinner before 5:00 PM.
- Cocktail bars, lounges, and nightcap venues do NOT count as dinner. They are supplementary evening activities that must come AFTER a proper dinner restaurant, not replace it.
- Every full day (not departure day) MUST include breakfast, lunch, AND dinner at a proper restaurant.
- Evening activities/nightlife: 7:00 PM – 11:00 PM.
- Nightcap/late night: 9:00 PM – midnight. NEVER schedule a nightcap before 8:00 PM.
- Activities must flow logically: morning → midday → afternoon → evening → night.
- Do NOT include "Return to Hotel" entries at the START of any day.
- Include exactly ONE "Return to [Hotel]" activity at the end of each day. Never generate two consecutive return-to-hotel activities.
- Do NOT include any activities between 12:00 AM and 6:00 AM unless they are specifically planned late-night activities from the CURRENT day.
- Day 1 should begin with arrival or the first morning activity (typically 8:00-9:00 AM), never with midnight hotel entries.

TICKETED ATTRACTION PRICING:
- Enclosed monuments, museums, and archaeological sites that charge admission should NEVER be Free/€0.
- If an attraction says "Booking Required", it almost certainly has an entry fee.
- Examples: Colosseum (€16-35), Vatican Museums (€17), Louvre (€17), Sagrada Familia (€26), Tower of London (€29), Eiffel Tower (€11+).
- Public VIEWPOINTS of attractions can be Free (e.g., "Views of the Colosseum from outside"), but entering the site is NOT Free.
- Parks, piazzas, fountains, viewpoints, and public gardens remain Free.

VENUE TYPE PRICING GUIDELINES:
Match the price to the VENUE TYPE, not just the category:
- STREET FOOD / CASUAL QUICK-SERVICE (€5-15/pp): Street food stalls, market stands, pizza-by-the-slice, kebab, known casual brands (Trapizzino, Bao, Supplizio). If the venue is a known street food brand, price at €5-15/pp.
- BAR / COCKTAIL / NIGHTCAP (€15-35/pp): Hotel bars, cocktail bars, wine bars, speakeasies. If the activity title includes "nightcap", "cocktail", "bar", "drinks", or "aperitif", price at €15-35/pp. NEVER price a bar/cocktail activity above €50/pp. A "nightcap" is 1-2 drinks, NOT a dinner.
- CASUAL RESTAURANTS / TRATTORIAS / BISTROS (€15-45/pp): Neighborhood trattorias, brasseries, bistros, tapas bars, casual lunch spots.
- UPSCALE RESTAURANTS (€45-120/pp): Fine dining without Michelin stars, hotel restaurants (non-starred), contemporary cuisine.
- MICHELIN-STARRED: Use established Michelin price floors (1-star min €120, 2-star min €180, 3-star min €250).
- BREAKFAST (city-dependent): Budget cafés €8-15/pp, mid-range €15-30/pp, luxury hotel €40-80/pp.

${preferenceContext}
${tripIntentsContext}
${mustDoPrompt}
${additionalNotesPrompt}
${mustHavesConstraintPrompt}
${preBookedCommitmentsPrompt}
${(() => {
  const wi = params.wellnessInstruction;
  if (!wi) return '';
  return `
WELLNESS & SPA RULES:
- Maximum 2 spa or wellness activities across the ENTIRE trip
- NEVER put spa/wellness on two consecutive days
- ${wi}
`;
})()}
${(() => {
  if (!previousDayActivities?.length) return '';
  const mustDoList = (Array.isArray(paramMustDoActivities)
    ? paramMustDoActivities
    : (typeof paramMustDoActivities === 'string' ? paramMustDoActivities : '').split(',')
  ).map((s: string) => String(s).trim()).filter(Boolean);
  const recurring: string[] = [];
  const nonRecurring: string[] = [];
  for (const prev of previousDayActivities) {
if (isRecurringEvent({ title: prev }, mustDoList)) {
  recurring.push(prev);
} else {
  nonRecurring.push(prev);
}
  }
  let result = '';
  if (nonRecurring.length > 0) {
const MAX_AVOID_LIST = 40;
const capped = nonRecurring.slice(-MAX_AVOID_LIST);
const omitted = nonRecurring.length - capped.length;
result += `\nAvoid repeating these specific venues/activities (be creative and pick DIFFERENT ones): ${capped.join(', ')}`;
if (omitted > 0) {
  result += `\n(Plus ${omitted} more from earlier days — avoid ALL previously visited venues, not just the ones listed above.)`;
}
  }
  if (recurring.length > 0) {
result += `\nTHESE ARE MULTI-DAY EVENTS the traveler is attending across multiple days — YOU MUST CREATE A FULL ATTENDANCE ACTIVITY CARD for each (not just transit): ${recurring.join(', ')}`;
  }
  return result;
})()}

${(() => {
  if (!paramUsedVenues || !Array.isArray(paramUsedVenues) || paramUsedVenues.length === 0) return '';
  const unique = [...new Set(paramUsedVenues)];
  const MAX_VENUE_LIST = 50;
  const capped = unique.slice(-MAX_VENUE_LIST);
  return `
VENUE DEDUP — DO NOT REVISIT THESE LOCATIONS:
The following venues/locations have already been scheduled on previous days.
Do NOT include any of them again, even under a different activity title or slight name variation:
${capped.join(', ')}

This applies to ALL activity types — museums, landmarks, parks, attractions, and restaurants.
If you need a museum, choose a DIFFERENT museum. If you need a landmark, choose a DIFFERENT one.
"Louvre Museum" and "Louvre Museum Exploration" are the SAME venue — do NOT repeat.`;
})()}

UNIVERSAL QUALITY RULES (applies to ALL cities worldwide):

1. REAL RESTAURANTS ONLY: Every restaurant MUST be a real, currently operating restaurant you are confident exists. Include the full street address with a number (e.g. "226 Rue de Rivoli, 75001 Paris"). If you are not confident a restaurant exists, do NOT include it. Fewer dining activities are better than fake ones.

2. LOCAL CUISINE FIRST: At least 70% of restaurants should serve the destination country's cuisine. Paris = French bistros and brasseries. Tokyo = Japanese izakayas and sushi bars. Barcelona = Spanish tapas bars. Do NOT default to Italian restaurants in non-Italian cities.

3. PRICE REALITY — base prices on what restaurants ACTUALLY cost in that city:
   - Street food / casual café: €8-20 per person
   - Mid-range bistro / trattoria / izakaya: €25-55 per person
   - Upscale restaurant: €60-100 per person
   - Fine dining / Michelin: €100-250 per person
   Adjust for cost of living. A casual Paris bistro is €30-45, not €85. A Tokyo ramen shop is ¥1000-1500, not ¥5000.

4. MEAL TIMING BY CULTURE — schedule meals at times locals actually eat:
   - France/UK/Germany: Lunch 12:00-14:00, Dinner 19:00-21:00
   - Spain/Argentina: Lunch 13:30-15:30, Dinner 21:00-23:00
   - Japan: Lunch 11:30-13:30, Dinner 18:00-20:00
   - Morocco/Middle East: Lunch 12:30-14:30, Dinner 20:00-22:00
   - USA/Canada: Lunch 11:30-13:30, Dinner 18:00-20:30

5. ADDRESSES MUST BE SPECIFIC: "the destination" is NOT an address. "Paris, France" is NOT an address. Every venue needs a street name and number.

6. NO SAME ACTIVITY TYPE ON CONSECUTIVE DAYS: If yesterday had a spa, today must not. If yesterday had a museum morning, today should start differently. Vary the rhythm.

7. DEPARTURE DAY — HARD TERMINAL SEQUENCE: Once the traveler checks out and heads for the airport/station, NOTHING else may follow except logistics. The ONLY valid sequence on a departure day is: (optional) breakfast / one short nearby item → checkout → transfer to airport/station → security/boarding → flight/train. NEVER schedule a stroll, walk, lunch, museum, shopping, viewpoint, café stop, or any leisure activity AFTER the airport/station transfer. NEVER schedule activities that start within 3 hours of a flight or 2 hours of a train. Wrong: checkout → depart for flight → lunch → stroll → airport. Right: checkout → transfer to airport → flight.

${(() => {
  if (!paramRestaurantPool || !Array.isArray(paramRestaurantPool) || paramRestaurantPool.length === 0) return '';
  // Use the imported extractRestaurantVenueName for consistent identity matching
  const usedNormalized = new Set((paramUsedRestaurants || []).map((n: string) => extractRestaurantVenueName(n)));
  const available = paramRestaurantPool.filter((r: any) => !usedNormalized.has(extractRestaurantVenueName(r.name || '')));
  if (available.length === 0) return '';

  // Show larger candidate sets — longer trips need more visible options
  const perMealLimit = Math.max(8, Math.min(16, Math.ceil(available.length / 4)));
  const breakfastSpots = available.filter((r: any) => r.mealType === 'breakfast').slice(0, perMealLimit);
  const lunchSpots = available.filter((r: any) => r.mealType === 'lunch').slice(0, perMealLimit);
  const dinnerSpots = available.filter((r: any) => r.mealType === 'dinner').slice(0, perMealLimit);
  const anySpots = available.filter((r: any) => r.mealType === 'any').slice(0, Math.ceil(perMealLimit * 0.75));

  let poolPrompt = `
${'='.repeat(70)}
🍽️ RESTAURANT POOL — PICK FROM THIS LIST (DO NOT INVENT RESTAURANTS)
${'='.repeat(70)}
For ALL meals today, you MUST pick a restaurant from this pre-verified list.
Do NOT make up restaurant names. Do NOT use generic names like "local restaurant" or "dinner spot".
Each restaurant below is REAL and highly rated (4.5+ stars).
CRITICAL: Do NOT pick the same restaurant for multiple meals. Each meal MUST use a DIFFERENT venue.

`;
  if (breakfastSpots.length > 0) {
poolPrompt += `BREAKFAST OPTIONS:\n${breakfastSpots.map((r: any) => `  • ${r.name} — ${r.cuisine || 'Local cuisine'}, ${r.neighborhood || ''} (${r.priceRange || '$$'})`).join('\n')}\n\n`;
  }
  if (lunchSpots.length > 0) {
poolPrompt += `LUNCH OPTIONS:\n${lunchSpots.map((r: any) => `  • ${r.name} — ${r.cuisine || 'Local cuisine'}, ${r.neighborhood || ''} (${r.priceRange || '$$'})`).join('\n')}\n\n`;
  }
  if (dinnerSpots.length > 0) {
poolPrompt += `DINNER OPTIONS:\n${dinnerSpots.map((r: any) => `  • ${r.name} — ${r.cuisine || 'Local cuisine'}, ${r.neighborhood || ''} (${r.priceRange || '$$'})`).join('\n')}\n\n`;
  }
  if (anySpots.length > 0) {
poolPrompt += `FLEXIBLE (any meal):\n${anySpots.map((r: any) => `  • ${r.name} — ${r.cuisine || 'Local cuisine'}, ${r.neighborhood || ''} (${r.priceRange || '$$'})`).join('\n')}\n\n`;
  }
  poolPrompt += `RULE: Pick ONE restaurant per meal from the lists above. Use the EXACT name as shown. Do NOT modify restaurant names.\n\n`;

  const usedList = paramUsedRestaurants || [];
  if (usedList.length > 0) {
poolPrompt += `⛔ ALREADY USED ON PREVIOUS DAYS (DO NOT PICK THESE):\n`;
poolPrompt += usedList.map((name: string) => `  • ${name}`).join('\n');
poolPrompt += `\nPick DIFFERENT restaurants — variety is essential. Do NOT repeat any restaurant from this blocklist.\n`;
  }

  console.log(`[compile-prompt] Restaurant pool: ${available.length} available (${breakfastSpots.length}B/${lunchSpots.length}L/${dinnerSpots.length}D), blocklist: ${(usedList || []).length}`);
  return poolPrompt;
})()}

${(() => {
  if (paramRestaurantPool && Array.isArray(paramRestaurantPool) && paramRestaurantPool.length > 0) return '';
  const usedList = paramUsedRestaurants || [];
  if (usedList.length === 0) return '';
  return `⛔ RESTAURANT VARIETY RULE — DO NOT USE THESE (already used on previous days):\n${usedList.map((name: string) => `  • ${name}`).join('\n')}\nPick DIFFERENT restaurants for every meal. Variety is essential.\n`;
})()}

${(() => {
  const usedList = paramUsedRestaurants || [];
  if (usedList.length === 0) return '';
  return `🚫 HARD RESTAURANT BLOCKLIST — ZERO TOLERANCE:\nThese restaurants were ALREADY used on previous days. Do NOT use ANY of them again, not even under a slightly different name:\n${usedList.join(', ')}\nEvery breakfast, lunch, and dinner MUST be at a DIFFERENT restaurant than all previous days. No exceptions.`;
})()}

${(() => {
  if (!isLastDay) return '';
  const usedList = paramUsedRestaurants || [];
  if (usedList.length === 0) return '';
  return `🛫 DEPARTURE DAY RESTAURANT RULES — THIS IS THE FINAL DAY:
The traveler has already eaten at these restaurants on prior days: ${usedList.join(', ')}
You MUST choose restaurants that are NOT in the above list.
For the departure day lunch specifically, here are SAFE options that are unlikely to have been used:
  • Ponto Final (Cacilhas, across the river)
  • Café de São Bento (steakhouse near Rato)
  • O Velho Eurico (traditional Alfama)
  • Mercado da Ribeira / Time Out Market (food hall)
  • Solar dos Presuntos (traditional Portuguese)
  • A Cevicheria (Príncipe Real)
  • Tasca do Chico (Alfama fado restaurant)
  • Cervejaria Trindade (historic beer hall)
If your first restaurant choice matches ANY name in the used list above, REPLACE it immediately with one from the safe options list.
DO NOT use generic placeholders like "a bistro" or "a café" — always use a specific real restaurant name.`;
})()}

CRITICAL REMINDERS:
1. ${isFullDay ? `This is a FULL DAY: ${dayMealPolicy?.requiredMeals?.join(' + ') ?? 'breakfast + lunch + dinner'} + 3 paid activities + 2 free activities + transit between all stops + evening activity + next morning preview. Fill EVERY hour.` : dayMealPolicy && !isFirstDay && !isLastDay ? `This is a ${dayMealPolicy.dayMode.replace(/_/g, ' ')} day. Required meals: ${dayMealPolicy.requiredMeals.length > 0 ? dayMealPolicy.requiredMeals.join(', ') : 'none'}. Do NOT add extra meals beyond what the meal policy specifies.` : `${minActivitiesFromArchetype}-${maxActivitiesFromArchetype} scheduled sightseeing activities for this ${isFirstDay ? 'arrival' : 'departure'} day.`}
2. Check the archetype's avoid list. If it says "no spa", there are ZERO spa activities.
3. Check the budget constraints. If value-focused, no €100+ experiences.
4. ${primaryArchetype === 'flexible_wanderer' || primaryArchetype === 'slow_traveler' || (traitScores.pace || 0) <= -3 ? 'Include at least one 2+ hour UNSCHEDULED block labeled "Free time to explore [neighborhood]"' : 'Follow the pacing guidelines for this archetype'}
5. ${isFullDay ? 'TRANSIT: Include a transport entry (category: "transport") between EVERY pair of consecutive activities. Include mode, duration, and REALISTIC cost per mode (subway ~$2-5, taxi ~$15-40, walking = $0). Do NOT use a flat cost for all transit.' : ''}
6. ${isFullDay ? 'PRICES: Every meal, every ticket, every taxi must have a price. estimatedCost.amount = 0 for free activities. No blanks.' : ''}
7. NEVER repeat a restaurant across different days. Each day MUST use completely different restaurants for every meal. Variety is essential — travelers do not want to eat at the same place twice.
8. For BREAKFAST specifically: NEVER repeat the same breakfast venue on consecutive days. ${destination || 'This destination'} has hundreds of excellent breakfast spots — there is NO reason to repeat any restaurant. If you find yourself choosing a restaurant from the blocklist above, STOP and pick a completely different one.
9. ACTIVITY COUNT CHECK: Every day must have minimum 3 paid activities + 2 free activities. If your output has fewer, you are under-generating. Add more.
10. MORNING GAP CHECK: If there is nothing between breakfast (8-9am) and lunch (12-1pm), you left a 3-hour gap. Fill it with at least 1 paid activity + 1 free activity.
11. TRANSIT REALITY CHECK: Do NOT use "5 min walk" as a default. Actually think about the distance between locations. Different arrondissements/neighborhoods = minimum 10-15 min. Same street/block = 3-5 min. Cross-city = 20-30 min.
12. TRANSIT LABELS: The transit activity title MUST name the IMMEDIATE NEXT activity's venue in chronological order. "Travel to [next venue name]" or "Walk to [next venue name]". Never label transit with a venue that is two or more stops away. WRONG: lunch at 12:30 then "Travel to Hammam" inserted before lunch when the Hammam isn't until 15:15 — the card before lunch must say "Travel to [the lunch venue]". Insert one transit card per real venue change, immediately preceding that venue.
13. TIME OVERLAP CHECK: The NEXT activity cannot start before the PREVIOUS activity ends. If you insert a "freshen up at hotel" before dinner, calculate: hotel_arrival_time + freshen_duration + transit_to_restaurant = dinner_start. Work BACKWARDS from dinner reservation time.
14. HOTEL ROUND-TRIP MATH: Going back to the hotel before dinner requires: transit TO hotel + time AT hotel (20-30 min) + transit FROM hotel to restaurant. All three must fit between the previous activity's end and dinner start. If they don't fit, SKIP the hotel visit entirely.
15. NO DEAD GAPS OVER 90 MINUTES: If there is more than 90 minutes of empty time between two activities (excluding overnight), fill it. Extend the previous activity, add a relaxation activity (café, park stroll, shopping), or move the next activity earlier. A 3-hour gap on a trip is unacceptable.
16. MINIMUM ACTIVITY DURATIONS: Museum/cultural site visits = minimum 60 min. Spa/wellness = minimum 60 min. Meals (lunch/dinner) = minimum 45 min. Breakfast = minimum 30 min. No activity should be under 30 min unless it's a quick transit or photo stop.

${'='.repeat(70)}
🧠 VOYANCE INTELLIGENCE FIELDS — MANDATORY FOR EVERY ACTIVITY
${'='.repeat(70)}
For EVERY activity, you MUST include ALL of these intelligence fields:
1. "tips" (string, 30+ chars): Specific, actionable insider tip. NOT generic.${isFullDay ? ' For lunch/dinner: include 1 alternative restaurant. For last activity: include next morning preview.' : ''}
2. "crowdLevel": "low", "moderate", or "high" at the SCHEDULED time
3. "isHiddenGem" (boolean): true for genuine discoveries (not mainstream). At least 1-2 per day.
4. "hasTimingHack" (boolean): true if this time slot gives an advantage. At least 2-3 per day.
5. "bestTime" (string): If hasTimingHack=true, explain why this time is optimal.
6. "voyanceInsight" (string): One unique fact most travelers don't know.
7. "personalization.whyThisFits" (string): Reference specific traveler traits/preferences.

Generate activities following ALL constraints above.
IMPORTANT: Pick DIFFERENT restaurants/activities than listed above. Do not repeat.`;

  // ═══════════════════════════════════════════════════════════════════════
  // LOG
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[compile-prompt] System prompt: ${systemPrompt.length} chars, User prompt: ${userPrompt.length} chars`);

  return {
    systemPrompt,
    userPrompt,
    mustDoEventItems,
    dayMealPolicy,
    allUserIdsForAttribution,
    actualDailyBudgetPerPerson,
    profile,
    effectiveBudgetTier,
    isSmartFinish,
    smartFinishRequested,
    metadata,
    mustDoActivitiesRaw,
    preferenceContext,
    dayConstraints,
    flightContext,
    lockedCards: lockedCardsForDay,
  };
}
