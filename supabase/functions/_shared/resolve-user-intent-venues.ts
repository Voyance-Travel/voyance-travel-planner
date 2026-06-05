/**
 * resolve-user-intent-venues.ts
 *
 * Turns category-style user requests ("sushi lunch", "rooftop cocktails on day 3",
 * "we want a wine bar dinner") into concrete real venues BEFORE they reach
 * either the AI prompt or the user-anchor pipeline.
 *
 * Without this layer, must-do entries like "sushi lunch" are passed verbatim
 * as activity titles; the LLM then either invents the venue or leaves
 * address/description blank.
 *
 * Resolution order:
 *   1) verified_venues  (city + cuisine/category match)
 *   2) Google Places text search ("<cuisine> <slot> <destination>")
 *   3) INLINE_FALLBACK_RESTAURANTS  (city + slot, cuisine-aware re-ranking)
 *
 * Named-venue entries ("Sukiyabashi Jiro", "Le Bernardin") are detected and
 * skipped — current path handles them.
 */

import { googlePlacesTextSearch, type GoogleCallContext } from './google-api.ts';
import {
  INLINE_FALLBACK_RESTAURANTS,
  getRandomFallbackRestaurant,
  type FallbackRestaurant,
} from '../generate-itinerary/fix-placeholders.ts';
import { detectCrossCityMention } from './cross-city-filter.ts';

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'drinks';

export interface IntentClassification {
  /** 'named' = looks like a proper venue name; 'category' = cuisine+slot;
   *  'event' = sporting/festival/etc handled elsewhere; 'unknown' = leave alone. */
  kind: 'named' | 'category' | 'event' | 'unknown';
  cuisine?: string;
  slot?: MealSlot;
  vibe?: string;
  preferredDay?: number;
  raw: string;
}

// Common cuisine / vibe vocabulary. Order matters: longer phrases first.
const CUISINE_TERMS: Array<{ re: RegExp; tag: string }> = [
  { re: /\bdim\s*sum\b/i,                tag: 'dim sum' },
  { re: /\bwine\s*bar\b/i,               tag: 'wine bar' },
  { re: /\bsushi\b|\bomakase\b/i,        tag: 'sushi' },
  { re: /\bramen\b/i,                    tag: 'ramen' },
  { re: /\bizakaya\b/i,                  tag: 'izakaya' },
  { re: /\bkaiseki\b/i,                  tag: 'kaiseki' },
  { re: /\byakitori\b/i,                 tag: 'yakitori' },
  { re: /\btrattoria\b|\bosteria\b/i,    tag: 'italian trattoria' },
  { re: /\bpizzeria\b|\bpizza\b/i,       tag: 'pizza' },
  { re: /\bpasta\b/i,                    tag: 'pasta' },
  { re: /\btapas\b/i,                    tag: 'tapas' },
  { re: /\bpaella\b/i,                   tag: 'paella' },
  { re: /\bbistro\b|\bbrasserie\b/i,     tag: 'french bistro' },
  { re: /\bsteakhouse\b|\bsteak\b/i,     tag: 'steakhouse' },
  { re: /\bseafood\b|\boyster\b/i,       tag: 'seafood' },
  { re: /\bbbq\b|\bbarbecue\b/i,         tag: 'bbq' },
  { re: /\bdumpling\b/i,                 tag: 'dumplings' },
  { re: /\bnoodle\b/i,                   tag: 'noodles' },
  { re: /\bvegan\b|\bvegetarian\b/i,     tag: 'vegetarian' },
  { re: /\bthai\b/i,                     tag: 'thai' },
  { re: /\bvietnamese\b|\bpho\b/i,       tag: 'vietnamese' },
  { re: /\bkorean\b|\bbbq korean\b/i,    tag: 'korean' },
  { re: /\bchinese\b|\bcantonese\b/i,    tag: 'chinese' },
  { re: /\bindian\b|\bcurry\b/i,         tag: 'indian' },
  { re: /\bmexican\b|\btaco\b/i,         tag: 'mexican' },
  { re: /\bmediterranean\b/i,            tag: 'mediterranean' },
  { re: /\bmichelin\b/i,                 tag: 'michelin' },
  { re: /\bfine\s*dining\b/i,            tag: 'fine dining' },
  { re: /\brooftop\b|\bsky\s*bar\b/i,    tag: 'rooftop' },
  { re: /\bspeakeasy\b/i,                tag: 'speakeasy' },
  { re: /\bcocktail\b/i,                 tag: 'cocktail bar' },
  { re: /\bcafé\b|\bcafe\b/i,            tag: 'cafe' },
  { re: /\bbakery\b|\bpâtisserie\b|\bpatisserie\b/i, tag: 'bakery' },
  { re: /\bbrunch\b/i,                   tag: 'brunch' },
];

const SLOT_TERMS: Array<{ re: RegExp; slot: MealSlot }> = [
  { re: /\bbreakfast\b/i,                slot: 'breakfast' },
  { re: /\bbrunch\b/i,                   slot: 'breakfast' },
  { re: /\blunch\b/i,                    slot: 'lunch' },
  { re: /\bdinner\b|\bsupper\b/i,        slot: 'dinner' },
  { re: /\b(drinks?|cocktails?|nightcap|aperitif|aperitivo)\b/i, slot: 'drinks' },
];

// A "named venue" looks like ≥2 capitalised words OR contains the word "at <Cap>".
const NAMED_VENUE_RE = /(^|[\s"'])([A-Z][\p{L}'’&.-]+(?:\s+[A-Z][\p{L}'’&.-]+){1,})/u;
const NAMED_AT_RE = /\bat\s+([A-Z][\p{L}'’&.-]+(?:\s+[A-Z][\p{L}'’&.-]+){0,})/u;
const DAY_RE = /\bday\s+(\d+)\b/i;

export function classifyIntent(rawText: string): IntentClassification {
  const raw = String(rawText || '').trim();
  if (!raw) return { kind: 'unknown', raw };

  const slotHit = SLOT_TERMS.find((s) => s.re.test(raw));
  const cuisineHit = CUISINE_TERMS.find((c) => c.re.test(raw));
  const dayMatch = raw.match(DAY_RE);
  const preferredDay = dayMatch ? parseInt(dayMatch[1], 10) : undefined;

  // Named-venue detection: strip slot/cuisine words then look for proper-noun.
  const residual = raw
    .replace(/\bday\s+\d+\b/gi, ' ')
    .replace(/\b(breakfast|brunch|lunch|dinner|supper|drinks?|cocktails?|nightcap)\b/gi, ' ')
    .replace(/\b(at|on|for|the|a|an|some)\b/gi, ' ')
    .trim();
  const atMatch = raw.match(NAMED_AT_RE);
  const namedMatch = atMatch || residual.match(NAMED_VENUE_RE);
  const hasNamed = !!namedMatch && (atMatch ? atMatch[1].split(/\s+/).length >= 1 : namedMatch[2].split(/\s+/).length >= 2);

  // If the entry is dominated by a proper-noun phrase (not just a cuisine word
  // accidentally capitalised), treat as named — the existing path handles it.
  if (hasNamed && !cuisineHit) {
    return { kind: 'named', raw, preferredDay };
  }

  // Category intent: a cuisine + slot (or cuisine alone, or slot alone with
  // cuisine inferred from the noun, e.g. "sushi" implies dinner).
  if (cuisineHit || slotHit) {
    // Slot inference for cuisine-only entries.
    let slot: MealSlot | undefined = slotHit?.slot;
    if (!slot && cuisineHit) {
      // Default cuisine→dinner unless it's clearly breakfast-ish.
      slot = /cafe|bakery|brunch/.test(cuisineHit.tag) ? 'breakfast' : 'dinner';
    }
    return {
      kind: 'category',
      cuisine: cuisineHit?.tag,
      slot,
      vibe: cuisineHit?.tag,
      preferredDay,
      raw,
    };
  }

  return { kind: 'unknown', raw, preferredDay };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolvedVenue {
  source: 'verified' | 'google' | 'fallback';
  name: string;
  address: string;
  description?: string;
  price?: number;
  placeId?: string;
  mapLink?: string;
  cuisine?: string;
  slot?: MealSlot;
}

export interface ResolveContext {
  destination: string;
  supabase?: any; // service-role client (optional — verified_venues skipped if absent)
  googleCtx?: GoogleCallContext; // skipped if absent
  usedNames?: Set<string>;
}

/**
 * Try `verified_venues` for a city+cuisine/category match.
 */
async function tryVerifiedVenues(
  intent: IntentClassification,
  ctx: ResolveContext,
): Promise<ResolvedVenue | null> {
  if (!ctx.supabase || !ctx.destination) return null;
  const city = ctx.destination.split(',')[0].trim();
  if (!city) return null;
  try {
    const categories = ['restaurant', 'dining', 'cafe', 'bakery'];
    if (intent.slot === 'drinks') categories.push('bar', 'nightlife');
    const { data } = await ctx.supabase
      .from('verified_venues')
      .select('name, address, category, types, place_id, description, price_level')
      .ilike('destination', `%${city}%`)
      .in('category', categories)
      .limit(40);
    if (!Array.isArray(data) || data.length === 0) return null;

    const cuisineTokens = intent.cuisine?.toLowerCase().split(/\s+/) ?? [];
    const used = ctx.usedNames ?? new Set<string>();

    const ranked = data
      .filter((v: any) => {
        const name = String(v.name || '').toLowerCase();
        if (!name || used.has(name)) return false;
        if (detectCrossCityMention(v.name, ctx.destination)) return false;
        if (detectCrossCityMention(v.address || '', ctx.destination)) return false;
        return true;
      })
      .map((v: any) => {
        const hay = `${v.name} ${v.description || ''} ${(v.types || []).join(' ')}`.toLowerCase();
        const score = cuisineTokens.reduce((s, tok) => s + (tok && hay.includes(tok) ? 1 : 0), 0);
        return { v, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || (cuisineTokens.length > 0 && best.score === 0)) return null;

    return {
      source: 'verified',
      name: best.v.name,
      address: best.v.address || ctx.destination,
      description: best.v.description || undefined,
      placeId: best.v.place_id || undefined,
      cuisine: intent.cuisine,
      slot: intent.slot,
    };
  } catch (_e) {
    return null;
  }
}

/**
 * Google Places text search fallback.
 */
async function tryGooglePlaces(
  intent: IntentClassification,
  ctx: ResolveContext,
): Promise<ResolvedVenue | null> {
  if (!ctx.googleCtx) return null;
  const city = ctx.destination.split(',')[0].trim();
  if (!city) return null;
  const parts = [intent.cuisine, intent.slot, city].filter(Boolean);
  const query = parts.join(' ').trim();
  if (!query) return null;
  try {
    const resp = await googlePlacesTextSearch(
      {
        textQuery: query,
        fieldMask: 'places.displayName,places.formattedAddress,places.id,places.editorialSummary,places.priceLevel',
        maxResultCount: 5,
      },
      ctx.googleCtx,
    );
    if (!resp.ok || !resp.data?.places?.length) return null;
    const used = ctx.usedNames ?? new Set<string>();
    for (const p of resp.data.places) {
      const name = p.displayName?.text || '';
      const address = p.formattedAddress || '';
      if (!name) continue;
      const key = name.toLowerCase();
      if (used.has(key)) continue;
      if (detectCrossCityMention(name, ctx.destination)) continue;
      if (detectCrossCityMention(address, ctx.destination)) continue;
      return {
        source: 'google',
        name,
        address: address || ctx.destination,
        description: p.editorialSummary?.text || undefined,
        placeId: p.id,
        cuisine: intent.cuisine,
        slot: intent.slot,
      };
    }
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * Cuisine-aware re-ranking of `INLINE_FALLBACK_RESTAURANTS`.
 */
function tryFallbackPool(
  intent: IntentClassification,
  ctx: ResolveContext,
): ResolvedVenue | null {
  const slot = intent.slot ?? 'dinner';
  const usedRaw = ctx.usedNames ?? new Set<string>();

  // Cuisine re-rank: scan the pool, prefer entries whose name/description
  // mentions the cuisine token.
  const cuisineTokens = intent.cuisine?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (cuisineTokens.length > 0) {
    const cityKey = ctx.destination.toLowerCase().trim();
    let pool: FallbackRestaurant[] | undefined;
    for (const [key, data] of Object.entries(INLINE_FALLBACK_RESTAURANTS)) {
      if (cityKey.includes(key) || key.includes(cityKey)) {
        pool = data[slot] || data['dinner'];
        break;
      }
    }
    if (pool && pool.length > 0) {
      const ranked = pool
        .filter((r) => !usedRaw.has(r.name.toLowerCase()))
        .map((r) => {
          const hay = `${r.name} ${r.description || ''}`.toLowerCase();
          const score = cuisineTokens.reduce((s, tok) => s + (hay.includes(tok) ? 1 : 0), 0);
          return { r, score };
        })
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (best && best.score > 0) {
        return {
          source: 'fallback',
          name: best.r.name,
          address: best.r.address,
          description: best.r.description,
          price: best.r.price,
          cuisine: intent.cuisine,
          slot,
        };
      }
    }
  }

  // No cuisine match — generic slot pick.
  const generic = getRandomFallbackRestaurant(ctx.destination, slot, usedRaw, false);
  if (generic && !generic.needsVenuePick) {
    return {
      source: 'fallback',
      name: generic.name,
      address: generic.address,
      description: generic.description,
      price: generic.price,
      cuisine: intent.cuisine,
      slot,
    };
  }
  return null;
}

/**
 * Walk verified_venues → Google Places → fallback pool. Returns null if all
 * three tiers fail — caller should leave the original entry untouched so
 * the existing AI path can try.
 */
export async function resolveIntentVenue(
  intent: IntentClassification,
  ctx: ResolveContext,
): Promise<ResolvedVenue | null> {
  if (intent.kind !== 'category') return null;

  const verified = await tryVerifiedVenues(intent, ctx);
  if (verified) {
    ctx.usedNames?.add(verified.name.toLowerCase());
    return verified;
  }
  const google = await tryGooglePlaces(intent, ctx);
  if (google) {
    ctx.usedNames?.add(google.name.toLowerCase());
    return google;
  }
  const fallback = tryFallbackPool(intent, ctx);
  if (fallback) {
    ctx.usedNames?.add(fallback.name.toLowerCase());
    return fallback;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

export interface ResolvedMustDoEntry {
  originalText: string;
  intent: IntentClassification;
  resolved?: ResolvedVenue;
  /** Replacement text to feed into parseMustDoInput. Falls back to original. */
  replacementText: string;
}

/**
 * Resolve a flat list of must-do entries. Named/event/unknown entries pass
 * through unchanged. Category entries are upgraded to "<Slot> at <Venue Name>"
 * AND carry the resolved venue payload for downstream anchor seeding.
 */
export async function resolveMustDoList(
  entries: string[],
  ctx: ResolveContext,
): Promise<ResolvedMustDoEntry[]> {
  const out: ResolvedMustDoEntry[] = [];
  for (const original of entries) {
    const intent = classifyIntent(original);
    if (intent.kind !== 'category') {
      out.push({ originalText: original, intent, replacementText: original });
      continue;
    }
    const resolved = await resolveIntentVenue(intent, ctx);
    if (!resolved) {
      out.push({ originalText: original, intent, replacementText: original });
      continue;
    }
    const slotLabel = intent.slot
      ? intent.slot === 'drinks'
        ? 'Drinks'
        : intent.slot.charAt(0).toUpperCase() + intent.slot.slice(1)
      : '';
    const dayPrefix = intent.preferredDay ? `Day ${intent.preferredDay} ` : '';
    const replacementText = slotLabel
      ? `${dayPrefix}${slotLabel} at ${resolved.name}`
      : `${dayPrefix}${resolved.name}`;
    out.push({ originalText: original, intent, resolved, replacementText });
  }
  return out;
}

/**
 * Split `additionalNotes` free text into clauses and resolve each that parses
 * to a category intent. Non-resolvable prose stays in the caller's TRIP PURPOSE
 * paragraph.
 */
export async function extractNotesAnchors(
  notes: string,
  ctx: ResolveContext,
): Promise<ResolvedMustDoEntry[]> {
  if (!notes || !notes.trim()) return [];
  // Split on sentence enders + clear separators. Keep clauses short.
  const clauses = notes
    .split(/[.!?\n]|;\s|,\s+(?=(?:also|and|then|plus|with)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 200);
  return resolveMustDoList(clauses, ctx);
}
