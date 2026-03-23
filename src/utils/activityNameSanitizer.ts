/**
 * Sanitizes activity names by stripping internal system prefixes
 * that should never be shown to users.
 */

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

export function sanitizeActivityText(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(SYSTEM_LABEL_RE, '').replace(/\s{2,}/g, ' ').trim();
}
