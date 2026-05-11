/**
 * Save-time twin of repair-day §14b POST-CHECKOUT COHERENCE PRUNE.
 *
 * Runs as a final coherence sweep at action-save-itinerary so even when
 * repair-day was skipped or partial, no non-logistics card survives after
 * the day's checkout row. Locked/user/manual/extracted/pinned rows are
 * exempt — universal locking protocol.
 *
 * See mem://constraints/itinerary/post-checkout-save-time-sweep
 */

const DEPARTURE_ROLES = new Set(['flight', 'airport-transport', 'airport-security']);

function classify(a: any): string {
  const t = String(a?.title || a?.name || '').toLowerCase();
  const cat = String(a?.category || '').toLowerCase();
  if (cat === 'flight' || t.includes('flight departure') || t.includes('departure flight')) return 'flight';
  if (
    t.includes('airport departure') ||
    t.includes('airport security') ||
    t.includes('security and boarding') ||
    t.includes('departure and security')
  ) return 'airport-security';
  if (
    (cat === 'transport' || cat === 'transit' || cat === 'logistics') &&
    (t.includes('airport') || t.includes('transfer to the airport') || t.includes('departure transfer') ||
      t.includes('head to airport') || t.includes('taxi to airport') ||
      (t.includes('transfer to') && (t.includes('airport') || t.includes('station') || t.includes('terminal'))))
  ) return 'airport-transport';
  if ((cat === 'transport' || cat === 'transit') && (t.includes('departure') || t.includes('heading home'))) {
    return 'airport-transport';
  }
  return 'other';
}

function isCheckoutRow(a: any): boolean {
  const t = String(a?.title || a?.name || '').toLowerCase();
  const cat = String(a?.category || '').toLowerCase();
  if (cat !== 'accommodation') return false;
  return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
}

function isLocked(a: any): boolean {
  return Boolean(
    a?.isLocked || a?.userAdded || a?.userEdited || a?.extracted || a?.pinned || a?.isManual,
  );
}

export interface PostCheckoutPruneResult {
  prunedCount: number;
  prunedTitles: string[];
}

/**
 * Mutates `activities` in place. Returns count + titles for telemetry.
 * Safe to call on every day — short-circuits when no checkout row is present.
 */
export function pruneNonLogisticsAfterCheckout(activities: any[]): PostCheckoutPruneResult {
  if (!Array.isArray(activities) || activities.length < 2) {
    return { prunedCount: 0, prunedTitles: [] };
  }

  // Find the LAST checkout row
  let checkoutIdx = -1;
  for (let i = activities.length - 1; i >= 0; i--) {
    if (isCheckoutRow(activities[i])) {
      checkoutIdx = i;
      break;
    }
  }
  if (checkoutIdx === -1) return { prunedCount: 0, prunedTitles: [] };

  const toRemove: any[] = [];
  for (let i = checkoutIdx + 1; i < activities.length; i++) {
    const a = activities[i];
    if (isLocked(a)) continue;
    if (DEPARTURE_ROLES.has(classify(a))) continue;
    toRemove.push(a);
  }

  const prunedTitles: string[] = [];
  for (const act of toRemove) {
    const idx = activities.indexOf(act);
    if (idx !== -1) {
      activities.splice(idx, 1);
      prunedTitles.push(String(act?.title || act?.name || '(unnamed)'));
    }
  }

  return { prunedCount: prunedTitles.length, prunedTitles };
}

// ────────────────────────────────────────────────────────────────────────────
// M2: Save-time twin of repair-day §15z post-transfer prune.
//
// Defense-in-depth for the Madrid failure shape (untimed/late airport transfer
// + dinner that ends after midnight). Repair-day §15z is the contract; this
// runs in action-save-itinerary as a safety net for paths that bypass repair
// (manual edits, optimistic patches, undo/redo on the last day).
// ────────────────────────────────────────────────────────────────────────────

const HHMM_RE = /^(\d{1,2}):(\d{2})/;
function parseHHMMToMin(s: string): number | null {
  const m = HHMM_RE.exec(String(s || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mn)) return null;
  return h * 60 + mn;
}

function isAirportTransferCard(a: any): boolean {
  if (a?.subcategory === 'airport_transfer') return true;
  return classify(a) === 'airport-transport';
}

export function pruneNonLogisticsAfterAirportTransfer(
  activities: any[],
): PostCheckoutPruneResult {
  if (!Array.isArray(activities) || activities.length < 2) {
    return { prunedCount: 0, prunedTitles: [] };
  }

  // Find the latest (last by index) airport-transfer card.
  let transferIdx = -1;
  for (let i = activities.length - 1; i >= 0; i--) {
    if (isAirportTransferCard(activities[i])) { transferIdx = i; break; }
  }
  if (transferIdx === -1) return { prunedCount: 0, prunedTitles: [] };

  const transfer = activities[transferIdx];
  const transferStart = parseHHMMToMin(transfer?.startTime || '');
  if (transferStart === null) return { prunedCount: 0, prunedTitles: [] };

  const toRemove: any[] = [];
  for (let i = 0; i < activities.length; i++) {
    if (i === transferIdx) continue;
    const a = activities[i];
    if (isLocked(a)) continue;
    if (DEPARTURE_ROLES.has(classify(a))) continue;
    if (isCheckoutRow(a)) continue;
    const s = parseHHMMToMin(a?.startTime || '');
    if (s === null) continue;
    // Wrap-past-midnight: a 00:10 dinner after a 13:00 transfer is "after".
    const isPostMidnightWrap = s < 5 * 60 && transferStart > 12 * 60;
    if (s >= transferStart || isPostMidnightWrap) toRemove.push(a);
  }

  const prunedTitles: string[] = [];
  for (const act of toRemove) {
    const idx = activities.indexOf(act);
    if (idx !== -1) {
      activities.splice(idx, 1);
      prunedTitles.push(String(act?.title || act?.name || '(unnamed)'));
    }
  }

  return { prunedCount: prunedTitles.length, prunedTitles };
}
