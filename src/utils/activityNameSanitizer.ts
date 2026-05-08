/**
 * Sanitizes activity names by stripping internal system prefixes
 * that should never be shown to users.
 */
import {
  isAIStubVenueName,
  inferMealTypeFromTitle,
  inferMealTypeFromTime,
  stubFallbackLabel,
  type MealType,
} from './stubVenueDetection';
import {
  isClientPlaceholderWellness,
  hasGenericWellnessTitle,
  WELLNESS_PLACEHOLDER_FALLBACK,
  type WellnessActivityShape,
} from './wellnessPlaceholderDetection';

// Strip AI search qualifiers from names/locations
// e.g. "(Satellite or High-End alternative in Chiyoda/Minato)"
// e.g. "(or high-end Kaiseki alternative)"
const AI_QUALIFIER_RE = /\s*\((?:[^)]*?\b(?:alternative|satellite|or\s+high.end|similar|equivalent|comparable)\b[^)]*?)\)/gi;

// Strip "or High-End Boutique Wellness" style trailing qualifiers (no parens)
const TRAILING_OR_QUALIFIER_RE = /\s+or\s+(?:high.end|similar|equivalent|comparable)\b[^,.]*/gi;

// Strip "slot: " prefix from descriptions
const SLOT_PREFIX_RE = /^slot:\s*/i;

// Strip "Fulfills the ... slot/requirement." sentences
const FULFILLS_RE = /\.?\s*Fulfills the\s+[^.]*?(?:slot|requirement|block)\.\s*/gi;

// Prompt-artifact tokens leaked from the generator: "(slot)", "(AESTHETIC slot)",
// "(<TAG> placeholder)", AND bare ALLCAPS-with-underscore tokens like
// "(FLEX_WINDOW)", "(INTEREST_SLOT)", "(NARRATIVE_MOOD)", "(DEEP_CONTEXT)".
// Underscore is required on the bare alternative so legit acronyms like
// "(NYC)" / "(USA)" are NOT stripped. See mem://technical/itinerary/stateful-regex-strip-bug.
// IMPORTANT: keep two regexes — non-global for `.test()`, /g for `.replace()`.
const PROMPT_ARTIFACT_TEST_RE =
  /\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/i;
const PROMPT_ARTIFACT_REPLACE_RE =
  /\s*\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/gi;

function stripPromptArtifacts(input: string): string {
  if (!input || !PROMPT_ARTIFACT_TEST_RE.test(input)) return input;
  return input.replace(PROMPT_ARTIFACT_REPLACE_RE, '').replace(/\s{2,}/g, ' ').trim();
}

// Strip distance/cost metadata in tips: "(Level 39 of Hotel, ~0.1km, ~$40)"
const META_DISTANCE_COST_RE = /\((?:[^)]*?~\d+(?:\.\d+)?(?:km|mi|m)\b[^)]*?)\)/gi;
const INLINE_META_RE = /,?\s*~\d+(?:\.\d+)?(?:km|mi|m)\b,?\s*~?\$?\d+/gi;

// Internal prefixes used by the generation system that shouldn't appear in UI
const SYSTEM_PREFIXES = [
  'EDGE_ACTIVITY:',
  'SIGNATURE_MEAL:',
  'LINGER_BLOCK:',
  'WELLNESS_MOMENT:',
  'AUTHENTIC_ENCOUNTER:',
  'SOCIAL_EXPERIENCE:',
  'SOLO_RETREAT:',
  'DEEP_CONTEXT:',
  'SPLURGE_EXPERIENCE:',
  'VIP_EXPERIENCE:',
  'COUPLES_MOMENT:',
  'CONNECTIVITY_SPOT:',
  'FAMILY_ACTIVITY:',
  // Also handle lowercase variants
  'edge_activity:',
  'signature_meal:',
  'linger_block:',
  'wellness_moment:',
  'authentic_encounter:',
  'social_experience:',
  'solo_retreat:',
  'deep_context:',
  'splurge_experience:',
  'vip_experience:',
  'couples_moment:',
  'connectivity_spot:',
  'family_activity:',
];

/**
 * Remove internal system prefixes from activity names
 * @param name - The raw activity name that may contain system prefixes
 * @returns Clean activity name suitable for display
 */
export interface SanitizeActivityNameOpts {
  /** Activity category — when dining/food/restaurant, AI stub names are masked */
  category?: string;
  /** Optional explicit meal type to label the fallback */
  mealType?: import('./stubVenueDetection').MealType | null;
  /** Optional start time (HH:MM) used to infer meal type when not provided */
  startTime?: string | null;
  /** Optional full activity object — enables wellness placeholder masking */
  activity?: WellnessActivityShape | null;
}

export function sanitizeActivityName(
  name: string | undefined | null,
  opts?: SanitizeActivityNameOpts,
): string {
  if (!name) return 'Activity';
  
  // Strip stray CJK characters injected by AI models (e.g. 旋)
  let sanitized = name.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, '').trim();

  // Strip prompt-artifact tokens like "(INTEREST_SLOT)" / "(FLEX_WINDOW)" /
  // "(AESTHETIC slot)" before any other processing. Card titles render through
  // here (NOT through sanitizeText), so this is the UI safety net for tokens
  // that survived the edge/DB scrubbers.
  sanitized = stripPromptArtifacts(sanitized);
  
  // Strip any system prefixes
  for (const prefix of SYSTEM_PREFIXES) {
    if (sanitized.startsWith(prefix)) {
      sanitized = sanitized.slice(prefix.length).trim();
      break; // Only remove first matching prefix
    }
  }

  // Repair orphaned "City" gap in titles (e.g. "Explore the of Paris Museum")
  sanitized = sanitized.replace(/\bthe\s+of\s+(?=[A-Z])/g, 'the City of ');
  sanitized = sanitized.replace(/,\s*the\s+of\b/gi, ', the City of');
  sanitized = sanitized.replace(/\bthe['’]\s?s\b/gi, "the city's");
  
  // Strip AI search qualifiers like "(or high-end alternative)"
  sanitized = sanitized.replace(AI_QUALIFIER_RE, '').trim();
  // Strip trailing "or High-End Boutique Wellness" without parens
  sanitized = sanitized.replace(TRAILING_OR_QUALIFIER_RE, '').trim();

  // Strip "Voyance Pick" / "Hotel Pick" internal label suffixes
  sanitized = sanitized.replace(/\s*(?:Voyance\s+Pick|Hotel\s+Pick)\s*$/gi, '').trim();

  // Also handle case-insensitive matching for robustness
  const lowerName = sanitized.toLowerCase();
  for (const prefix of SYSTEM_PREFIXES) {
    if (lowerName.startsWith(prefix.toLowerCase())) {
      sanitized = sanitized.slice(prefix.length).trim();
      break;
    }
  }
  
  // Remove exact duplicate suffixes (e.g., "Veracruz All Natural All Natural" → "Veracruz All Natural")
  const words = sanitized.split(' ');
  const halfLen = Math.floor(words.length / 2);
  if (halfLen > 0 && words.length % 2 === 0) {
    const firstHalf = words.slice(0, halfLen).join(' ');
    const secondHalf = words.slice(halfLen).join(' ');
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      sanitized = firstHalf;
    }
  }

  // Remove trailing single-word duplicates that already appear in the name
  // e.g., "Barton Springs Pool Pool" → "Barton Springs Pool"
  // e.g., "Zilker Botanical Garden Garden" → "Zilker Botanical Garden"
  // e.g., "Franklin Barbecue Barbecue" → "Franklin Barbecue"
  const trimWords = sanitized.split(' ');
  if (trimWords.length >= 2) {
    const lastWord = trimWords[trimWords.length - 1];
    const withoutLast = trimWords.slice(0, -1).join(' ');
    const precedingWords = withoutLast.toLowerCase().split(/\s+/);
    if (precedingWords.includes(lastWord.toLowerCase())) {
      sanitized = withoutLast;
    }
  }

  // Remove trailing multi-word duplicates (e.g., "Cosmic Coffee Coffee & Beer" where "Coffee" repeats)
  // Catch: "Name X X" where last word repeats immediately
  const splitFinal = sanitized.split(' ');
  if (splitFinal.length >= 3) {
    const last = splitFinal[splitFinal.length - 1];
    const secondLast = splitFinal[splitFinal.length - 2];
    if (last.toLowerCase() === secondLast.toLowerCase()) {
      sanitized = splitFinal.slice(0, -1).join(' ');
    }
  }

  // Remove any consecutive duplicate word (case-insensitive)
  // e.g., "Pantheon Pantheon" → "Pantheon", "The The Restaurant" → "The Restaurant"
  sanitized = sanitized.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // Strip trailing geographic synonym stuffing
  // e.g., "Central Park walk borough town place locale district" → "Central Park walk"
  const GEO_SYNONYMS = new Set([
    'borough', 'town', 'place', 'locale', 'district', 'quarter', 'sector',
    'area', 'neighborhood', 'neighbourhood', 'zone', 'region', 'vicinity',
    'suburb', 'precinct', 'ward', 'enclave', 'territory', 'locality',
  ]);
  const geoWords = sanitized.split(' ');
  const geoMatches = geoWords.filter(w => GEO_SYNONYMS.has(w.toLowerCase()));
  if (geoMatches.length >= 3) {
    const firstGeoIdx = geoWords.findIndex(w => GEO_SYNONYMS.has(w.toLowerCase()));
    if (firstGeoIdx > 0) {
      sanitized = geoWords.slice(0, firstGeoIdx).join(' ');
    }
  }

  // Stub-venue mask for meal slots — replaces "Table du Quartier" / "Café Matinal"
  // family of AI inventions with a clear "find a local spot" affordance.
  if (sanitized && isAIStubVenueName(sanitized)) {
    const cat = (opts?.category || '').toLowerCase();
    const isDiningCategory =
      !!cat && /(dining|restaurant|food|meal|breakfast|brunch|lunch|dinner|caf[eé]|coffee|bar|drinks|bakery|boulangerie|bistro|brasserie|patisserie|p[âa]tisserie)/.test(cat);
    const mealFromCategory: MealType | null =
      /breakfast/.test(cat) ? 'breakfast' :
      /brunch/.test(cat) ? 'brunch' :
      /lunch/.test(cat) ? 'lunch' :
      /dinner/.test(cat) ? 'dinner' :
      /drinks|bar/.test(cat) ? 'drinks' : null;
    const meal: MealType | null =
      opts?.mealType
      ?? mealFromCategory
      ?? inferMealTypeFromTitle(sanitized)
      ?? inferMealTypeFromTime(opts?.startTime ?? null);
    if (isDiningCategory || meal) {
      return stubFallbackLabel(meal);
    }
  }

  // Wellness placeholder mask — when the activity is a spa/wellness item without
  // a verifiable venue (no placeId, no numeric address, generic title), surface a
  // clear "find a venue" affordance instead of a fake-sounding treatment name.
  if (sanitized) {
    const probe: WellnessActivityShape = opts?.activity
      ? {
          ...opts.activity,
          title: sanitized,
          category: opts.activity.category ?? opts?.category,
        }
      : { title: sanitized, category: opts?.category };

    // Hotel / logistics short-circuit — these rows are never wellness even if
    // the title accidentally carries the legacy placeholder string. Strip the
    // "— find a venue" suffix and return the venue/hotel-oriented label so we
    // never surface "Spa Time — find a venue" on a Return-to-Hotel / check-in
    // / transfer / accommodation card.
    const probeCat = String(probe.category || '').toLowerCase();
    const probeVenue = String(probe.location?.name || probe.venue_name || '').trim();
    const HOTEL_VENUE_RE = /\b(hotel|resort|inn|lodge|guesthouse|hostel|palazzo|palace|hyatt|marriott|hilton|ritz|sheraton|westin|four\s+seasons|aman|six\s+senses|st\.?\s+regis|park\s+hyatt|grand\s+hyatt|jw\s+marriott)\b/i;
    const LOGISTICS_TITLE_RE = /^\s*(luggage[\s-]?drop|drop\s+bags|bag[\s-]?drop|check[\s-]?in|check[\s-]?out|checkin|checkout|freshen[\s-]?up|return\s+to|settle\s+in|hotel\s+arrival|arrive\s+at\s+(your\s+)?hotel|transfer\s+to)/i;
    const isHotelOrLogistics =
      ['accommodation', 'stay', 'transport', 'transportation', 'transit', 'logistics', 'flight'].includes(probeCat) ||
      LOGISTICS_TITLE_RE.test(sanitized) ||
      HOTEL_VENUE_RE.test(probeVenue);

    if (isHotelOrLogistics) {
      // Drop any leaked wellness placeholder suffix
      const cleaned = sanitized.replace(/\s*[—–-]\s*find a venue\s*$/i, '').trim();
      return cleaned || (probeVenue ? `Return to ${probeVenue}` : 'Activity');
    }

    // Legacy rescue: server wrote the literal "Spa Time — find a venue"
    // placeholder but kept a real venue on location.name. Rewrite from the
    // venue rather than preserving the placeholder string.
    if (sanitized === WELLNESS_PLACEHOLDER_FALLBACK || /find a venue\s*$/i.test(sanitized)) {
      const venue = probeVenue;
      if (
        venue &&
        venue.length >= 4 &&
        !/^(your hotel|the spa|the wellness|hotel spa)$/i.test(venue)
      ) {
        return `Spa Session at ${venue}`;
      }
    }

    if (isClientPlaceholderWellness(probe)) {
      return WELLNESS_PLACEHOLDER_FALLBACK;
    }
    // Real-venue + generic-title path: the placeholder check returned false
    // because the venue is verified (placeId, allowlist, or numeric address),
    // but the stored title is still a generic stub like "Spa Time". Rewrite
    // it to match the server's "Spa Session at {venue}" shape so users never
    // see "find a venue" next to a real, addressed spa.
    if (hasGenericWellnessTitle(sanitized)) {
      const venue = (probe.location?.name || probe.venue_name || '').trim();
      if (venue && venue.length >= 4) return `Spa Session at ${venue}`;
    }
  }

  return sanitized || 'Activity';
}

/**
 * Sanitize any activity text field (description, tips, insights, etc.)
 * by stripping internal system labels. Lighter than sanitizeActivityName —
 * no dedup logic, just prefix removal.
 */
const SYSTEM_LABEL_RE = /\b(?:EDGE_ACTIVITY|SIGNATURE_MEAL|LINGER_BLOCK|WELLNESS_MOMENT|AUTHENTIC_ENCOUNTER|SOCIAL_EXPERIENCE|SOLO_RETREAT|DEEP_CONTEXT|SPLURGE_EXPERIENCE|VIP_EXPERIENCE|COUPLES_MOMENT|CONNECTIVITY_SPOT|FAMILY_ACTIVITY)\s*:?\s*/gi;

// Strip ALL variants of "check/confirm/verify hours/opening times" notes
const VENUE_DB_NOTE_RE = /\s*[-–—]\s*(?:we\s+)?(?:recommend\s+)?(?:check|confirm|verify|confirming|checking|verifying)\s+(?:the\s+)?(?:opening\s+)?(?:hours|times)\b[^.]*\.?\s*/gi;
const LOCAL_FAVORITE_NOTE_RE = /(?:^|\.\s*)(?:Popular|A local favorite)\s*(?:with locals\s*)?[-–—]\s*(?:check|confirm|we recommend)[^.]*\.?\s*/gi;
const VENUE_SOURCE_RE = /(?:^|[.]\s*)(?:Recommended|Sourced|Verified|Confirmed)\s+(?:by|from|via)\s+(?:our|the)\s+(?:venue|restaurant|local)\s+database[^.]*\.?\s*/gi;
// Strip any sentence containing both confirm/check/verify AND hours/times AND visit/before
const HOURS_VISIT_COMBO_RE = /\s*[-–—]?\s*[^.]*\b(?:confirm|check|verify)\b[^.]*\b(?:hours|times)\b[^.]*\b(?:visit|before)\b[^.]*\.?\s*/gi;

// Parenthetical internal notes referencing archetypes, hard blocks, constraints
const INTERNAL_NOTE_RE = /\s*\((?:Note|NB|Scheduled|Adjusted|Adjusting|Selected|Chosen|Added|Included|Placed|Moved|Reason|Context|Rationale|Per|As per|Based on|Due to|Reflecting|To reflect|To match|To align|To satisfy|To address|This is a|This serves|This provides|This fulfills)\b[^)]*\)/gi;
const USER_PREF_NOTE_RE = /\s*\([^)]*(?:user's|user preference|archetype|arche\b|interest\b|hard block|soft block|constraint|slot\s+logic|post-process|as per)\b[^)]*\)/gi;

// AI reasoning sentences: "Since the traveler..."
const AI_REASONING_RE = /(?:^|\.\s*)Since\s+(?:the|this|your)\s+(?:traveler|user|guest|visitor|group)\s+[^.]*\./gi;

// Meta-commentary: "This focuses on / ensures / provides..."
const META_COMMENTARY_RE = /(?:^|\.\s*)This\s+(?:focuses on|ensures|provides|creates|offers|gives|delivers|serves as)\s+[^.]*\.?/gi;

// Sentences mentioning internal system terms
const SYSTEM_TERM_RE = /(?:^|\.\s*)[^.]*\b(?:archetype|hard\s+block|soft\s+block|generation\s+rule|as per arche)\b[^.]*\.?/gi;
const VOYANCE_PICK_RE = /\s*(?:Voyance\s+Pick|Hotel\s+Pick)\s*/gi;

// Prompt-template label leaks: "Reservation Urgency: .", "Booking Window: 1 week.",
// "Lead Time: 2-4 weeks." — labels echoed from the generator prompt that should
// never appear in user-facing description/tips. See
// supabase/functions/_shared/prompt-leak-scrub.ts for the server-side twin.
const RESERVATION_LABEL_LEAK_RE =
  /\b(?:(?:Reservation|Booking)\s+(?:Urgency|Window|Lead\s*Time)|Lead\s*Time)\s*:\s*[^.\n]*\.?/gi;
// Orphan "Label: ." with empty/dot-only value occupying its own segment.
const ORPHAN_EMPTY_LABEL_RE =
  /(?:^|(?<=[.!?]\s)|\n)\s*[A-Z][A-Za-z][A-Za-z ]{1,40}\s*:\s*[.\u2026]?\s*(?=$|\n|[.!?]\s|[A-Z])/g;

export function sanitizeActivityText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    // Repair orphaned "City" gap (e.g. "Explore the of Paris Museum…")
    .replace(/\bthe\s+of\s+(?=[A-Z])/g, 'the City of ')
    // Repair orphan possessive "the's" / "the' s" → "the city's"
    // (e.g. "A sensory retreat at the's historic mosque")
    .replace(/\bthe['’]\s?s\b/gi, "the city's")
    // Repair ", the of <Proper>" → ", the City of <Proper>"
    .replace(/,\s*the\s+of\b/gi, ', the City of')
    .replace(SYSTEM_LABEL_RE, '')
    .replace(VOYANCE_PICK_RE, '')
    // Strip any Voyance branding text that leaks into descriptions
    .replace(/\s*(?:Thank you for (?:choosing|using) Voyance|Powered by Voyance|Generated by Voyance|Voyance recommends|A Voyance recommendation|Curated by Voyance|Brought to you by Voyance)\.?\s*/gi, '')
    // Catch any sentence containing "choosing/using/by Voyance"
    .replace(/[^.]*\b(?:choosing|using|by)\s+Voyance\b[^.]*\.?\s*/gi, '')
    .replace(VENUE_DB_NOTE_RE, '')
    .replace(LOCAL_FAVORITE_NOTE_RE, '')
    .replace(VENUE_SOURCE_RE, '')
    .replace(HOURS_VISIT_COMBO_RE, '')
    .replace(AI_QUALIFIER_RE, '')
    .replace(TRAILING_OR_QUALIFIER_RE, '')
    .replace(SLOT_PREFIX_RE, '')
    .replace(PROMPT_ARTIFACT_REPLACE_RE, '')
    .replace(FULFILLS_RE, ' ')
    .replace(META_DISTANCE_COST_RE, '')
    .replace(INLINE_META_RE, '')
    .replace(INTERNAL_NOTE_RE, '')
    .replace(USER_PREF_NOTE_RE, '')
    .replace(AI_REASONING_RE, '')
    .replace(META_COMMENTARY_RE, '')
    .replace(SYSTEM_TERM_RE, '')
    // Strip "Popular with locals" and similar database stub phrases when embedded inline
    .replace(/\s*[-–—]?\s*(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Well[- ]known (?:locally|spot)|Hidden gem|Must[- ]visit|Highly recommended|A must[- ]try|Local institution|Neighborhood favou?rite|A true gem|Worth (?:a|the) visit)\.?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
