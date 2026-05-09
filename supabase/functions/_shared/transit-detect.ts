/**
 * Single source of truth for "is this activity a transit/movement card?"
 *
 * Categories accepted: any of the spelling variants the LLM emits.
 * Title fallback: regex prefix match on common transit verbs.
 */
const TRANSIT_CATS = new Set([
  'transit', 'transport', 'transportation', 'travel',
  'transfer', 'commute', 'taxi', 'walking',
]);

const TRANSIT_TITLE_RE = /^\s*(?:walk|walking|travel|transfer|drive|ride|taxi|train|bus|metro|tram|ferry|boat|water taxi|vaporetto|return|return to|head\s+back)\s+/i;

export function isTransitActivity(act: any): boolean {
  if (!act || typeof act !== 'object') return false;
  const cat = String(act.category || act.type || '').toLowerCase();
  if (TRANSIT_CATS.has(cat)) return true;
  const title = String(act.title || act.name || '');
  return TRANSIT_TITLE_RE.test(title);
}

export { TRANSIT_CATS, TRANSIT_TITLE_RE };
