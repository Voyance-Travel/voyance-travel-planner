/**
 * Airport-transit classifier.
 *
 * Single source of truth for "this card is a ground transfer to/from an
 * airport, NOT a walk." Forces method=taxi and caps duration so the
 * LLM-emitted "Walk to Transfer to Airport — 1h 46m" class of bug cannot
 * survive the pipeline.
 *
 * Wired at:
 *   - pipeline/repair-day.ts §15z (after enforceDepartureDayLogistics)
 *   - pipeline/repair-day.ts §15b (alongside pickTransitTier rewrites)
 *   - generate-itinerary/action-save-itinerary.ts STEP 2.65 (save-time net)
 *
 * Memory: mem://constraints/itinerary/airport-transit-must-be-taxi
 */

const FLIGHT_CAT_RE = /^(flight|flights)$/i;
const AIRPORT_TITLE_RE = /\b(airport|terminal|to (?:the )?(?:airport|terminal))\b/i;
// "Walk to ", "Travel to ", "Stroll to " — the title prefix the LLM emits.
const WALK_PREFIX_RE = /^\s*(walk|stroll|walking|travel)\s+(to|toward|towards)\s+/i;

export interface AirportTransitOptions {
  /** Reasonable taxi/rideshare duration in minutes (default 45). */
  transferMinutes?: number;
}

export function isAirportTransitCard(card: any): boolean {
  if (!card || typeof card !== 'object') return false;

  // Flight cards are NOT transit — leave them alone.
  const cat = String(card.category || card.type || '').toLowerCase();
  if (FLIGHT_CAT_RE.test(cat)) return false;
  if (cat === 'accommodation' || cat === 'lodging' || cat === 'stay') return false;

  // Explicit sentinel (set by enforceDepartureDayLogistics).
  const sub = String(card.subcategory || '').toLowerCase();
  if (sub === 'airport_transfer' || sub === 'transfer-to-airport') return true;

  // Must be a transport-ish category to be considered a "transit" card at all.
  // (Otherwise we'd hit a real sightseeing activity that happens to mention
  // "airport" in its description.)
  const isTransitish =
    cat === 'transport' || cat === 'transit' || cat === 'logistics' ||
    cat === 'transfer' || cat === 'transportation';
  if (!isTransitish) return false;

  const title = String(card.title || card.name || '');
  const desc = String(card.description || '');
  return AIRPORT_TITLE_RE.test(title) || AIRPORT_TITLE_RE.test(desc);
}

function parseHM(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function toHM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function rewriteAirportTitle(title: string): string {
  if (!title) return title;
  if (WALK_PREFIX_RE.test(title)) {
    return title.replace(WALK_PREFIX_RE, 'Taxi to ');
  }
  return title;
}

/**
 * Force an airport-transit card to method=taxi with a sane duration.
 * Idempotent — calling twice is a no-op.
 * Returns true if the card was mutated.
 */
export function enforceAirportTransitMode(
  card: any,
  options: AirportTransitOptions = {},
): boolean {
  if (!isAirportTransitCard(card)) return false;

  const meta = (card.metadata = card.metadata || {});
  // Idempotency guard: if we've already classified it, only re-clamp duration.
  const alreadyClassified = meta.airport_transit_classified === true;

  const targetMins = Math.max(15, Math.min(120, Number(options.transferMinutes) || 45));
  const t = card.transportation || {};
  const currentMethod = String(t.method || '').toLowerCase();
  const currentDur = Number(
    t.durationMinutes ?? card.durationMinutes ?? card.duration_minutes ?? 0,
  );

  let mutated = false;

  // 1) Force method to taxi when it's walk/walking/foot/bike (anything that
  //    isn't already taxi/uber/car/train/bus/metro).
  const isAlreadyDrivenLike =
    currentMethod === 'taxi' || currentMethod === 'uber' || currentMethod === 'rideshare' ||
    currentMethod === 'car' || currentMethod === 'shuttle' || currentMethod === 'transfer' ||
    currentMethod === 'train' || currentMethod === 'rail' || currentMethod === 'bus' ||
    currentMethod === 'metro' || currentMethod === 'subway';
  if (!isAlreadyDrivenLike) {
    card.transportation = {
      ...t,
      method: 'taxi',
      instructions: t.instructions || 'Pre-book a taxi or rideshare to the airport.',
      estimatedCost: t.estimatedCost || { amount: 0, currency: 'USD' },
    };
    mutated = true;
  }

  // 2) Cap duration. Only shorten — never extend a user/booked duration.
  const effectiveDur = currentDur > 0 ? Math.min(currentDur, targetMins) : targetMins;
  if (currentDur !== effectiveDur) {
    card.transportation = {
      ...(card.transportation || {}),
      durationMinutes: effectiveDur,
      duration: `${effectiveDur} min`,
    };
    if (typeof card.durationMinutes === 'number') card.durationMinutes = effectiveDur;
    if (typeof card.duration_minutes === 'number') card.duration_minutes = effectiveDur;
    if (typeof card.duration === 'string') card.duration = `${effectiveDur} min`;

    // Recompute endTime from startTime when present.
    const startMins = parseHM(card.startTime || card.start_time);
    if (startMins !== null) {
      const newEnd = toHM(startMins + effectiveDur);
      card.endTime = newEnd;
      card.end_time = newEnd;
    }
    mutated = true;
  }

  // 3) Rewrite "Walk to …" / "Travel to …" title prefix to "Taxi to …".
  if (typeof card.title === 'string') {
    const t2 = rewriteAirportTitle(card.title);
    if (t2 !== card.title) { card.title = t2; mutated = true; }
  }
  if (typeof card.name === 'string') {
    const n2 = rewriteAirportTitle(card.name);
    if (n2 !== card.name) { card.name = n2; mutated = true; }
  }

  // 4) Stamp sentinel for downstream parity + subcategory for §15b skip.
  if (!alreadyClassified) {
    meta.airport_transit_classified = true;
    mutated = true;
  }
  if (!card.subcategory || String(card.subcategory).toLowerCase() === '') {
    card.subcategory = 'airport_transfer';
    mutated = true;
  }

  return mutated;
}

/**
 * Sweep an array of activities. Returns a count of cards mutated.
 */
export function enforceAirportTransitOnDay(
  activities: any[],
  options: AirportTransitOptions & { lockedIds?: Set<string> } = {},
): number {
  if (!Array.isArray(activities)) return 0;
  const locked = options.lockedIds;
  let count = 0;
  for (const a of activities) {
    const isLocked = !!(
      a?.isLocked || a?.locked === true || a?.is_locked === true ||
      a?.lock_state === 'locked' ||
      (locked && a?.id && locked.has(String(a.id)))
    );
    // User-pinned / booked airport rides keep their reported duration.
    // We still rewrite a stray "walk" method (booking a walking ride makes
    // no sense) but don't re-clamp.
    if (isLocked) {
      // Only fix method, not duration.
      if (isAirportTransitCard(a)) {
        const m = String(a?.transportation?.method || '').toLowerCase();
        if (m === 'walk' || m === 'walking' || m === 'foot') {
          a.transportation = { ...(a.transportation || {}), method: 'taxi' };
          a.metadata = a.metadata || {};
          a.metadata.airport_transit_classified = true;
          count++;
        }
      }
      continue;
    }
    if (enforceAirportTransitMode(a, options)) count++;
  }
  return count;
}
