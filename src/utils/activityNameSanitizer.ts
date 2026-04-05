/**
 * Sanitizes activity names by stripping internal system prefixes
 * that should never be shown to users.
 */

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
export function sanitizeActivityName(name: string | undefined | null): string {
  if (!name) return 'Activity';
  
  // Strip stray CJK characters injected by AI models (e.g. 旋)
  let sanitized = name.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, '').trim();
  
  // Strip any system prefixes
  for (const prefix of SYSTEM_PREFIXES) {
    if (sanitized.startsWith(prefix)) {
      sanitized = sanitized.slice(prefix.length).trim();
      break; // Only remove first matching prefix
    }
  }
  
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

  return sanitized || 'Activity';
}

/**
 * Sanitize any activity text field (description, tips, insights, etc.)
 * by stripping internal system labels. Lighter than sanitizeActivityName —
 * no dedup logic, just prefix removal.
 */
const SYSTEM_LABEL_RE = /\b(?:EDGE_ACTIVITY|SIGNATURE_MEAL|LINGER_BLOCK|WELLNESS_MOMENT|AUTHENTIC_ENCOUNTER|SOCIAL_EXPERIENCE|SOLO_RETREAT|DEEP_CONTEXT|SPLURGE_EXPERIENCE|VIP_EXPERIENCE|COUPLES_MOMENT|CONNECTIVITY_SPOT|FAMILY_ACTIVITY)\s*:?\s*/gi;

// Strip "we recommend confirming hours before visiting" and similar venue DB notes
const VENUE_DB_NOTE_RE = /\s*[-–—]\s*(?:we\s+)?recommend\s+confirming\s+hours\s+before\s+visiting\.?/gi;
const LOCAL_FAVORITE_NOTE_RE = /(?:^|[.]\s*)(?:A\s+)?local\s+favorite\s*[-–—]\s*we\s+recommend[^.]*\.?\s*/gi;
const VENUE_SOURCE_RE = /(?:^|[.]\s*)(?:Recommended|Sourced|Verified|Confirmed)\s+(?:by|from|via)\s+(?:our|the)\s+(?:venue|restaurant|local)\s+database[^.]*\.?\s*/gi;

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

export function sanitizeActivityText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(SYSTEM_LABEL_RE, '')
    .replace(VOYANCE_PICK_RE, '')
    .replace(VENUE_DB_NOTE_RE, '')
    .replace(LOCAL_FAVORITE_NOTE_RE, '')
    .replace(VENUE_SOURCE_RE, '')
    .replace(AI_QUALIFIER_RE, '')
    .replace(TRAILING_OR_QUALIFIER_RE, '')
    .replace(SLOT_PREFIX_RE, '')
    .replace(FULFILLS_RE, ' ')
    .replace(META_DISTANCE_COST_RE, '')
    .replace(INLINE_META_RE, '')
    .replace(INTERNAL_NOTE_RE, '')
    .replace(USER_PREF_NOTE_RE, '')
    .replace(AI_REASONING_RE, '')
    .replace(META_COMMENTARY_RE, '')
    .replace(SYSTEM_TERM_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
