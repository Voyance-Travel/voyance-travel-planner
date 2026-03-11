/**
 * Sanitization utilities for AI-generated itinerary content.
 * Strips CJK artifacts, schema-leak fragments, and garbled text.
 */

// =============================================================================
// DATE SANITIZATION — Strip non-ASCII chars that leak from CJK locale prompts
// =============================================================================
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sanitize a single date string: extract the YYYY-MM-DD portion and discard
 * any trailing garbage (e.g. Chinese characters like "控制").
 * Returns the cleaned date or the provided fallback.
 */
export function sanitizeDateString(raw: unknown, fallback?: string): string {
  if (typeof raw !== 'string') return fallback || '';
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (match && DATE_REGEX.test(match[0])) return match[0];
  if (fallback && DATE_REGEX.test(fallback)) return fallback;
  console.warn(`[sanitizeDateString] Could not extract valid date from: "${raw}"`);
  return fallback || '';
}

/**
 * Strip isOption/optionGroup fields from AI response and deduplicate
 * activities that share an optionGroup (keep only the first per group).
 */
export function sanitizeOptionFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj.activities)) {
    const seenGroups = new Set<string>();
    obj.activities = obj.activities.filter((act: any) => {
      if (act && typeof act === 'object') {
        if (act.optionGroup) {
          if (seenGroups.has(act.optionGroup)) return false;
          seenGroups.add(act.optionGroup);
        }
        delete act.isOption;
        delete act.optionGroup;
      }
      return true;
    });
  }

  if (Array.isArray(obj.days)) {
    for (const day of obj.days) {
      sanitizeOptionFields(day);
    }
  }

  return obj;
}

// =============================================================================
// DEEP TEXT SANITIZATION — Strip CJK artifacts & schema-leak fragments
// =============================================================================
const CJK_ARTIFACTS = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F]+/g;
const TEXT_SCHEMA_LEAK = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay)\s*[:;|]\s*[^,;|]*/gi;

// System instruction patterns that should NEVER appear in customer-facing text
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
];

export function sanitizeAITextField(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text
    .replace(CJK_ARTIFACTS, '')
    .replace(TEXT_SCHEMA_LEAK, '');

  // Strip system annotation patterns
  for (const pattern of SYSTEM_ANNOTATION_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;|:\s-]+|[,;|:\s-]+$/g, '')
    .trim();
}

/**
 * Deep-sanitize all user-facing text fields in a generated day object.
 */
export function sanitizeGeneratedDay(day: any, dayNumber: number): any {
  if (!day || typeof day !== 'object') return day;

  const cleanTitle = sanitizeAITextField(day.title);
  const cleanTheme = sanitizeAITextField(day.theme);
  day.title = cleanTitle || cleanTheme || `Day ${dayNumber}`;
  day.theme = cleanTheme || cleanTitle || day.title;

  if (day.narrative && typeof day.narrative === 'object') {
    if (day.narrative.theme) day.narrative.theme = sanitizeAITextField(day.narrative.theme) || day.theme;
    if (Array.isArray(day.narrative.highlights)) {
      day.narrative.highlights = day.narrative.highlights
        .map((h: string) => sanitizeAITextField(h))
        .filter((h: string) => h.length > 0);
    }
  }

  if (Array.isArray(day.accommodationNotes)) {
    day.accommodationNotes = day.accommodationNotes
      .map((n: string) => sanitizeAITextField(n))
      .filter((n: string) => n.length > 0);
  }
  if (Array.isArray(day.practicalTips)) {
    day.practicalTips = day.practicalTips
      .map((t: string) => sanitizeAITextField(t))
      .filter((t: string) => t.length > 0);
  }

  if (Array.isArray(day.activities)) {
    day.activities = day.activities.map((act: any, idx: number) => {
      if (!act || typeof act !== 'object') return act;
      const cleanActTitle = sanitizeAITextField(act.title);
      const cleanActName = sanitizeAITextField(act.name);
      act.title = cleanActTitle || cleanActName || `Activity ${idx + 1}`;
      act.name = act.title;
      if (act.description) act.description = sanitizeAITextField(act.description) || undefined;
      if (typeof act.tips === 'string') act.tips = sanitizeAITextField(act.tips) || undefined;
      if (act.location && typeof act.location === 'object') {
        if (act.location.name) act.location.name = sanitizeAITextField(act.location.name) || act.location.name;
        if (act.location.address) act.location.address = sanitizeAITextField(act.location.address) || act.location.address;
      }
      if (act.transportation && typeof act.transportation === 'object') {
        if (act.transportation.instructions) act.transportation.instructions = sanitizeAITextField(act.transportation.instructions) || undefined;
        const method = (act.transportation.method || '').toLowerCase();
        if (method === 'walk' || method === 'walking') {
          act.transportation.estimatedCost = { amount: 0, currency: act.transportation.estimatedCost?.currency || 'USD' };
        }
      }
      if (act.voyanceInsight) act.voyanceInsight = sanitizeAITextField(act.voyanceInsight) || undefined;
      if (act.bestTime) act.bestTime = sanitizeAITextField(act.bestTime) || undefined;
      if (act.personalization && typeof act.personalization === 'object') {
        if (act.personalization.whyThisFits) act.personalization.whyThisFits = sanitizeAITextField(act.personalization.whyThisFits) || undefined;
      }
      return act;
    });
  }

  return day;
}

export function sanitizeDateFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDateFields);
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string' && /date/i.test(key)) {
        const cleaned = sanitizeDateString(obj[key]);
        if (cleaned !== obj[key]) {
          console.warn(`[sanitizeDateFields] Cleaned "${key}": "${obj[key]}" → "${cleaned}"`);
          obj[key] = cleaned;
        }
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeDateFields(obj[key]);
      }
    }
  }
  return obj;
}
