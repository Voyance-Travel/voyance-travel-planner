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
const TEXT_SCHEMA_LEAK = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay|type|slot|isVoyancePick|optionGroup|isOption)(?:\s*[:;|]\s*[^,;|]*)?/gi;
const SYSTEM_PREFIXES_RE = /\b(?:EDGE_ACTIVITY|SIGNATURE_MEAL|LINGER_BLOCK|WELLNESS_MOMENT|AUTHENTIC_ENCOUNTER|SOCIAL_EXPERIENCE|SOLO_RETREAT|DEEP_CONTEXT|SPLURGE_EXPERIENCE|VIP_EXPERIENCE|COUPLES_MOMENT|CONNECTIVITY_SPOT|FAMILY_ACTIVITY)\s*:?\s*/gi;
const AI_QUALIFIER_RE = /\s*\((?:[^)]*?\b(?:alternative|satellite|or\s+high.end|similar|equivalent|comparable)\b[^)]*?)\)/gi;
const TRAILING_OR_QUALIFIER_RE = /\s+or\s+(?:high.end|similar|equivalent|comparable)\b[^,.]*/gi;
const SLOT_PREFIX_RE = /^slot:\s*/i;
const FULFILLS_RE = /\.?\s*Fulfills the\s+[^.]*?(?:slot|requirement|block)\.\s*/gi;
const META_DISTANCE_COST_RE = /\((?:[^)]*?~\d+(?:\.\d+)?(?:km|mi|m)\b[^)]*?)\)/gi;
const INLINE_META_RE = /,?\s*~\d+(?:\.\d+)?(?:km|mi|m)\b,?\s*~?\$?\d+/gi;
const FORWARD_REF_RE = /\.?\s*(?:rest|recharge|prepare|get ready)\s+for\s+tomorrow'?s?\s+[^.]+(?:adventure|day|exploration|experience|excursion)[^.]*\.?/gi;
const TOMORROW_REF_RE = /\b(?:for |before )?tomorrow'?s?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:adventure|exploration|experience|excursion|day|visit)\b[^.]*/gi;

export function sanitizeAITextField(text: string | undefined | null, destination?: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = text
    .replace(CJK_ARTIFACTS, '')
    .replace(TEXT_SCHEMA_LEAK, '')
    .replace(SYSTEM_PREFIXES_RE, '')
    .replace(AI_QUALIFIER_RE, '')
    .replace(TRAILING_OR_QUALIFIER_RE, '')
    .replace(SLOT_PREFIX_RE, '')
    .replace(FULFILLS_RE, ' ')
    .replace(META_DISTANCE_COST_RE, '')
    .replace(INLINE_META_RE, '')
    .replace(FORWARD_REF_RE, '')
    .replace(TOMORROW_REF_RE, '')
    // Strip internal day title prefixes: "Short Trip Berlin Day 3:" etc.
    .replace(/^(?:Short\s+Trip|City\s+Trip|Long\s+Trip|Weekend\s+Trip|Extended\s+Trip)\s+\w+(?:\s+\w+)*\s+Day\s+\d+\s*[:–—-]\s*/i, '')
    // Strip bare "Day N:" prefix
    .replace(/^Day\s+\d+\s*[:–—-]\s*/i, '')
    .replace(/\b(?:BOOK|RESERVE|SECURE)\s+\d[\d-]*\s*(?:WEEKS?|MONTHS?|DAYS?)\s*(?:AHEAD|IN ADVANCE|BEFORE|OUT|EARLY)?\b/gi, '')
    .replace(/[🔴🟡🟢🔵]\s*(?:Book|Reserve|BOOK|RESERVE)[^.]*\.?\s*/g, '')
    .replace(/\b(?:book_now|book_soon|book_early|reserve_early|reserve_now)\b/gi, '')
    .replace(/(?:^|\.\s*)\s*(?:Reservation\s*)?[Uu]rgency[:\s]+\w+\.?\s*/gi, '')
    .replace(/\b(?:BOOK|RESERVE|SECURE)\s+(?:ASAP|IMMEDIATELY|NOW|IN ADVANCE|WELL AHEAD|EARLY)\b/gi, '')
    .replace(/\b(?:Advance|advance)\s+(?:booking|reservation)\s+(?:required|recommended|essential|necessary)\b/gi, '')
    // AI self-referential commentary
    .replace(/(?:^|\.\s*)This\s+(?:addresses|fulfills|satisfies|aligns with|caters to|speaks to|reflects)\s+(?:the|your|their)\s+\w+\s+(?:interest|preference|request|need|requirement)\b[^.]*\.?/gi, '')
    // "Since the traveler/user/guest loves/prefers..." reasoning sentences
    .replace(/(?:^|\.\s*)Since\s+(?:the|this|your)\s+(?:traveler|user|guest|visitor|group)\s+[^.]*\./gi, '')
    // Parenthetical internal notes: (Note: ... archetype/hard block/constraint ...)
    .replace(/\s*\([^)]*?\b(?:arche(?:type)?|hard\s+block|soft\s+block|constraint|slot\s+logic|post-process|as per)\b[^)]*?\)/gi, '')
    // "providing/offering a necessary bridge/transition/balance between..."
    .replace(/,?\s*providing\s+a\s+(?:necessary|needed|important|useful|natural)\s+(?:bridge|transition|balance|buffer|counterpoint)\s+[^.]*\.?/gi, '')
    // "This focuses on/ensures/provides/creates..." meta-commentary
    .replace(/(?:^|\.\s*)This\s+(?:focuses on|ensures|provides|creates|offers|gives|delivers|serves as)\s+[^.]*\.?/gi, '')
    // Any sentence mentioning internal system terms
    .replace(/(?:^|\.\s*)[^.]*\b(?:archetype|hard\s+block|soft\s+block|generation\s+rule|as per arche)\b[^.]*\.?/gi, '')
    // Strip "Voyance Pick" / "Hotel Pick" and variant internal labels
    .replace(/\s*(?:Voyance\s+(?:Pick|Recommendation|Choice)|Hotel\s+Pick|Staff\s+Pick)\s*/gi, '')
    // Strip internal venue database / data-freshness notes
    .replace(/\s*[-–—]\s*(?:we\s+)?recommend\s+confirming\s+hours\s+before\s+visiting\.?/gi, '')
    .replace(/\s*[-–—]?\s*confirm\s+hours\s+before\s+visiting\.?/gi, '')
    .replace(/(?:^|[.]\s*)Recommended\s+by\s+our\s+venue\s+database[^.]*\.?\s*/gi, '')
    .replace(/(?:^|[.]\s*)(?:A\s+)?local\s+favorite\s*[-–—]\s*we\s+recommend[^.]*\.?\s*/gi, '')
    .replace(/(?:^|[.]\s*)(?:Sourced|Verified|Confirmed)\s+(?:from|by|via)\s+(?:our|the)\s+(?:venue|restaurant|local)\s+database[^.]*\.?\s*/gi, '')
    // Deduplicate consecutive repeated words: "Pantheon Pantheon" → "Pantheon"
    .replace(/\b(\w{3,})\s+\1\b/gi, '$1')
    // Catch comma-prefixed schema field names at end of text
    .replace(/,\s*(?:type|category|slot|isVoyancePick|optionGroup|isOption|tags|bookingRequired)\b[^,.]*/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;|:\s-]+|[,;|:\s-]+$/g, '');

  // Replace generic "the destination" with actual city name
  if (destination) {
    result = result.replace(/\b(?:the destination|the city|this destination|this city)\b/gi, destination);
  }

  return result.trim();
}

/**
 * Deep-sanitize all user-facing text fields in a generated day object.
 */
export function sanitizeGeneratedDay(day: any, dayNumber: number, destination?: string): any {
  if (!day || typeof day !== 'object') return day;

  const cleanTitle = sanitizeAITextField(day.title, destination);
  const cleanTheme = sanitizeAITextField(day.theme, destination);
  day.title = cleanTitle || cleanTheme || `Day ${dayNumber}`;
  day.theme = cleanTheme || cleanTitle || day.title;

  if (day.narrative && typeof day.narrative === 'object') {
    if (day.narrative.theme) day.narrative.theme = sanitizeAITextField(day.narrative.theme, destination) || day.theme;
    if (Array.isArray(day.narrative.highlights)) {
      day.narrative.highlights = day.narrative.highlights
        .map((h: string) => sanitizeAITextField(h, destination))
        .filter((h: string) => h.length > 0);
    }
  }

  if (Array.isArray(day.accommodationNotes)) {
    day.accommodationNotes = day.accommodationNotes
      .map((n: string) => sanitizeAITextField(n, destination))
      .filter((n: string) => n.length > 0);
  }
  if (Array.isArray(day.practicalTips)) {
    day.practicalTips = day.practicalTips
      .map((t: string) => sanitizeAITextField(t, destination))
      .filter((t: string) => t.length > 0);
  }

  if (Array.isArray(day.activities)) {
    day.activities = day.activities.map((act: any, idx: number) => {
      if (!act || typeof act !== 'object') return act;
      const cleanActTitle = sanitizeAITextField(act.title, destination);
      const cleanActName = sanitizeAITextField(act.name, destination);
      act.title = cleanActTitle || cleanActName || `Activity ${idx + 1}`;
      act.name = act.title;
      if (act.description) act.description = sanitizeAITextField(act.description, destination) || undefined;
      if (typeof act.tips === 'string') act.tips = sanitizeAITextField(act.tips, destination) || undefined;
      if (act.location && typeof act.location === 'object') {
        if (act.location.name) act.location.name = sanitizeAITextField(act.location.name, destination) || act.location.name;
        if (act.location.address) act.location.address = sanitizeAITextField(act.location.address, destination) || act.location.address;
      }
      if (act.transportation && typeof act.transportation === 'object') {
        if (act.transportation.instructions) act.transportation.instructions = sanitizeAITextField(act.transportation.instructions, destination) || undefined;
        const method = (act.transportation.method || '').toLowerCase();
        if (method === 'walk' || method === 'walking') {
          act.transportation.estimatedCost = { amount: 0, currency: act.transportation.estimatedCost?.currency || 'USD' };
        }
      }
      if (act.voyanceInsight) act.voyanceInsight = sanitizeAITextField(act.voyanceInsight, destination) || undefined;
      if (act.bestTime) act.bestTime = sanitizeAITextField(act.bestTime, destination) || undefined;
      if (act.personalization && typeof act.personalization === 'object') {
        if (act.personalization.whyThisFits) act.personalization.whyThisFits = sanitizeAITextField(act.personalization.whyThisFits, destination) || undefined;
      }
      return act;
    });
  }

  // ---- Meal time validation: fix misplaced meals ----
  if (day.activities && Array.isArray(day.activities)) {
    for (const act of day.activities) {
      const titleLower = (act.title || '').toLowerCase();
      const categoryLower = (act.category || '').toLowerCase();
      const hour = parseInt((act.startTime || '00:00').split(':')[0], 10);

      if ((titleLower.includes('lunch') || categoryLower === 'lunch') && hour >= 17) {
        act.startTime = '12:30';
        act.endTime = '13:30';
      } else if ((titleLower.includes('breakfast') || categoryLower === 'breakfast') && hour >= 14) {
        act.startTime = '08:00';
        act.endTime = '09:00';
      } else if ((titleLower.includes('dinner') || categoryLower === 'dinner') && hour < 11) {
        act.startTime = '19:00';
        act.endTime = '20:15';
      }
    }

    // Re-sort activities chronologically after meal time corrections
    day.activities.sort((a: any, b: any) => {
      const tA = a.startTime || '00:00';
      const tB = b.startTime || '00:00';
      return tA.localeCompare(tB);
    });
  }

  return day;
}

// =============================================================================
// DURATION NORMALIZATION — Render all duration strings consistently
// =============================================================================

/**
 * Normalize a duration string to a consistent format: "X min" or "Xh Y min".
 * Handles: "0:25", "15m", "15 min", "~15 min", "1h 30m", "1h30m", etc.
 */
export function normalizeDurationString(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.replace(/^~\s*/, '').trim();
  if (!cleaned) return '';

  // Parse "H:MM" format (e.g., "0:25", "1:30")
  const hmMatch = cleaned.match(/^(\d+):(\d{2})$/);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = parseInt(hmMatch[2], 10);
    const total = h * 60 + m;
    if (total <= 0) return '';
    if (total < 60) return `${total} min`;
    if (total % 60 === 0) return `${total / 60}h`;
    return `${h}h ${m} min`;
  }

  // Parse existing "Xh Ym" / "X min" / "Xm" formats → re-render consistently
  let totalMins = 0;
  const hMatch = cleaned.match(/(\d+)\s*h/i);
  const mMatch = cleaned.match(/(\d+)\s*m(?:in(?:ute)?s?)?/i);
  if (hMatch) totalMins += parseInt(hMatch[1], 10) * 60;
  if (mMatch) totalMins += parseInt(mMatch[1], 10);

  if (totalMins > 0) {
    if (totalMins < 60) return `${totalMins} min`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m} min`;
  }

  return raw; // Unparseable — pass through
}

// =============================================================================
// PHANTOM HOTEL STRIPPING — Remove fabricated hotel activities when no hotel booked
// =============================================================================

const PHANTOM_HOTEL_TITLE_PATTERNS = [
  /\bcheck[\s-]?in\b/i,
  /\bcheck[\s-]?out\b/i,
  /\breturn to (?:the )?hotel\b/i,
  /\bhotel breakfast\b/i,
  /\bbreakfast at\b.*\bhotel\b/i,
  /\bsettle into\b.*\bhotel\b/i,
  /\bfreshen up\b.*\bhotel\b/i,
  /\brest (?:&|and) recharge\b.*\bhotel\b/i,
  /\bwind down\b.*\bhotel\b/i,
  /\btaxi to (?:the )?hotel\b/i,
  /\btransfer to (?:the )?hotel\b/i,
  /\bback to (?:the )?hotel\b/i,
  /\bnear your hotel\b/i,
  /\bat your hotel\b/i,
  /\bcaf[ée] near.*hotel\b/i,
  /\bsettle in\b/i,
];

const PHANTOM_HOTEL_CATEGORIES = ['hotel_checkin', 'hotel_checkout', 'accommodation'];

// Known luxury hotel brand patterns the AI fabricates
const FABRICATED_HOTEL_RE = /\b(?:Hotel\s+Le\s+\w+|Le\s+Meurice|The\s+Peninsula|Ritz\s+\w+|Four\s+Seasons|Mandarin\s+Oriental|St\.\s*Regis|Park\s+Hyatt|Aman\w*|Rosewood|Waldorf\s+Astoria|W\s+Hotel|Shangri[\s-]La|InterContinental|Sofitel|Fairmont|The\s+Langham|Belmond|Raffles|Oberoi|Taj\s+\w+|Peninsula\s+\w+|Iconic\s+\w+\s+Hotel|The\s+\w+\s+Iconic\b)\b/i;

/**
 * Remove fabricated hotel activities when no hotel is booked.
 * When hasHotel is true, activities are kept as-is.
 *
 * IMPORTANT: Generic placeholder activities like "Check-in at Your Hotel",
 * "Freshen up at Your Hotel", "Return to Your Hotel" are PRESERVED.
 * These are valid structural cards that get patched with real hotel names
 * later via patchItineraryWithHotel. Only activities referencing
 * fabricated specific hotel names (luxury brands the AI hallucinates)
 * are stripped.
 */
export function stripPhantomHotelActivities(day: any, hasHotel: boolean): any {
  if (!day || hasHotel || !Array.isArray(day.activities)) return day;

  // Generic placeholder patterns we MUST keep
  const GENERIC_PLACEHOLDERS = [
    /\byour hotel\b/i,
    /\bthe hotel\b/i,
    /\bhotel check-?in\b/i,
    /\bcheck-?in\s*&\s*refresh\b/i,
    /\bfreshen up\b/i,
    /\breturn to\b/i,
    /\bsettle in\b/i,
    /\bback to\b.*\bhotel\b/i,
    /\bhotel checkout\b/i,
    /\bcheck-?out\b/i,
    /\brest\s*(?:&|and)\s*recharge\b/i,
    /\bwind down\b/i,
  ];

  const isGenericPlaceholder = (title: string): boolean => {
    return GENERIC_PLACEHOLDERS.some(re => re.test(title));
  };

  const before = day.activities.length;
  day.activities = day.activities.filter((act: any) => {
    if (!act) return false;
    const title = (act.title || act.name || '');

    // ALWAYS keep generic placeholder hotel activities — they are structural
    if (isGenericPlaceholder(title)) return true;

    // Only strip activities that reference fabricated specific hotel names
    if (FABRICATED_HOTEL_RE.test(act.title || '') || FABRICATED_HOTEL_RE.test(act.description || '')) {
      return false;
    }

    return true;
  });

  if (day.activities.length < before) {
    console.log(`[stripPhantomHotelActivities] Removed ${before - day.activities.length} fabricated hotel activities (preserved generic placeholders)`);
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
