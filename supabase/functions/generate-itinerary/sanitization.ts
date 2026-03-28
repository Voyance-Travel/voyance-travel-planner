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
const SYSTEM_PREFIXES_RE = /\b(?:EDGE_ACTIVITY|SIGNATURE_MEAL|LINGER_BLOCK|WELLNESS_MOMENT|AUTHENTIC_ENCOUNTER|SOCIAL_EXPERIENCE|SOLO_RETREAT|DEEP_CONTEXT|SPLURGE_EXPERIENCE|VIP_EXPERIENCE|COUPLES_MOMENT|CONNECTIVITY_SPOT|FAMILY_ACTIVITY)\s*:?\s*/gi;
const AI_QUALIFIER_RE = /\s*\((?:[^)]*?\b(?:alternative|satellite|or\s+high.end|similar|equivalent|comparable)\b[^)]*?)\)/gi;
const TRAILING_OR_QUALIFIER_RE = /\s+or\s+(?:high.end|similar|equivalent|comparable)\b[^,.]*/gi;
const SLOT_PREFIX_RE = /^slot:\s*/i;
const FULFILLS_RE = /\.?\s*Fulfills the\s+[^.]*?(?:slot|requirement|block)\.\s*/gi;
const META_DISTANCE_COST_RE = /\((?:[^)]*?~\d+(?:\.\d+)?(?:km|mi|m)\b[^)]*?)\)/gi;
const INLINE_META_RE = /,?\s*~\d+(?:\.\d+)?(?:km|mi|m)\b,?\s*~?\$?\d+/gi;
const FORWARD_REF_RE = /\.?\s*(?:rest|recharge|prepare|get ready)\s+for\s+tomorrow'?s?\s+[^.]+(?:adventure|day|exploration|experience|excursion)[^.]*\.?/gi;

// Leaked AI planning text patterns (narrow — kept for backward compat)
const RESERVATION_URGENCY_RE = /\b[Rr]eservation\s*[Uu]rgency[:\s]+\S+(?:\s*\([^)]*\))?\.?\s*/g;
const BOOK_CODE_RE = /\bbook_(?:now|soon|week_before)\b(?:\s+via\s+[^.]+)?\.?\s*/gi;
const NEXT_DAY_PLANNING_RE = /(?:Tomorrow|Next\s+(?:morning|day))[:\s]*[^.]+\.?\s*/gi;
const REQUIRED_SLOT_RE = /[Tt]he\s+required\s+[''\u2018\u2019][^''\u2018\u2019]+[''\u2018\u2019]\s+(?:interest\s+)?slot\s*[-–—]?\s*/g;
const TRANSPORT_EMOJI_RE = /🚶\s*\d+\s*min\.?\s*/g;
const PARENTHETICAL_META_RE = /\((?:Paid\s+activity|Free\s+to\s+explore[^)]*)\)\s*/gi;
const WALKIN_META_RE = /\bWalk-in\s+OK\b[^.]*\.?\s*/gi;

// ============================================================
// Broad category-based leaked AI text patterns
// ============================================================
// 1. Emoji booking flags: 🔴 Book Now, 🟡 Book 2-4 weeks out, etc.
const EMOJI_BOOKING_FLAG_RE = /[🔴🟡🟢🔵]\s*(?:Book|Reserve|BOOK|RESERVE)[^.]*\.?\s*/g;
// 2. Urgency/Reservation prefix sentences
const URGENCY_PREFIX_RE = /(?:^|\.\s*)\s*(?:Urgency|Reservation\s*urgency|Booking\s*urgency)[:\s]+[^.]+\.?\s*/gi;
// 3. Raw code field assignments (isVoyancePick: true, book_now, walk_in)
const RAW_CODE_FIELD_RE = /\b(?:is[A-Z]\w+|book_(?:now|soon|week_before)|walk_in)\s*[:=]\s*\w+\.?\s*/g;
// 4. All-caps parenthetical meta notes: (TRANSIT INCLUDED IN TIPS), (NOTE: ...)
const ALL_CAPS_META_RE = /\([A-Z][A-Z\s_]{3,}\)/g;
// 5. AI self-commentary about profiles/preferences
const AI_SELF_COMMENTARY_RE = /(?:^|\.\s*)(?:Profile updated|Updated preferences|Based on (?:your|the) profile|Adjusted (?:for|based on)|Per your preferences)[^.]*\.?\s*/gi;
// 6. Alternative suggestions: "Alternative: Narisawa (...)"
const ALTERNATIVE_SUGGESTION_RE = /\s*Alternative:\s*[^.]+\.?\s*/g;
// 7. Standalone boolean field leaks: isVoyancePick: true
const STANDALONE_BOOL_RE = /\s+(?:is[A-Z]\w+):\s*(?:true|false|null)\.?\s*/g;

// Matches "… or a/an [description] like/such as the [Venue]" inline alternatives
const INLINE_ALT_VENUE_RE = /\s+or\s+(?:a|an)\s+[^.]*?(?:like|such\s+as)\s+(?:the\s+)?[A-Z][a-zA-Z\s''\u2018\u2019-]+/gi;

export function sanitizeAITextField(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(CJK_ARTIFACTS, '')
    .replace(TEXT_SCHEMA_LEAK, '')
    .replace(SYSTEM_PREFIXES_RE, '')
    .replace(AI_QUALIFIER_RE, '')
    .replace(TRAILING_OR_QUALIFIER_RE, '')
    .replace(INLINE_ALT_VENUE_RE, '')
    .replace(SLOT_PREFIX_RE, '')
    .replace(FULFILLS_RE, ' ')
    .replace(META_DISTANCE_COST_RE, '')
    .replace(INLINE_META_RE, '')
    .replace(FORWARD_REF_RE, '')
    .replace(RESERVATION_URGENCY_RE, '')
    .replace(BOOK_CODE_RE, '')
    .replace(NEXT_DAY_PLANNING_RE, '')
    .replace(REQUIRED_SLOT_RE, '')
    .replace(TRANSPORT_EMOJI_RE, '')
    .replace(PARENTHETICAL_META_RE, '')
    .replace(WALKIN_META_RE, '')
    .replace(EMOJI_BOOKING_FLAG_RE, '')
    .replace(URGENCY_PREFIX_RE, '')
    .replace(RAW_CODE_FIELD_RE, '')
    .replace(ALL_CAPS_META_RE, '')
    .replace(AI_SELF_COMMENTARY_RE, '')
    .replace(ALTERNATIVE_SUGGESTION_RE, '')
    .replace(STANDALONE_BOOL_RE, '')
    .replace(/\(\s*\)/g, '')
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

      // Clear tips if it duplicates description (common AI leak pattern)
      if (act.description && act.tips) {
        const descNorm = act.description.trim().toLowerCase();
        const tipsNorm = act.tips.trim().toLowerCase();
        if (descNorm === tipsNorm) {
          act.tips = undefined;
        } else if (descNorm.length > 10 && tipsNorm.includes(descNorm)) {
          act.tips = undefined;
        } else if (tipsNorm.length > 10 && descNorm.includes(tipsNorm)) {
          act.tips = undefined;
        }
      }

      return act;
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
// HOTEL NAME ENFORCEMENT — Replace hallucinated hotel brands with "Your Hotel"
// =============================================================================

const KNOWN_HOTEL_BRANDS = [
  'Peninsula', 'Four Seasons', 'Ritz-Carlton', 'Ritz Carlton',
  'Park Hyatt', 'Aman', 'Mandarin Oriental', 'Conrad',
  'St\\. Regis', 'St Regis', 'Waldorf Astoria', 'Shangri-La',
  'InterContinental', 'Andaz', 'W Hotel', 'Edition',
  'Rosewood', 'Bulgari', 'Six Senses', 'Hoshinoya',
  'Palace Hotel', 'Imperial Hotel', 'Hotel Okura',
  'Prince Hotel', 'Cerulean Tower', 'Capitol Hotel',
  'Hyatt Regency', 'Hilton', 'Marriott', 'Westin',
  'Grand Hyatt', 'ANA InterContinental', 'JW Marriott',
  'Fairmont', 'Sofitel', 'Belmond', 'Oberoi',
  'Raffles', 'Banyan Tree', 'Como', 'One&Only',
];

const HOTEL_BRAND_RE = new RegExp(
  `(?:The\\s+)?(?:${KNOWN_HOTEL_BRANDS.join('|')})(?:\\s+(?:Hotel|Resort|Spa|Suites|Tower|Palace|Lodge|Residences|Collection))*(?:\\s+[A-Z][a-zA-Z]+)*(?:\\s+(?:at|in|of|by)\\s+[A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+)*)?`,
  'gi'
);

/**
 * Replaces hallucinated hotel names with "Your Hotel" when no hotel was selected.
 */
export function enforceHotelPlaceholder(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(HOTEL_BRAND_RE, 'Your Hotel');
}

/**
 * Enforces hotel placeholder across an entire generated day object.
 * Only call this when the user has NOT selected a hotel.
 */
export function enforceHotelPlaceholderOnDay(day: any): any {
  if (!day || typeof day !== 'object') return day;

  // Day-level text fields
  if (day.title) day.title = enforceHotelPlaceholder(day.title);
  if (day.theme) day.theme = enforceHotelPlaceholder(day.theme);
  if (typeof day.narrative === 'string') {
    day.narrative = enforceHotelPlaceholder(day.narrative);
  } else if (day.narrative && typeof day.narrative === 'object') {
    if (day.narrative.theme) day.narrative.theme = enforceHotelPlaceholder(day.narrative.theme);
    if (Array.isArray(day.narrative.highlights)) {
      day.narrative.highlights = day.narrative.highlights.map((h: string) => enforceHotelPlaceholder(h));
    }
  }
  if (Array.isArray(day.accommodationNotes)) {
    day.accommodationNotes = day.accommodationNotes.map((n: string) => enforceHotelPlaceholder(n));
  } else if (typeof day.accommodationNotes === 'string') {
    day.accommodationNotes = enforceHotelPlaceholder(day.accommodationNotes);
  }
  if (Array.isArray(day.practicalTips)) {
    day.practicalTips = day.practicalTips.map((t: string) => enforceHotelPlaceholder(t));
  } else if (typeof day.practicalTips === 'string') {
    day.practicalTips = enforceHotelPlaceholder(day.practicalTips);
  }

  // Activity-level text fields
  if (Array.isArray(day.activities)) {
    for (const act of day.activities) {
      if (!act || typeof act !== 'object') continue;
      if (act.title) act.title = enforceHotelPlaceholder(act.title);
      if (act.name) act.name = enforceHotelPlaceholder(act.name);
      if (act.description) act.description = enforceHotelPlaceholder(act.description);
      if (typeof act.tips === 'string') act.tips = enforceHotelPlaceholder(act.tips);
      if (act.voyanceInsight) act.voyanceInsight = enforceHotelPlaceholder(act.voyanceInsight);
      if (act.bestTime) act.bestTime = enforceHotelPlaceholder(act.bestTime);
      if (act.location?.name) act.location.name = enforceHotelPlaceholder(act.location.name);
      if (act.location?.address) act.location.address = enforceHotelPlaceholder(act.location.address);
      if (act.personalization?.whyThisFits) {
        act.personalization.whyThisFits = enforceHotelPlaceholder(act.personalization.whyThisFits);
      }
      if (act.transportation?.instructions) {
        act.transportation.instructions = enforceHotelPlaceholder(act.transportation.instructions);
      }
      if (act.transit?.description) act.transit.description = enforceHotelPlaceholder(act.transit.description);
      if (act.transit?.to) act.transit.to = enforceHotelPlaceholder(act.transit.to);
      if (act.transit?.from) act.transit.from = enforceHotelPlaceholder(act.transit.from);
    }
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
