/**
 * Text sanitizer - removes em dashes, garbled text, non-Latin script,
 * and internal system annotations from user-facing text content.
 */

// Regex to detect non-Latin script blocks (Chinese, Japanese, Korean, Arabic, Cyrillic, Thai)
const NON_LATIN_SCRIPT = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0600-\u06FF\u0400-\u04FF\u0E00-\u0E7F]+/g;

// Regex to detect garbled/corrupted text patterns (nonsensical fragments)
const GARBLED_PATTERN = /(?:[bcdfghjklmnpqrstvwxz]{5,}|[A-Z][a-z]{0,2}[A-Z][a-z]{0,2}[A-Z])/g;

// Regex to detect leaked JSON schema field names in text values
// e.g. "宣,duration:4,practicalTips;|" or ",theme:" or ",title: -" artifacts
const SCHEMA_LEAK_RE = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay)\s*[:;|]\s*[^,;|]*/gi;

// =============================================================================
// SYSTEM ANNOTATION PATTERNS — internal AI constraint text that must NEVER
// appear in customer-facing output (titles, descriptions, PDF exports).
// =============================================================================
const SYSTEM_ANNOTATION_PATTERNS: RegExp[] = [
  /user[- ]specified must[- ]do activity\.?\s*/gi,
  /DO NOT modify\.?\s*/gi,
  /must[- ]do activity\.?\s*/gi,
  /user'?s?\s+scheduled\s+event\s+for\s+this\s+day\.?\s*/gi,
  /tickets?\/advance\s+booking\s+required\.?\s*/gi,
  /MUST END before \d{1,2}:\d{2}\s*[-–—]\s*must[- ]do activity requires departure by this time\.?\s*/gi,
  /this is your dedicated\s+.+?\s+day\.?\s*/gi,
  /\[LOCKED\]\s*/gi,
  /\[MUST[- ]DO\]\s*/gi,
  /\[USER[- ]CONSTRAINT\]\s*/gi,
  /\[SYSTEM\]\s*/gi,
  /- user's scheduled event.*?(?:\.|$)/gi,
  /Arrive early to get settled and enjoy the full experience\.?\s*/gi,
  // Broader patterns for AI prompt echoes (Fix 23M)
  /&?\s*this is the traveler'?s?\s+(?:must-do|preserve|prebooked).*?\.?\s*/gi,
  /preserve (?:exactly|the title|the time|as given).*?\.?\s*/gi,
  /\[SYSTEM[- ]INSTRUCTION\].*?\.?\s*/gi,
  /MUST END before \d{1,2}:\d{2}.*?(?:\.|$)/gi,
  /must[- ]do activity requires? departure.*?(?:\.|$)/gi,
  /requires? departure by this time.*?\.?\s*/gi,
  /this is your dedicated\s+.+?\s+(?:day|activity|event)\.?\s*/gi,
  /^&\s+/i,
  // Fix 23L: broader patterns for new prompt tags and AI parroting
  /this is (?:your|the traveler'?s?) (?:dedicated|special|main).*?(?:day|experience)\.?\s*/gi,
  /fill this slot.*?\.?\s*/gi,
  /find (?:a|an) (?:morning|afternoon|evening|late) (?:activity|spot|restaurant)\.?\s*/gi,
  /\[CONFIRMED\]\s*/gi,
  /\[SUGGESTED\]\s*/gi,
];

/**
 * Strip internal system annotations from customer-facing text.
 * Use this on activity descriptions and titles before rendering or PDF export.
 */
export function cleanSystemAnnotations(text: string | undefined | null): string {
  if (!text) return '';
  let cleaned = text;
  for (const pattern of SYSTEM_ANNOTATION_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/^[.,;:\-–—\s]+|[.,;:\-–—\s]+$/g, '')
    .trim();
}

/**
 * Replace em dashes (—) with standard dashes ( - ) in any text.
 * Also handles en dashes (–).
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/—/g, ' - ')
    .replace(/–/g, '-');
}

/**
 * Clean AI-generated text by removing non-Latin scripts and garbled fragments.
 * Use this on conversational AI output before rendering.
 */
export function sanitizeAIOutput(text: string | undefined | null): string {
  if (!text) return '';
  let cleaned = text;
  
  // Remove non-Latin script characters (replace with empty or space)
  cleaned = cleaned.replace(NON_LATIN_SCRIPT, '');
  
  // Remove leaked schema field names (e.g. ",duration:4,practicalTips;|")
  cleaned = cleaned.replace(SCHEMA_LEAK_RE, '');
  
  // Strip system annotation patterns
  for (const pattern of SYSTEM_ANNOTATION_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Clean up artifacts: double spaces, trailing fragments, leading/trailing punctuation
  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/^[,;|:\s]+|[,;|:\s]+$/g, '')
    .trim();
  
  return cleaned;
}

/**
 * Detect if a text string contains potentially garbled or corrupted content.
 * Returns true if suspicious patterns are found.
 */
export function hasGarbledContent(text: string): boolean {
  if (!text) return false;
  
  // Check for non-Latin script in what should be English output
  if (NON_LATIN_SCRIPT.test(text)) return true;
  
  // Check for high density of garbled consonant clusters
  const garbledMatches = text.match(GARBLED_PATTERN);
  if (garbledMatches && garbledMatches.length > 2) return true;
  
  return false;
}

/**
 * Sanitize all string fields in an object (shallow, one level deep).
 * Useful for sanitizing activity data from AI.
 */
export function sanitizeObjectStrings<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      (result as any)[key] = sanitizeText(result[key] as string);
    }
  }
  return result;
}
