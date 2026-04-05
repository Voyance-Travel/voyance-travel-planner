/**
 * Sanitization utilities for AI-generated itinerary content.
 * Strips CJK artifacts, schema-leak fragments, and garbled text.
 */

import { extractRestaurantVenueName } from './generation-utils.ts';

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

/**
 * Strip action-verb prefixes from transit destination names.
 * E.g. "Return to Four Seasons" → "Four Seasons"
 */
export function sanitizeTransitDestination(name: string): string {
  if (!name) return name;
  return name
    .replace(/^Return\s+to\s+/i, '')
    .replace(/^Freshen\s+[Uu]p\s+at\s+/i, '')
    .replace(/^Check[\s-]?in\s+at\s+/i, '')
    .replace(/^Check[\s-]?out\s+(?:from|at)\s+/i, '')
    .replace(/^(?:Breakfast|Lunch|Dinner|Brunch|Nightcap|Supper)\s+at\s+/i, '')
    .replace(/^End\s+of\s+Day\s+at\s+/i, '')
    .replace(/^Settle\s+(?:in|into)\s+(?:at\s+)?/i, '')
    .replace(/^Wind\s+Down\s+at\s+/i, '')
    .replace(/^Rest\s+(?:&|and)\s+Recharge\s+at\s+/i, '')
    .trim();
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
    // Strip parenthetical archetype labels: "(Deep Context)", "(Solo Retreat)", etc.
    .replace(/\s*\((?:Deep\s+Context|Solo\s+Retreat|Authentic\s+Encounter|Cultural\s+Highlight|Group\s+Activity|Hidden\s+Gem|Family\s+Stop|Romance\s+Stop|Luxury\s+Stop|Budget\s+Stop|Adventure\s+Stop|Wellness\s+Stop)\)\s*/gi, '')
    // Strip ALL-CAPS archetype labels with explanations: "(DEEP CONTEXT - Historical significance...)"
    .replace(/\s*\((?:DEEP\s+CONTEXT|SOLO\s+RETREAT|AUTHENTIC\s+ENCOUNTER|CULTURAL\s+HIGHLIGHT)\s*[-–—]?\s*[^)]*\)\s*/g, '')
    // Strip "(SOLO RETREAT moment)" and similar
    .replace(/\s*\(\s*(?:SOLO\s+RETREAT|DEEP\s+CONTEXT)\s+\w+\s*\)\s*/gi, '')
    // Strip archetype/category label suffixes: "Name: The Deep Context Stop"
    .replace(/\s*[:–—-]\s*(?:The\s+)?(?:Deep\s+Context|Solo\s+Retreat|Cultural\s+Highlight|Group\s+Activity|Wellness|Food|Shopping|Adventure|Family|Romance|Luxury|Budget|Hidden\s+Gem|Authentic\s+Encounter)(?:\s+Stop)?\s*$/gi, '')
    // Strip label as description prefix: "Solo Retreat: A peaceful..."
    .replace(/^(?:Solo\s+Retreat|Deep\s+Context|The\s+Deep\s+Context\s+Stop|Cultural\s+Highlight|Group\s+Activity|Authentic\s+Encounter|Wellness|Food\s+Stop|Hidden\s+Gem|Adventure|Shopping|Romance|Luxury|Budget)\s*:\s*/gi, '')
    // Catch remaining "... Stop" suffixed labels at end
    .replace(/\s*[:–—-]\s*(?:The\s+)?\w+(?:\s+\w+){0,2}\s+Stop\s*$/gi, '')
    // Strip ALL-CAPS "DISTRICT" from transit/location names
    .replace(/\s+DISTRICT\b/g, '')
    // Strip truncated orphan archetype fragments at start of descriptions
    // "A moment." / "An interest." / "A stop." etc.
    .replace(/^(?:A|An)\s+(?:moment|interest|stop|experience|encounter|retreat|highlight)\.\s*/gi, '')
    // Strip archetype labels in quotes within prose: "your 'Solo Retreat' moment" → ""
    .replace(/\b(?:your|a|an|the|this)\s+['"][A-Za-z\s]+['"]\s+(?:moment|stop|experience|encounter|highlight|retreat)\b\s*/gi, '')
    // Strip full "This is your/a 'Archetype' moment..." sentences
    .replace(/(?:^|\.\s*)This\s+is\s+(?:your|a|an)\s+['"]?(?:Solo\s+Retreat|Deep\s+Context|Authentic\s+Encounter|Cultural\s+Highlight|Hidden\s+Gem|Wellness|Romance|Adventure|Family|Budget|Luxury)['"]?\s+(?:moment|stop|experience|encounter)\b[^.]*\.?\s*/gi, '')
    // Strip "This is a stop/moment/experience focusing/centered/based on..." template language
    .replace(/(?:^|\.\s*)This\s+is\s+a\s+(?:stop|moment|experience)\s+(?:focusing|centered|based)\s+on\s+/gi, '')
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
    // Parenthetical notes containing AI-indicator language (broad catch-all)
    .replace(/\s*\((?:Note|NB|Scheduled|Adjusted|Adjusting|Selected|Chosen|Added|Included|Placed|Moved|Reason|Context|Rationale|Per|As per|Based on|Due to|Reflecting|To reflect|To match|To align|To satisfy|To address|This is a|This serves|This provides|This fulfills)\b[^)]*\)/gi, '')
    // Parenthetical notes referencing user preferences/interests/system terms
    .replace(/\s*\([^)]*(?:user's|user preference|archetype|arche\b|interest\b|hard block|soft block|constraint|slot\s+logic|post-process|as per)\b[^)]*\)/gi, '')
    // "providing/offering a necessary bridge/transition/balance between..."
    .replace(/,?\s*providing\s+a\s+(?:necessary|needed|important|useful|natural)\s+(?:bridge|transition|balance|buffer|counterpoint)\s+[^.]*\.?/gi, '')
    // "This focuses on/ensures/provides/creates..." meta-commentary
    .replace(/(?:^|\.\s*)This\s+(?:focuses on|ensures|provides|creates|offers|gives|delivers|serves as)\s+[^.]*\.?/gi, '')
    // Any sentence mentioning internal system terms
    .replace(/(?:^|\.\s*)[^.]*\b(?:archetype|hard\s+block|soft\s+block|generation\s+rule|as per arche)\b[^.]*\.?/gi, '')
    // Strip "Voyance Pick" / "Hotel Pick" and variant internal labels
    .replace(/\s*(?:Voyance\s+(?:Pick|Recommendation|Choice)|Hotel\s+Pick|Staff\s+Pick)\s*/gi, '')
    // Strip any Voyance branding text that leaks into descriptions
    .replace(/\s*(?:Thank you for (?:choosing|using) Voyance|Powered by Voyance|Generated by Voyance|Voyance recommends|A Voyance recommendation|Curated by Voyance|Brought to you by Voyance)\.?\s*/gi, '')
    // Catch any sentence containing "choosing/using/by Voyance"
    .replace(/[^.]*\b(?:choosing|using|by)\s+Voyance\b[^.]*\.?\s*/gi, '')
    // Strip ALL variants of "check/confirm/verify hours/opening times" notes
    .replace(/\s*[-–—]\s*(?:we\s+)?(?:recommend\s+)?(?:check|confirm|verify|confirming|checking|verifying)\s+(?:the\s+)?(?:opening\s+)?(?:hours|times)\b[^.]*\.?\s*/gi, '')
    // Strip "Popular/A local favorite - check/confirm..." combined sentences
    .replace(/(?:^|\.\s*)(?:Popular|A local favorite)\s*(?:with locals\s*)?[-–—]\s*(?:check|confirm|we recommend)[^.]*\.?\s*/gi, '')
    // Strip any sentence containing both confirm/check/verify AND hours/times AND visit/before
    .replace(/\s*[-–—]?\s*[^.]*\b(?:confirm|check|verify)\b[^.]*\b(?:hours|times)\b[^.]*\b(?:visit|before)\b[^.]*\.?\s*/gi, '')
    // Strip sourced/verified from venue database
    .replace(/(?:^|[.]\s*)(?:Recommended|Sourced|Verified|Confirmed)\s+(?:by|from|via)\s+(?:our|the)\s+(?:venue|restaurant|local)\s+database[^.]*\.?\s*/gi, '')
    // Strip "Popular with locals" and similar database stub phrases when embedded inline
    .replace(/\s*[-–—]\s*(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Hidden gem|Must[- ]visit|Highly recommended|Local institution)\.?\s*/gi, '')
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

    // Fix orphaned articles where city name was dropped
    // "the's" → "Lisbon's"
    result = result.replace(/\bthe's\b/gi, destination + "'s");

    // "in the of [Noun]" title pattern → "in Lisbon, the City of [Noun]"
    result = result.replace(/\bin the of\b/gi, 'in ' + destination + ', the City of');

    // "in the." / "to the." / "of the!" / "of the?" — orphaned article before sentence-end punctuation
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the([.!?])\s*/gi, '$1 ' + destination + '$2 ');

    // "of the," / "to the;" — orphaned article before comma/semicolon
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the([,;]\s)/gi, '$1 ' + destination + '$2');

    // "the [adjective]." — dangling adjective before period (e.g. "the illuminated.")
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the\s+(\w+(?:ed|ful|ous|ic|al|ive|ant|ent))\.\s*/gi, '$1 ' + destination + "'s $2 landscape. ");

    // "to the of" / "of the at" / "of the and" — orphaned article before following preposition/connector
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the\s+(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near|and|or|but|at|with|by|on|where|while|this|that|a|an)\b/gi, '$1 ' + destination + ' $2');

    // "in the" at end of string
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the$/gi, '$1 ' + destination);
  }

  return result.trim();
}

/**
 * Remove duplicated postal-code+city or city-name segments from addresses.
 */
function sanitizeAddress(address: string): string {
  if (!address) return address;
  let result = address.replace(
    /(\d{4,5}[-\s]?\d{3}\s+[A-Za-zÀ-ÿ\s]+),\s*\1/g,
    '$1'
  );
  result = result.replace(
    /\b([A-Za-zÀ-ÿ]{3,}),\s*\1\b/g,
    '$1'
  );
  return result;
}

/**
 * Deep-sanitize all user-facing text fields in a generated day object.
 * @param usedRestaurants - Optional list of restaurant names used on previous days for repeat detection.
 */
export function sanitizeGeneratedDay(day: any, dayNumber: number, destination?: string, usedRestaurants?: string[]): any {
  if (!day || typeof day !== 'object') return day;

  const cleanTitle = sanitizeAITextField(day.title, destination);
  const cleanTheme = sanitizeAITextField(day.theme, destination);
  day.title = cleanTitle || cleanTheme || `Day ${dayNumber}`;
  day.theme = cleanTheme || cleanTitle || day.title;

  if (day.name) {
    day.name = sanitizeAITextField(day.name, destination);
  }

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
        if (act.location.name) act.location.name = sanitizeAddress(sanitizeAITextField(act.location.name, destination) || act.location.name);
        if (act.location.address) act.location.address = sanitizeAddress(sanitizeAITextField(act.location.address, destination) || act.location.address);
      }
      if (act.venue_address) act.venue_address = sanitizeAddress(act.venue_address);
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
      // Safety net: clean transit titles that include embedded action verbs
      // Use title pattern instead of category to catch all transit entries
      const TRANSIT_TITLE_RE = /^(?:Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+/i;
      if (act.title && TRANSIT_TITLE_RE.test(act.title)) {
        act.title = act.title
          .replace(/^Travel\s+to\s+(Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry|Uber)\s+to\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Return\s+to\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Freshen\s+[Uu]p\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Check[\s-]?in\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Check[\s-]?out\s+(?:from|at)\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+(?:Breakfast|Lunch|Dinner|Brunch|Nightcap|Supper)\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+End\s+of\s+Day\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Settle\s+(?:in|into)\s+(?:at\s+)?/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Wind\s+Down\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Rest\s+(?:&|and)\s+Recharge\s+at\s+/i, '$1 to ');
        act.name = act.title;
      }
      // Zero out pricing for obviously free activity types
      // Tier 1 (high confidence): always free — parks, plazas, churches, viewpoints, districts
      // Tier 2 (lower confidence): free only if description says "free" or price is in phantom €20-25 range
      const tier1FreePatterns = /\b(?:park|garden|jardim|viewpoint|miradouro|plaza|praça|praca|square|piazza|platz|church|igreja|basilica|cathedral|dom|riverside|waterfront|riverbank|stroll|walk|district|neighborhood|neighbourhood|bairro|quarter|old\s+town|bookstore|bookshop|livraria|library|biblioteca)\b/i;
      const tier2FreePatterns = /\b(?:bridge|fountain|monument|memorial|statue|arch|gate|market|promenade|boardwalk|trail|path|pier|dock|wharf|embankment)\b/i;

      if (act.cost && typeof act.cost === 'object' && act.cost.amount > 0 && act.cost.amount <= 30) {
        const allTextFields = [
          act.title || '',
          (act as any).venue_name || '',
          act.description || '',
          (act.location as any)?.name || '',
          (act as any).address || '',
          (act as any).place_name || '',
          typeof (act as any).place === 'string' ? (act as any).place : ((act as any).place?.name || ''),
          (act as any).venue || '',
          (act as any).restaurant?.name || '',
          (act as any).restaurant?.description || '',
        ].join(' ');
        const description = act.description || '';

        // Debug: log when miradouro is found in any field
        if (/miradouro/i.test(allTextFields)) {
          console.log(`[sanitize][debug] Miradouro detected in activity "${act.title}", allText: "${allTextFields.substring(0, 200)}"`);
        }

        if (tier1FreePatterns.test(allTextFields)) {
          console.log(`[sanitize] Zeroed phantom cost $${act.cost.amount} on free venue: ${act.title}`);
          act.cost = { amount: 0, currency: act.cost.currency || 'USD' };
        } else if (tier2FreePatterns.test(allTextFields)) {
          const descSaysFree = /\bfree\b/i.test(description);
          const isPhantomPrice = act.cost.amount >= 20 && act.cost.amount <= 25;
          if (descSaysFree || isPhantomPrice) {
            console.log(`[sanitize] Zeroed tier2 phantom cost $${act.cost.amount} on: ${act.title}`);
            act.cost = { amount: 0, currency: act.cost.currency || 'USD' };
          }
      }
      }

      // ---- Dining underpricing floor ----
      const isDining = /dining|restaurant|breakfast|lunch|dinner|brunch/i.test((act.category || '') + ' ' + (act.title || ''));
      if (isDining && act.cost && typeof act.cost === 'object' && act.cost.amount > 0) {
        const combined = ((act.title || '') + ' ' + (act.venue_name || '') + ' ' + (act.description || '') + ' ' + ((act as any).restaurant?.name || '') + ' ' + ((act as any).restaurant?.description || '')).toLowerCase();
        let floor = 0;
        let reason = '';

        // Michelin / fine dining indicators
        if (/michelin\s*3|3[\s-]*star/i.test(combined)) {
          floor = 180; reason = 'Michelin 3-star';
        } else if (/michelin\s*2|2[\s-]*star/i.test(combined)) {
          floor = 120; reason = 'Michelin 2-star';
        } else if (/michelin\s*1|1[\s-]*star|michelin[\s-]*starred/i.test(combined)) {
          floor = 80; reason = 'Michelin 1-star';
        } else if (/tasting menu|fine dining|haute cuisine|degustation|omakase/i.test(combined)) {
          floor = 80; reason = 'Fine dining / tasting menu';
        }

        // Known high-end restaurant names
        if (floor < 60 && /\b(belcanto|alma|feitoria|eleven|loco|ceia|enoteca|sommelier)\b/i.test(combined)) {
          floor = 60; reason = 'Known high-end restaurant';
        }

        // Famous seafood
        if (floor < 40 && /\b(cervejaria|marisqueira|marisquer[ií]a|seafood house)\b/i.test(combined)) {
          floor = 40; reason = 'Famous seafood restaurant';
        }

        // Generic dinner floor
        if (floor < 15 && /dinner/i.test(act.title || '') && act.cost.amount < 15) {
          floor = 15; reason = 'Dinner at named restaurant';
        }

        if (floor > 0 && act.cost.amount < floor) {
          console.warn(`[UNDERPRICED] "${act.title}" at ${act.cost.amount}/pp → corrected to ${floor}/pp (${reason})`);
          act.cost.amount = floor;
        }
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

  // Strip phantom midnight hotel entries at the start of the day
  // These are spillover from the previous day's late activities
  if (day.activities.length > 0) {
    const firstMorningIndex = day.activities.findIndex((a: any) => {
      const hour = parseInt((a.startTime || '06:00').split(':')[0], 10);
      return hour >= 5;
    });
    if (firstMorningIndex > 0) {
      const midnightActivities = day.activities.slice(0, firstMorningIndex);
      const allAreHotelEntries = midnightActivities.every((a: any) =>
        (a.category || '').toLowerCase() === 'accommodation' ||
        (a.category || '').toLowerCase() === 'stay' ||
        (a.type || '').toLowerCase() === 'stay' ||
        /\b(?:return|freshen|check.?in|retire|end.?of.?day|back to|settle|wind down)\b/i.test(a.title || '')
      );
      if (allAreHotelEntries) {
        console.log(`[sanitizeGeneratedDay] Stripped ${firstMorningIndex} pre-dawn hotel phantom(s) from day ${dayNumber}`);
        day.activities = day.activities.slice(firstMorningIndex);
      }
    }
  }

  // Fix hotel name mismatches in "Return to" entries
  for (const act of day.activities) {
    if (/^Return to /i.test(act.title || '') && act.venue_name) {
      const titleHotel = (act.title || '').replace(/^Return to /i, '').trim();
      if (titleHotel !== act.venue_name && act.venue_name.length > 0) {
        act.title = 'Return to ' + act.venue_name;
        act.name = act.title;
      }
    }
  }

  // Detect and clear stub descriptions that are just database descriptor notes
  const STUB_DESC_RE = /^(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Well[- ]known (?:locally|spot)|Hidden gem|Must[- ]visit|Highly recommended|A must[- ]try|Local institution|Neighborhood favou?rite|A true gem|Worth (?:a|the) visit)\.?$/i;

  // Inline regex for stripping stub phrases embedded in longer text
  const STUB_INLINE_RE = /\s*[-–—]?\s*(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Well[- ]known (?:locally|spot)|Hidden gem|Must[- ]visit|Highly recommended|A must[- ]try|Local institution|Neighborhood favou?rite|A true gem|Worth (?:a|the) visit)\.?\s*/gi;

  /** Strip stub text from a string: clear if entire value is stub, else strip inline */
  function stripStubField(val: string | undefined | null): string {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed.length > 0 && trimmed.length < 80 && STUB_DESC_RE.test(trimmed)) return '';
    return val.replace(STUB_INLINE_RE, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  if (day.activities) {
    for (const act of day.activities) {
      // Debug: log which field contains the stub text
      const actJson = JSON.stringify(act);
      if (/popular with locals/i.test(actJson)) {
        console.warn(`[STUB_DEBUG] "Popular with locals" found in activity "${act.title}". Keys with match:`,
          Object.keys(act).filter(k => typeof (act as any)[k] === 'string' && /popular with locals/i.test((act as any)[k])));
      }

      // Walk all top-level string properties
      for (const key of Object.keys(act)) {
        if (typeof (act as any)[key] === 'string') {
          (act as any)[key] = stripStubField((act as any)[key]);
        }
      }

      // Walk nested objects: restaurant, venue, place
      for (const nestedKey of ['restaurant', 'venue', 'place']) {
        const nested = (act as any)[nestedKey];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          for (const key of Object.keys(nested)) {
            if (typeof nested[key] === 'string') {
              nested[key] = stripStubField(nested[key]);
            }
          }
        }
      }
    }
  }

  // ── City-mismatch detection: flag restaurants with addresses outside destination ──
  if (destination && day.activities) {
    const dest = destination.toLowerCase().trim();
    const cityGroups: Record<string, string[]> = {
      portugal: ['lisbon', 'lisboa', 'porto', 'faro', 'algarve', 'coimbra', 'braga', 'funchal', 'sintra', 'cascais', 'estoril', 'albufeira', 'alporchinhos', 'portimão', 'portimao'],
      italy: ['rome', 'roma', 'milan', 'milano', 'florence', 'firenze', 'venice', 'venezia', 'naples', 'napoli', 'turin', 'torino', 'bologna', 'palermo'],
      spain: ['madrid', 'barcelona', 'seville', 'sevilla', 'valencia', 'malaga', 'bilbao', 'granada'],
      france: ['paris', 'lyon', 'marseille', 'nice', 'bordeaux', 'toulouse', 'strasbourg'],
      germany: ['berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'düsseldorf'],
      uk: ['london', 'edinburgh', 'manchester', 'birmingham', 'glasgow', 'liverpool'],
      japan: ['tokyo', 'kyoto', 'osaka', 'hiroshima', 'yokohama', 'nara', 'fukuoka', 'sapporo'],
    };

    let otherCities: string[] = [];
    for (const cities of Object.values(cityGroups)) {
      if (cities.some(c => dest.includes(c) || c.includes(dest))) {
        otherCities = cities.filter(c => !dest.includes(c) && !c.includes(dest));
        break;
      }
    }

    if (otherCities.length > 0) {
      for (const act of day.activities) {
        const address = ((act.address || (act.location as any)?.address || '') as string).toLowerCase();
        if (!address) continue;

        const mentionsOther = otherCities.some(c => address.includes(c));
        const mentionsDest = address.includes(dest) ||
          (dest === 'lisbon' && address.includes('lisboa')) ||
          (dest === 'lisboa' && address.includes('lisbon'));

        if (mentionsOther && !mentionsDest) {
          console.warn(`[sanitize] Restaurant "${act.title}" address mentions another city: ${address}`);
          if (act.cost && typeof act.cost === 'object') {
            (act.cost as any).amount = 0;
          }
        }
      }
    }
  }

  // ── HARD Post-generation restaurant repeat removal ──
  if (usedRestaurants && usedRestaurants.length > 0 && day.activities) {
    const usedNormalized = new Set(usedRestaurants.map(n => extractRestaurantVenueName(n)));
    const DINING_RE = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;
    const beforeCount = day.activities.length;

    day.activities = day.activities.filter((act: any) => {
      const isDining = (act.category || '').toLowerCase() === 'dining' ||
        (act.type || '').toLowerCase() === 'dining' ||
        DINING_RE.test(act.title || '');
      if (!isDining) return true;

      const venueFromTitle = extractRestaurantVenueName(act.title || '');
      const venueFromVenue = act.venue_name ? extractRestaurantVenueName(act.venue_name) : '';
      const venueFromRestaurant = act.restaurant?.name ? extractRestaurantVenueName(act.restaurant.name) : '';
      const venueFromLocation = act.location?.name ? extractRestaurantVenueName(act.location.name) : '';

      const candidates = [venueFromTitle, venueFromVenue, venueFromRestaurant, venueFromLocation].filter(Boolean);

      const isRepeat = candidates.some(c => {
        if (usedNormalized.has(c)) return true;
        // Substring containment fallback for partial matches
        for (const used of usedNormalized) {
          if (used.length >= 3 && c.length >= 3 && (c.includes(used) || used.includes(c))) return true;
        }
        return false;
      });

      if (isRepeat) {
        console.warn(`[sanitize] RESTAURANT REPEAT BLOCKED: "${act.title}" (venues: [${candidates.join(', ')}]) was already used on a previous day — REMOVED`);
        return false; // Hard remove
      }
      return true;
    });

    const removed = beforeCount - day.activities.length;
    if (removed > 0) {
      console.log(`[sanitize] Hard dedup removed ${removed} repeated dining activit${removed === 1 ? 'y' : 'ies'} from day ${dayNumber}`);
    }
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
const FABRICATED_HOTEL_RE = /\b(?:Hotel\s+Le\s+\w+|Le\s+Meurice|The\s+Peninsula|Ritz\s+\w+|Four\s+Seasons|Mandarin\s+Oriental|St\.\s*Regis|Park\s+Hyatt|Aman\w*|Rosewood|Waldorf\s+Astoria|W\s+Hotel|Shangri[\s-]La|InterContinental|Sofitel|Fairmont|The\s+Langham|Belmond|Raffles|Oberoi|Taj\s+\w+|Peninsula\s+\w+|Iconic\s+\w+\s+Hotel|The\s+\w+\s+Iconic\b)\b/gi;

// Broad pattern: any proper-noun hotel name that isn't "Your Hotel" / "The Hotel"
// Matches e.g. "The Pantheon Iconic Rome Hotel", "Grand Hotel Europa", "Villa Medici Resort"
const BROAD_HOTEL_NAME_RE = /(?:The\s+)?(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Hotel|Resort|Inn|Suites?|Lodge|Palace|Boutique\s+Hotel)\b/g;

/**
 * Replace fabricated hotel names with "Your Hotel" when no hotel is booked.
 * When hasHotel is true, activities are kept as-is.
 *
 * IMPORTANT: Generic placeholder activities like "Check-in at Your Hotel",
 * "Freshen up at Your Hotel", "Return to Your Hotel" are PRESERVED.
 * These are valid structural cards that get patched with real hotel names
 * later via patchItineraryWithHotel. Only activities referencing
 * fabricated specific hotel names are replaced with "Your Hotel".
 */
export function stripPhantomHotelActivities(day: any, hasHotel: boolean): any {
  if (!day || hasHotel || !Array.isArray(day.activities)) return day;

  // Generic placeholder patterns we MUST keep untouched
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

  let replacements = 0;
  for (const act of day.activities) {
    if (!act) continue;
    const title = act.title || act.name || '';
    // Skip already-generic placeholders — they're intended
    if (isGenericPlaceholder(title)) continue;

    // Replace fabricated hotel names in all text fields
    for (const field of ['title', 'name', 'description', 'location'] as const) {
      if (typeof act[field] !== 'string') continue;
      // Reset lastIndex for global regexes
      FABRICATED_HOTEL_RE.lastIndex = 0;
      BROAD_HOTEL_NAME_RE.lastIndex = 0;
      const hasFabricated = FABRICATED_HOTEL_RE.test(act[field]);
      BROAD_HOTEL_NAME_RE.lastIndex = 0;
      const hasBroad = BROAD_HOTEL_NAME_RE.test(act[field]);
      if (hasFabricated || hasBroad) {
        FABRICATED_HOTEL_RE.lastIndex = 0;
        BROAD_HOTEL_NAME_RE.lastIndex = 0;
        act[field] = act[field]
          .replace(FABRICATED_HOTEL_RE, 'Your Hotel')
          .replace(BROAD_HOTEL_NAME_RE, 'Your Hotel');
        replacements++;
      }
    }
  }

  if (replacements > 0) {
    console.log(`[stripPhantomHotelActivities] Replaced fabricated hotel names in ${replacements} fields with "Your Hotel"`);
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
