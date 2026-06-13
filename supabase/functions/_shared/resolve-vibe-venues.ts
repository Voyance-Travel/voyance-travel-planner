/**
 * resolve-vibe-venues — turn a VAGUE travel vibe into a grounded shortlist of
 * REAL, named venues for a destination, using a reasoning model + verification.
 *
 * Motivation: when a user only gives a vibe ("a day in Atlanta for the World
 * Cup, walking around and seeing the sights"), the NL extractor leaves
 * mustDoActivities thin/empty (by design — see chat-trip-planner). Without
 * concrete anchors the day can read as generic. This module reasons over the
 * destination + vibe to propose real attractions, then GROUNDS each one
 * (rejects cross-city hallucinations + generic filler + dupes) so only
 * verifiable, on-destination places survive. The result is fed to the day
 * generator as SOFT suggestions — never locked must-dos.
 *
 * Hallucination defense is the whole point: a reasoning model "finding data
 * the customer wants" is only safe if every suggestion is verified. The model
 * proposes; this module disposes.
 */
import { detectCrossCityMention } from './cross-city-filter.ts';

export interface VibeVenue {
  name: string;
  neighborhood?: string;
  category?: string;
}

export interface ResolveVibeInput {
  /** "Atlanta" or "Atlanta, GA" — the city the day is in. */
  destination: string;
  /** Soft intent / additionalNotes, e.g. "casual walk-around day for the World Cup". */
  vibe: string;
  /** Max verified venues to return. */
  limit?: number;
  budgetTier?: string;
  /** Injected model call (system, user) → raw text. Lets tests run without a network. */
  callModel: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

export function buildVibeSystemPrompt(): string {
  return [
    'You are a local expert. Given a destination and a traveler vibe, list REAL,',
    'currently-operating, well-known attractions or activities IN that exact city',
    'that fit the vibe. Rules:',
    '- Real, specific, named places ONLY. No inventions, no permanently-closed venues.',
    '- Every place MUST be in the named destination city — never a neighboring or',
    '  different city.',
    '- No generic placeholders ("downtown activities", "local spots"). Name the place.',
    '- Output ONLY a JSON array, no prose. Each item: {"name","neighborhood","category"}.',
    '  category is one of: sightseeing, museum, park, landmark, market, food, nightlife,',
    '  shopping, activity.',
  ].join('\n');
}

export function buildVibeUserPrompt(destination: string, vibe: string, limit: number, budgetTier?: string): string {
  const city = destination.split(',')[0].trim();
  return [
    `Destination city: ${city}`,
    `Traveler vibe: ${vibe || 'a balanced first-time day'}`,
    budgetTier ? `Budget: ${budgetTier}` : '',
    `Return up to ${limit} real ${city} places that fit, as a JSON array.`,
  ].filter(Boolean).join('\n');
}

/** Tolerant parse: pull the first JSON array out of a possibly-fenced response. */
export function parseVibeResponse(raw: string): VibeVenue[] {
  if (!raw || typeof raw !== 'string') return [];
  let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];
  text = text.slice(start, end + 1);
  let arr: unknown;
  try { arr = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v: any) => ({
      name: String(v?.name ?? '').trim(),
      neighborhood: v?.neighborhood ? String(v.neighborhood).trim() : undefined,
      category: v?.category ? String(v.category).trim().toLowerCase() : undefined,
    }))
    .filter((v) => v.name.length > 0);
}

// A name with no capitalized word past position 0 and a generic noun is filler.
const GENERIC_NAME_RE = /^(?:the\s+)?(?:downtown|local|nearby|free|fun|cheap|good|popular|various|several|some)?\s*(?:area|activities|things\s+to\s+do|spots?|sights?|attractions?|places?|stuff|nightlife|shopping|food|markets?)\.?$/i;

function looksReal(name: string): boolean {
  const n = name.trim();
  if (n.length < 3) return false;
  if (GENERIC_NAME_RE.test(n)) return false;
  // Require at least one capitalized token (a proper-noun-ish signal).
  return /[A-ZÀ-Þ]/.test(n.replace(/^[a-z]/, ''));
}

/**
 * GROUNDING: keep only verifiable, on-destination, real-looking, unique venues.
 * - reject any venue whose name/neighborhood names a DIFFERENT city
 * - reject generic filler / placeholder names
 * - dedupe by normalized name
 */
export function groundVibeVenues(venues: VibeVenue[], destination: string): VibeVenue[] {
  const seen = new Set<string>();
  const out: VibeVenue[] = [];
  for (const v of venues) {
    if (!looksReal(v.name)) continue;
    const hay = `${v.name} ${v.neighborhood ?? ''}`.trim();
    if (detectCrossCityMention(hay, destination)) continue; // wrong-city hallucination
    const key = v.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Reason → ground → return verified venues (empty array on any failure). */
export async function resolveVibeToVenues(input: ResolveVibeInput): Promise<VibeVenue[]> {
  const { destination, vibe, limit = 6, budgetTier, callModel } = input;
  if (!destination || !callModel) return [];
  try {
    const raw = await callModel(
      buildVibeSystemPrompt(),
      buildVibeUserPrompt(destination, vibe, limit, budgetTier),
    );
    const parsed = parseVibeResponse(raw);
    return groundVibeVenues(parsed, destination).slice(0, limit);
  } catch {
    return [];
  }
}
