/**
 * Shared regex + helpers to strip prompt-template label leaks from
 * user-facing activity body fields (description, tips, notes, etc.).
 *
 * Root cause: `buildReservationUrgencyPrompt()` injects a prompt header
 * ("RESERVATION URGENCY REQUIREMENTS") plus the JSON field name
 * `reservationUrgency`. The model occasionally echoes this label into
 * description/tips as `Reservation Urgency: ` (sometimes with no value
 * and a trailing period). Same shape can occur for sibling labels
 * (`Booking Urgency`, `Reservation Window`, `Booking Window`,
 * `Lead Time`).
 *
 * Used by:
 *  - generate-itinerary/pipeline/repair-day.ts (body-leak scrub)
 *  - generate-itinerary/pipeline/validate-day.ts (body-leak detection)
 *  - generate-itinerary/action-save-itinerary.ts (final pre-persist sweep)
 *  - src/utils/activityNameSanitizer.ts re-implements the same regexes
 *    for the UI sanitizer (kept literal in TS for the front-end bundle).
 *
 * See mem://constraints/itinerary/reservation-urgency-prompt-leak
 */

// Strip the entire "Reservation Urgency: …" / "Booking Urgency: …" segment
// up to the next sentence boundary (or end of string).
// - Tolerates value being empty, a lone period, or any non-period text.
// - Case-insensitive, global.
// Covers spaced label form ("Reservation Urgency:"), camelCase JSON key
// ("reservationUrgency:"), and snake_case ("reservation_urgency:").
export const RESERVATION_LABEL_LEAK_RE =
  /\b(?:reservation[_\s]?urgency|booking[_\s]?(?:urgency|window)|lead[_\s]?time)\s*:\s*[^.\n]*\.?/gi;

// Orphan key:value with an empty / dot-only value occupying its own segment.
// We only strip when the value is empty or a lone punctuation mark so we do
// not eat real "Note: closed Mondays." content. Accepts camelCase JSON keys
// (lowercase first letter) too — that's the `reservationUrgency: .` shape.
export const ORPHAN_EMPTY_LABEL_RE =
  /(?:^|(?<=[.!?]\s)|\n)\s*[A-Za-z][A-Za-z][A-Za-z ]{1,40}\s*:\s*[.\u2026]?\s*(?=$|\n|[.!?]\s|[A-Z])/g;

// Slot-name placeholders the LLM occasionally echoes verbatim into description /
// tips / notes instead of replacing them: "(FLEX_WINDOW)", "(INTEREST_SLOT)",
// "(slot)", "(AESTHETIC slot)", "(NARRATIVE_MOOD)", etc. Mirrors
// persist-day-contract::PROMPT_ARTIFACT_RE and the UI artifact regex for
// system-wide coverage. Two-regex pattern (test/replace) per
// mem://technical/itinerary/stateful-regex-strip-bug.
export const SLOT_PLACEHOLDER_LEAK_TEST_RE =
  /\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|TBD)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/i;
export const SLOT_PLACEHOLDER_LEAK_RE =
  /\s*\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|TBD)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)\s*/gi;

// Requirement-prose leak: "This satisfies your 'Deep Context' requirement."
// Catches the model echoing prompt's requirement language as flavor text.
export const REQUIREMENT_PROSE_LEAK_RE =
  /\s*\bThis\s+(?:satisfies|fulfills|fulfils|meets)\s+(?:your|the)\s+['"\u201C\u201D][^'"\u201C\u201D]{1,60}['"\u201C\u201D]?\s+(?:requirement|criterion|criteria|need)s?\s*\.?\s*/gi;

const BODY_FIELDS = [
  'description',
  'tips',
  'tip',
  'insiderTip',
  'insider_tip',
  'notes',
  'note',
  'details',
  'longDescription',
  'long_description',
] as const;

function scrubString(s: unknown): string | null {
  if (typeof s !== 'string' || !s) return null;
  const before = s;
  const after = s
    .replace(RESERVATION_LABEL_LEAK_RE, '')
    .replace(ORPHAN_EMPTY_LABEL_RE, '')
    .replace(SLOT_PLACEHOLDER_LEAK_RE, '')
    .replace(REQUIREMENT_PROSE_LEAK_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
  return after === before ? null : after;
}

export interface BodyLeakScrubResult {
  changed: boolean;
  fields: string[];
}

/**
 * In-place scrub of all known body fields on an activity. Returns which
 * fields were modified for observability.
 */
export function scrubBodyPromptLeaks(act: any): BodyLeakScrubResult {
  if (!act || typeof act !== 'object') return { changed: false, fields: [] };
  const fields: string[] = [];
  for (const key of BODY_FIELDS) {
    const next = scrubString(act[key]);
    if (next !== null) {
      act[key] = next;
      fields.push(key);
    }
  }
  return { changed: fields.length > 0, fields };
}

/**
 * Pure detector — does any body field contain a known prompt-leak pattern?
 * Cheap to call from validate-day.
 */
export function hasBodyPromptLeak(act: any): { field: string } | null {
  if (!act || typeof act !== 'object') return null;
  for (const key of BODY_FIELDS) {
    const v = act[key];
    if (typeof v !== 'string' || !v) continue;
    // Reset lastIndex on the global regex before each .test()
    RESERVATION_LABEL_LEAK_RE.lastIndex = 0;
    ORPHAN_EMPTY_LABEL_RE.lastIndex = 0;
    REQUIREMENT_PROSE_LEAK_RE.lastIndex = 0;
    if (
      RESERVATION_LABEL_LEAK_RE.test(v) ||
      ORPHAN_EMPTY_LABEL_RE.test(v) ||
      SLOT_PLACEHOLDER_LEAK_TEST_RE.test(v) ||
      REQUIREMENT_PROSE_LEAK_RE.test(v)
    ) {
      return { field: key };
    }
  }
  return null;
}

const TITLE_FIELDS = ['title', 'name', 'subtitle'] as const;

/**
 * Title-side scrub for the same prompt-template label leaks. Card titles
 * occasionally include "Reservation Urgency: ." when the model misroutes the
 * urgency value into the title slot. Also collapses an empty/dot-only
 * `reservationUrgency` JSON field so the UI badge stops rendering "Reservation
 * Urgency: ." See plan.md §2.
 */
export function scrubTitleLeaks(act: any): BodyLeakScrubResult {
  if (!act || typeof act !== 'object') return { changed: false, fields: [] };
  const fields: string[] = [];
  for (const key of TITLE_FIELDS) {
    const next = scrubString(act[key]);
    if (next !== null) {
      // Never blank a title — fall back to a safe placeholder
      act[key] = next || (key === 'title' || key === 'name' ? 'Activity' : '');
      fields.push(key);
    }
  }
  // reservationUrgency value: drop if it's the leaked label string itself or
  // collapses to empty / a lone period.
  const ru = act.reservationUrgency ?? act.reservation_urgency;
  if (typeof ru === 'string') {
    const trimmed = ru.trim();
    const looksLikeLeak = /^reservation[_\s]?urgency\s*:/i.test(trimmed) || trimmed === '.' || trimmed === '';
    if (looksLikeLeak) {
      delete act.reservationUrgency;
      delete act.reservation_urgency;
      fields.push('reservationUrgency');
    }
  }
  return { changed: fields.length > 0, fields };
}

// ─── Sentence integrity (fragment guard) ────────────────────────────────────
//
// Catches AI-generated sentence fragments that survived the label scrubs:
//   - "spot for together"  → dangling preposition + pronoun, no subject
//   - "perfect for two together."
//   - "ideal with for both."
//   - "Good for ."  → trailing preposition before period
//
// We only DROP the broken sentence within a multi-sentence string. Single-
// sentence fields are left alone if dropping would blank them — fragments are
// cosmetic, not safety-critical, and an empty description is worse UX than
// a slightly-off one. (`hasSentenceFragment` still reports them so telemetry
// can surface a count.)
//
// Conservative patterns — only match clear fragments, never legitimate prose.
const FRAGMENT_PATTERNS: RegExp[] = [
  // dangling "<prep> together/two/both" with no preceding noun anchor
  /\b(?:for|with|to|of|on|at|in)\s+(?:together|two|both)\b(?!\s+\w{3,})/i,
  // "<prep> <prep>"  (e.g. "for with", "ideal with for both")
  /\b(?:for|with|to|on|at|in|of)\s+(?:for|with|to|on|at|in|of)\b/i,
  // sentence-end dangling preposition before period: "perfect for ."
  /\b(?:for|with|to|on|at|in|of|by)\s*[.!?]/i,
];

function isFragmentSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  // Whitelist: ≥6 words AND starts with capital → almost certainly real prose
  const words = trimmed.split(/\s+/);
  if (words.length >= 6 && /^[A-Z]/.test(trimmed)) {
    // Still flag if a fragment pattern matches outright
    return FRAGMENT_PATTERNS.some((re) => re.test(trimmed));
  }
  // Short fragments OR non-capitalized starts → check patterns
  return FRAGMENT_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Drop fragment sentences from a string. Returns null if unchanged. Never
 * returns an empty string — if every sentence looks broken, returns null
 * (caller keeps the original; we'd rather show suspicious prose than nothing).
 */
export function scrubSentenceFragments(s: unknown): string | null {
  if (typeof s !== 'string' || !s) return null;
  // Split on sentence boundaries while preserving punctuation
  const parts = s.split(/(?<=[.!?])\s+/);
  if (parts.length < 2) {
    // Single-sentence: only flag, don't strip (would blank the field)
    return null;
  }
  const kept = parts.filter((p) => !isFragmentSentence(p));
  if (kept.length === parts.length) return null;
  if (kept.length === 0) return null;
  const rebuilt = kept.join(' ').replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim();
  return rebuilt === s ? null : rebuilt;
}

/**
 * In-place scrub of fragment sentences across body + title fields. Returns
 * which fields changed.
 */
export function scrubSentenceFragmentsOnAct(act: any): BodyLeakScrubResult {
  if (!act || typeof act !== 'object') return { changed: false, fields: [] };
  const fields: string[] = [];
  for (const key of [...BODY_FIELDS, ...TITLE_FIELDS]) {
    const next = scrubSentenceFragments(act[key]);
    if (next !== null) {
      act[key] = next;
      fields.push(key);
    }
  }
  return { changed: fields.length > 0, fields };
}

export function hasSentenceFragment(act: any): { field: string } | null {
  if (!act || typeof act !== 'object') return null;
  for (const key of [...BODY_FIELDS, ...TITLE_FIELDS]) {
    const v = act[key];
    if (typeof v !== 'string' || !v) continue;
    const parts = v.split(/(?<=[.!?])\s+/);
    if (parts.some(isFragmentSentence)) return { field: key };
  }
  return null;
}

// ─── Phantom event references (schedule-coherent copy) ─────────────────────
//
// Catches description/tip/note sentences that reference a time-bound event
// the day's schedule does not contain — e.g. "leave by 20:30 for tonight's
// Michelin-starred dinner" on a day with no dinner card.
//
// We only DROP the offending sentence within a multi-sentence string; if the
// strip would blank the field we leave the original (mirrors fragment-scrub
// policy — wrong copy is worse than missing copy, but blank cards are worst).
//
// Cross-day references ("tomorrow's flight", "tomorrow's checkout") are out
// of scope here — handled by the departure / bookend pipelines.
//
// See plan: .lovable/plan.md (M1 — Day continuity fix)

export interface DayScheduleSummary {
  hasBreakfast: boolean;
  hasBrunch: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  hasNightcap: boolean;
  /** Lowercased keyword set drawn from titles/categories of every card today. */
  keywords: Set<string>;
}

const STOPWORDS = new Set([
  'the','a','an','at','in','on','for','with','to','of','from','your','our','their',
  'tonight','tomorrow','today','this','that','and','or','then','later','before','after',
  'visit','tour','time','moment','experience','session',
]);

function tokenize(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function startMinutes(act: any): number {
  const t = act?.startTime || act?.start_time || act?.time;
  if (typeof t !== 'string') return -1;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

/**
 * Build a quick-lookup summary of what a day actually contains, used by the
 * phantom-reference scrubber to verify any "tonight's X" / "after the Y"
 * references in copy.
 */
export function buildDayScheduleSummary(activities: any[]): DayScheduleSummary {
  const summary: DayScheduleSummary = {
    hasBreakfast: false, hasBrunch: false, hasLunch: false,
    hasDinner: false, hasNightcap: false, keywords: new Set<string>(),
  };
  if (!Array.isArray(activities)) return summary;
  for (const a of activities) {
    if (!a || typeof a !== 'object') continue;
    const title = String(a.title || a.name || '');
    const cat = String(a.category || '').toLowerCase();
    const slot = String(a.mealSlot || a.meal_slot || '').toLowerCase();
    const start = startMinutes(a);
    const isDining = cat === 'dining' || /^(breakfast|brunch|lunch|dinner|drinks)\b/i.test(title);
    if (isDining) {
      const tl = title.toLowerCase();
      if (slot === 'breakfast' || /\bbreakfast\b/.test(tl)) summary.hasBreakfast = true;
      if (slot === 'brunch' || /\bbrunch\b/.test(tl)) summary.hasBrunch = true;
      if (slot === 'lunch' || /\blunch\b/.test(tl) || (start >= 11 * 60 && start < 15 * 60)) summary.hasLunch = true;
      if (slot === 'dinner' || /\bdinner\b/.test(tl) || (start >= 18 * 60)) summary.hasDinner = true;
      if (/\b(?:nightcap|cocktail|aperitif|drinks)\b/i.test(title) && start >= 20 * 60) summary.hasNightcap = true;
    }
    for (const w of tokenize(title)) summary.keywords.add(w);
    if (cat) summary.keywords.add(cat);
  }
  return summary;
}

// Time-bound reference patterns. Each captures the event noun in group 1 (or
// uses a fixed-meal predicate). Order matters — meal-specific patterns first.
const PHANTOM_REF_PATTERNS: Array<{
  re: RegExp;
  /** Returns true iff schedule has the referenced event. */
  resolves: (m: RegExpExecArray, s: DayScheduleSummary) => boolean;
}> = [
  // "tonight's (Michelin-starred) dinner" / "this evening's dinner"
  {
    re: /\b(?:tonight'?s?|this\s+evening'?s?)\s+(?:[a-z][\w-]*\s+){0,3}?dinner\b/gi,
    resolves: (_m, s) => s.hasDinner,
  },
  // "this afternoon's lunch", "today's lunch"
  {
    re: /\b(?:this\s+afternoon'?s?|today'?s?)\s+(?:[a-z][\w-]*\s+){0,3}?lunch\b/gi,
    resolves: (_m, s) => s.hasLunch,
  },
  // "this morning's breakfast"
  {
    re: /\bthis\s+morning'?s?\s+(?:[a-z][\w-]*\s+){0,3}?breakfast\b/gi,
    resolves: (_m, s) => s.hasBreakfast || s.hasBrunch,
  },
  // "tonight's nightcap / cocktails / drinks"
  {
    re: /\b(?:tonight'?s?|this\s+evening'?s?)\s+(?:nightcap|cocktails?|drinks|aperitifs?)\b/gi,
    resolves: (_m, s) => s.hasNightcap,
  },
  // "leave by HH:MM for [tonight's|the] X" / "head out at HH:MM for X"
  {
    re: /\b(?:leave|depart|head\s+out|set\s+off)\s+(?:by|at)\s+\d{1,2}:\d{2}\s+(?:for|to)\s+(?:tonight'?s?|the|your|this\s+(?:evening'?s?|afternoon'?s?|morning'?s?))?\s*([a-z][\w-]+(?:\s+[a-z][\w-]+){0,4})/gi,
    resolves: (m, s) => {
      const noun = (m[1] || '').toLowerCase();
      if (/\bdinner\b/.test(noun)) return s.hasDinner;
      if (/\blunch\b/.test(noun))  return s.hasLunch;
      if (/\bbreakfast\b/.test(noun)) return s.hasBreakfast || s.hasBrunch;
      // Generic noun — require keyword overlap with day
      return tokenize(noun).some((w) => s.keywords.has(w));
    },
  },
  // "after the museum/tour/visit/show", "before the gallery", "following your tour"
  {
    re: /\b(?:after|before|following|prior\s+to)\s+(?:the|your|tonight'?s?|today'?s?|this\s+(?:evening'?s?|afternoon'?s?|morning'?s?))\s+([a-z][\w-]+(?:\s+[a-z][\w-]+){0,3})/gi,
    resolves: (m, s) => {
      const noun = (m[1] || '').toLowerCase();
      if (/\bdinner\b/.test(noun)) return s.hasDinner;
      if (/\blunch\b/.test(noun))  return s.hasLunch;
      if (/\bbreakfast\b/.test(noun)) return s.hasBreakfast || s.hasBrunch;
      return tokenize(noun).some((w) => s.keywords.has(w));
    },
  },
];

function sentenceHasPhantomRef(sentence: string, summary: DayScheduleSummary): boolean {
  for (const pat of PHANTOM_REF_PATTERNS) {
    pat.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.re.exec(sentence)) !== null) {
      if (!pat.resolves(m, summary)) return true;
      if (m.index === pat.re.lastIndex) pat.re.lastIndex++; // safety
    }
  }
  return false;
}

/**
 * Drop sentences/clauses with phantom event refs.
 *
 * Returns null when nothing changed. Returns "" (empty string) when the
 * entire field was a single phantom-only segment and we chose to blank it
 * (M2 — Madrid Day 2 single-sentence "Leave by 20:30 for tonight's Michelin
 * dinner" leak path). Otherwise returns the rebuilt text.
 *
 * Splits on sentence terminators (.!?) AND clause separators (`;`, em-dash,
 * en-dash with surrounding spaces) so we can drop a single offending clause
 * inside a sentence like "Freshen up at the Ritz; leave by 20:30 for
 * tonight's Michelin dinner."
 */
export function scrubPhantomEventRefsFromString(s: unknown, summary: DayScheduleSummary): string | null {
  if (typeof s !== 'string' || !s) return null;

  // Tokenize keeping the separator with each part so we can rebuild faithfully.
  // Recognized separators: sentence-final (.!?) followed by space, ` ; `, ` — `, ` – `.
  const SEP_RE = /([.!?](?=\s)|;|\s+[\u2014\u2013]\s+)/g;
  const tokens: Array<{ text: string; sep: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const src = s;
  while ((m = SEP_RE.exec(src)) !== null) {
    const text = src.slice(last, m.index);
    tokens.push({ text, sep: m[0] });
    last = m.index + m[0].length;
  }
  const tail = src.slice(last);
  if (tail.length > 0 || tokens.length === 0) tokens.push({ text: tail, sep: '' });

  // Single-segment field — apply phantom-only blanking heuristic.
  if (tokens.length === 1) {
    const only = tokens[0].text;
    if (!sentenceHasPhantomRef(only, summary)) return null;
    // Strip the matched ref(s) from a copy and see what's left of substance.
    let stripped = only;
    for (const pat of PHANTOM_REF_PATTERNS) {
      pat.re.lastIndex = 0;
      stripped = stripped.replace(pat.re, ' ');
    }
    const wordCount = stripped.split(/\s+/).filter(w => w.length >= 3 && /[a-z]/i.test(w)).length;
    // If <3 substantive words remain after stripping the phantom ref, the
    // segment is "essentially only the phantom ref" — blank it. Otherwise
    // preserve (don't destroy a rich single sentence).
    if (wordCount < 3) return '';
    return null;
  }

  // Multi-segment — drop offending segments, rebuild with their separators.
  const keptIdx: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const seg = tokens[i].text.trim();
    if (!seg) continue;
    if (!sentenceHasPhantomRef(seg, summary)) keptIdx.push(i);
  }
  if (keptIdx.length === tokens.length) return null;
  if (keptIdx.length === 0) return null;

  let out = '';
  for (let j = 0; j < keptIdx.length; j++) {
    const idx = keptIdx[j];
    const seg = tokens[idx].text.trim();
    // Use the segment's own separator if it's not the last kept; if the kept
    // segment originally ended a sentence (.!?), preserve that. For clause
    // separators, downgrade trailing separator to ". " so we end up with
    // valid English sentences.
    const sepRaw = tokens[idx].sep;
    let sep = '';
    if (j < keptIdx.length - 1) {
      if (/^[.!?]/.test(sepRaw)) sep = sepRaw + ' ';
      else sep = '. '; // promote ; / dash to sentence break when content is dropped around it
    } else {
      // Last kept — keep its terminator if it had one, else add a period.
      if (/^[.!?]/.test(sepRaw)) sep = sepRaw;
      else if (sepRaw === '') sep = '';
      else sep = '.';
    }
    out += seg + sep;
  }
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([.!?])/g, '$1').trim();
  // Capitalize the first letter of each sentence after a period for readability.
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  return out === s ? null : out;
}

export interface PhantomRefScrubResult { changed: boolean; fields: string[]; stripped: number; }

/** In-place phantom-event-ref scrub across body fields of a single activity. */
export function scrubPhantomEventRefs(act: any, summary: DayScheduleSummary): PhantomRefScrubResult {
  if (!act || typeof act !== 'object') return { changed: false, fields: [], stripped: 0 };
  const fields: string[] = [];
  let stripped = 0;
  for (const key of BODY_FIELDS) {
    const before = act[key];
    const next = scrubPhantomEventRefsFromString(before, summary);
    if (next !== null) {
      // Count dropped sentences for telemetry
      const beforeCount = String(before).split(/(?<=[.!?])\s+/).length;
      const afterCount  = next.split(/(?<=[.!?])\s+/).length;
      stripped += Math.max(0, beforeCount - afterCount);
      act[key] = next;
      fields.push(key);
    }
  }
  return { changed: fields.length > 0, fields, stripped };
}

export function hasTitleLeak(act: any): { field: string } | null {
  if (!act || typeof act !== 'object') return null;
  for (const key of TITLE_FIELDS) {
    const v = act[key];
    if (typeof v !== 'string' || !v) continue;
    RESERVATION_LABEL_LEAK_RE.lastIndex = 0;
    ORPHAN_EMPTY_LABEL_RE.lastIndex = 0;
    REQUIREMENT_PROSE_LEAK_RE.lastIndex = 0;
    if (
      RESERVATION_LABEL_LEAK_RE.test(v) ||
      ORPHAN_EMPTY_LABEL_RE.test(v) ||
      SLOT_PLACEHOLDER_LEAK_TEST_RE.test(v) ||
      REQUIREMENT_PROSE_LEAK_RE.test(v)
    ) {
      return { field: key };
    }
  }
  const ru = act.reservationUrgency ?? act.reservation_urgency;
  if (typeof ru === 'string') {
    const t = ru.trim();
    if (/^reservation[_\s]?urgency\s*:/i.test(t) || t === '.') return { field: 'reservationUrgency' };
  }
  return null;
}
