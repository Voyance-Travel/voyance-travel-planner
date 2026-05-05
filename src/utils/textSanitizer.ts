/**
 * Text sanitizer - removes em dashes, garbled text, and non-Latin script
 * from user-facing text content.
 */

// Regex to detect non-Latin script blocks (Chinese, Japanese, Korean, Arabic, Cyrillic, Thai)
const NON_LATIN_SCRIPT = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0600-\u06FF\u0400-\u04FF\u0E00-\u0E7F]+/g;

// Regex to detect garbled/corrupted text patterns (nonsensical fragments)
const GARBLED_PATTERN = /(?:[bcdfghjklmnpqrstvwxz]{5,}|[A-Z][a-z]{0,2}[A-Z][a-z]{0,2}[A-Z])/g;

// Regex to detect leaked JSON schema field names in text values
// e.g. "宣,duration:4,practicalTips;|" or ",theme:" or ",title: -" artifacts
const SCHEMA_LEAK_RE = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay)\s*[:;|]\s*[^,;|]*/gi;

/**
 * Replace em dashes (—) with standard dashes ( - ) in any text.
 * Also handles en dashes (–).
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    // Fix orphaned possessive artifact: "the's" / "the' s" → "the city's"
    .replace(/\bthe'\s?s\b/gi, "the city's")
    // Repair orphaned "City" before a proper noun:
    //   "the of Paris"        → "the City of Paris"
    //   "the of Light Museum" → "the City of Light Museum"
    .replace(/\bthe\s+of\s+(?=[A-Z])/g, 'the City of ')
    // Repair dangling articles before punctuation that escaped generation:
    //   "in the." / "of the!" → "in the city." / "of the city!"
    .replace(
      /\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the([.!?,;])/gi,
      '$1 the city$2'
    );
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
  
  // Remove leaked tool-call JSON (e.g. { "action": "extract_trip_details", "action_input": "..." })
  cleaned = cleaned.replace(/\{\s*"action"\s*:\s*"extract_trip_details"\s*,\s*"action_input"\s*:\s*"[\s\S]*?"\s*\}/g, '');
  
  // Strip empty parentheses left after content removal
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  
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
