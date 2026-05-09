/**
 * Orphan-transit cleanup.
 *
 * Transit connectors ("Walk to X", "Travel to X", "Transfer to X") are
 * generated BEFORE downstream filters (cross-city drop, placeholder strip).
 * When the destination card disappears, the transit card is left pointing at
 * a venue that no longer exists in the day. This helper finds those orphans
 * and drops them.
 *
 * Heuristic: a transit card is "orphaned" when it's either
 *   1. The last card in the day (nothing left to travel to), OR
 *   2. The "to <X>" target name (parsed from title) does not appear in any
 *      following activity's title or venue name.
 */

const TRANSIT_CATS = new Set(['transport', 'transit']);
const TRANSIT_TITLE_RE = /^\s*(?:walk|travel|transfer|drive|ride|taxi|train|bus|metro|tram|ferry|boat|water taxi|vaporetto)\s+to\s+(.+?)\s*$/i;
/**
 * Logistics destinations whose transit card legitimately ends the day —
 * the actual flight/train card lives in trip metadata, not activities.
 * Don't drop these as "orphaned end-of-day transit".
 */
const LOGISTICS_TARGET_RE = /\b(airport|station|terminal|port|cruise terminal|ferry terminal|train station|gare|stazione|hbf|hauptbahnhof)\b/i;

export function isTransitActivity(act: any): boolean {
  if (!act) return false;
  const cat = String(act.category || '').toLowerCase();
  if (TRANSIT_CATS.has(cat)) return true;
  const title = String(act.title || '');
  return TRANSIT_TITLE_RE.test(title);
}

/** Extract the "to <X>" destination name from a transit card title. Returns null when not present. */
export function extractTransitTarget(act: any): string | null {
  const title = String(act?.title || '');
  const m = title.match(TRANSIT_TITLE_RE);
  if (!m) return null;
  return m[1].trim().toLowerCase();
}

function normalize(s: string): string {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Drop transit cards whose target no longer exists in the day. Mutates
 * `activities` in place. Returns the number removed.
 *
 * Locked / user-pinned transit cards are preserved.
 */
export function pruneOrphanTransits(activities: any[]): number {
  if (!Array.isArray(activities) || activities.length === 0) return 0;
  let removed = 0;

  for (let i = activities.length - 1; i >= 0; i--) {
    const act = activities[i];
    if (!act) continue;
    if (act.locked || act.isLocked || act.userPinned) continue;
    if (!isTransitActivity(act)) continue;

    const target = extractTransitTarget(act);

    // Case 1: transit at end of day with no following card → orphaned.
    // Exempt logistics targets (airport/station/port/etc.) — flight/train
    // cards live in trip metadata, so the transfer legitimately ends the day.
    if (i === activities.length - 1) {
      const titleStr = String(act?.title || '');
      const checkBlob = `${target || ''} ${titleStr}`;
      const kind = String(act?.transportation?.kind || act?.transport?.kind || '').toLowerCase();
      const isDepartureMeta = kind === 'departure' || kind === 'airport_transfer' || kind === 'flight_transfer';
      if (LOGISTICS_TARGET_RE.test(checkBlob) || isDepartureMeta) continue;
      activities.splice(i, 1);
      removed++;
      console.warn(`[ORPHAN-TRANSIT] Dropped end-of-day transit: "${act.title}"`);
      continue;
    }

    // Case 2: parseable "to X" target — verify some later non-transit card matches.
    if (target) {
      const targetNorm = normalize(target);
      const targetTokens = targetNorm.split(' ').filter(t => t.length >= 4);
      let matched = false;
      for (let j = i + 1; j < activities.length; j++) {
        const next = activities[j];
        if (!next || isTransitActivity(next)) continue;
        const candidates = [
          next.title, next.name,
          next.venue_name, next.venueName,
          next?.location?.name,
        ].filter(Boolean).map(normalize);
        const blob = candidates.join(' | ');
        if (!blob) continue;
        if (blob.includes(targetNorm)) { matched = true; break; }
        if (targetTokens.length > 0 && targetTokens.every(t => blob.includes(t))) {
          matched = true; break;
        }
      }
      if (!matched) {
        activities.splice(i, 1);
        removed++;
        console.warn(`[ORPHAN-TRANSIT] Dropped "${act.title}" — target "${target}" no longer present in day`);
      }
    }
  }

  return removed;
}
