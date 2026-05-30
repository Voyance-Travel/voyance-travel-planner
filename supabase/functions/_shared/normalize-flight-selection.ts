/**
 * Deno port of src/utils/normalizeFlightSelection.ts.
 *
 * Single source of truth on the edge for converting any flight_selection
 * shape (new `{ legs: [...] }`, legacy `{ departure, return }`, or flat
 * `{ arrivalTime, departureAirport, ... }`) into a unified legs[] array
 * with `isDestinationArrival` / `isDestinationDeparture` flags inferred
 * when missing, and return-leg arrival back-filled from outbound duration.
 *
 * Keep behaviorally identical to the FE module — both modules must agree on
 * which leg is the destination-arrival leg, otherwise prompt truth (BE) and
 * UI display (FE) drift (Amsterdam: BE saw 20:00, FE saw 22:00).
 */

export interface NormalizedLeg {
  legOrder: number;
  airline: string;
  flightNumber: string;
  departure: { airport: string; time: string; date: string };
  arrival: { airport: string; time: string; date?: string; estimated?: boolean };
  price: number;
  cabin: string;
  isDestinationArrival?: boolean;
  isDestinationDeparture?: boolean;
}

export interface NormalizedFlightSelection {
  legs: NormalizedLeg[];
  isManualEntry?: boolean;
  totalPrice: number;
}

// ─── leg-tag inference (port of src/utils/autoTagFlightLegs.ts) ─────────────

function getArrivalAirport(leg: Record<string, any>): string {
  return String(leg?.arrival?.airport ?? leg?.arrivalAirport ?? '').trim().toUpperCase();
}
function getDepartureAirport(leg: Record<string, any>): string {
  return String(leg?.departure?.airport ?? leg?.departureAirport ?? '').trim().toUpperCase();
}

export function autoTagLegs<T extends Record<string, any>>(
  legsIn: T[] | null | undefined,
  opts: { destinationIata?: string | null } = {},
): T[] {
  if (!Array.isArray(legsIn) || legsIn.length === 0) return (legsIn ?? []) as T[];
  const legs = legsIn.map((l) => ({ ...l })) as T[];
  const anyArr = legs.some((l) => l?.isDestinationArrival === true);
  const anyDep = legs.some((l) => l?.isDestinationDeparture === true);
  const destIata = (opts.destinationIata || '').trim().toUpperCase();

  if (!anyArr) {
    let idx = -1;
    if (legs.length === 1) idx = 0;
    else if (legs.length === 2) idx = 0;
    else if (destIata) {
      idx = legs.findIndex((l) => getArrivalAirport(l) === destIata);
      if (idx < 0) idx = legs.length - 2;
    } else idx = legs.length - 2;
    if (idx >= 0 && idx < legs.length) (legs[idx] as any).isDestinationArrival = true;
  }

  if (!anyDep) {
    let idx = -1;
    if (legs.length === 1) idx = -1;
    else if (legs.length === 2) idx = 1;
    else if (destIata) {
      for (let i = legs.length - 1; i >= 0; i--) {
        if (getDepartureAirport(legs[i]) === destIata) { idx = i; break; }
      }
      if (idx < 0) idx = legs.length - 1;
    } else idx = legs.length - 1;
    if (idx >= 0 && idx < legs.length) (legs[idx] as any).isDestinationDeparture = true;
  }

  // mutual exclusivity — preserve first-true wins
  let seenA = false, seenD = false;
  for (let i = 0; i < legs.length; i++) {
    if ((legs[i] as any).isDestinationArrival) {
      if (seenA) (legs[i] as any).isDestinationArrival = false; else seenA = true;
    }
    if ((legs[i] as any).isDestinationDeparture) {
      if (seenD) (legs[i] as any).isDestinationDeparture = false; else seenD = true;
    }
  }
  return legs;
}

// ─── return-arrival estimation (port of estimateReturnArrival) ──────────────

function parseDateTimeUTC(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!dm) return null;
  const cleaned = String(timeStr).trim().toUpperCase();
  let h: number | null = null, mi: number | null = null;
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(cleaned);
  if (m24) { h = +m24[1]; mi = +m24[2]; }
  else {
    const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/.exec(cleaned);
    if (m12) {
      h = +m12[1]; mi = +m12[2];
      if (m12[3] === 'PM' && h !== 12) h += 12;
      if (m12[3] === 'AM' && h === 12) h = 0;
    }
  }
  if (h == null || mi == null) return null;
  const y = +dm[1], mo = +dm[2], d = +dm[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1) return null;
  return dt;
}
function fmtDateUTC(dt: Date): string {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
function fmtTimeUTC(dt: Date): string {
  return `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;
}

export function estimateReturnArrival(legs: NormalizedLeg[]): void {
  if (!Array.isArray(legs) || legs.length !== 2) return;
  const out = legs[0], ret = legs[1];
  if (!out || !ret) return;
  if (ret.arrival?.time) return;
  const outDep = parseDateTimeUTC(out.departure?.date, out.departure?.time);
  let outArr = parseDateTimeUTC(out.arrival?.date || out.departure?.date, out.arrival?.time);
  if (!outDep || !outArr) return;
  if (!out.arrival?.date && outArr.getTime() <= outDep.getTime()) {
    outArr = new Date(outArr.getTime() + 86400000);
  }
  const dur = (outArr.getTime() - outDep.getTime()) / 60000;
  if (!Number.isFinite(dur) || dur <= 0 || dur > 1440) return;
  const retDep = parseDateTimeUTC(ret.departure?.date, ret.departure?.time);
  if (!retDep) return;
  const arrAt = new Date(retDep.getTime() + dur * 60000);
  ret.arrival = {
    ...(ret.arrival || { airport: '', time: '' }),
    airport: ret.arrival?.airport || '',
    time: fmtTimeUTC(arrAt),
    date: fmtDateUTC(arrAt),
    estimated: true,
  };
}

// ─── main normalizer ────────────────────────────────────────────────────────

export function normalizeFlightSelection(raw: unknown): NormalizedFlightSelection | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const finalize = (legs: NormalizedLeg[]): NormalizedFlightSelection | null => {
    if (legs.length === 0) return null;
    estimateReturnArrival(legs);
    const tagged = autoTagLegs(legs);
    return {
      legs: tagged,
      isManualEntry: data.isManualEntry as boolean | undefined,
      totalPrice: tagged.reduce((s, l) => s + (l.price || 0), 0),
    };
  };

  // new shape
  if (Array.isArray(data.legs) && (data.legs as any[]).length > 0) {
    const legs = (data.legs as any[]).map((leg, i) => ({
      ...leg,
      legOrder: leg?.legOrder ?? i + 1,
      departure: leg?.departure ?? { airport: '', time: '', date: '' },
      arrival: leg?.arrival ?? { airport: '', time: '' },
      airline: leg?.airline ?? '',
      flightNumber: leg?.flightNumber ?? '',
      price: leg?.price ?? 0,
      cabin: leg?.cabin ?? 'economy',
    })) as NormalizedLeg[];
    return finalize(legs);
  }

  // legacy { departure, return }
  const legs: NormalizedLeg[] = [];
  const dep = data.departure as Record<string, any> | undefined;
  if (dep && typeof dep === 'object') {
    legs.push({
      legOrder: 1,
      airline: (dep.airline as string) || '',
      flightNumber: (dep.flightNumber as string) || '',
      departure: {
        airport: (dep.departure?.airport as string) || '',
        time: (dep.departure?.time as string) || '',
        date: (dep.departure?.date as string) || '',
      },
      arrival: {
        airport: (dep.arrival?.airport as string) || '',
        time: (dep.arrival?.time as string) || '',
        date: (dep.arrival?.date as string) || undefined,
      },
      price: (dep.price as number) || 0,
      cabin: (dep.cabin as string) || 'economy',
    });
  }
  const ret = data.return as Record<string, any> | undefined;
  if (ret && typeof ret === 'object') {
    legs.push({
      legOrder: 2,
      airline: (ret.airline as string) || '',
      flightNumber: (ret.flightNumber as string) || '',
      departure: {
        airport: (ret.departure?.airport as string) || '',
        time: (ret.departure?.time as string) || '',
        date: (ret.departure?.date as string) || '',
      },
      arrival: {
        airport: (ret.arrival?.airport as string) || '',
        time: (ret.arrival?.time as string) || '',
        date: (ret.arrival?.date as string) || undefined,
      },
      price: (ret.price as number) || 0,
      cabin: (ret.cabin as string) || 'economy',
    });
  }

  // flat
  if (legs.length === 0 && (data.arrivalTime || data.departureAirport)) {
    legs.push({
      legOrder: 1,
      airline: '',
      flightNumber: '',
      departure: {
        airport: (data.departureAirport as string) || '',
        time: (data.departureTime as string) || '',
        date: '',
      },
      arrival: {
        airport: (data.arrivalAirport as string) || '',
        time: (data.arrivalTime as string) || '',
      },
      price: 0,
      cabin: 'economy',
    });
  }

  return finalize(legs);
}

export type FlightSelectionShape = 'legs' | 'legacy' | 'flat' | 'unknown';

export function detectShape(raw: unknown): FlightSelectionShape {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const d = raw as Record<string, unknown>;
  if (Array.isArray(d.legs) && (d.legs as any[]).length > 0) return 'legs';
  if (d.departure || d.return) return 'legacy';
  if (d.arrivalTime || d.departureAirport) return 'flat';
  return 'unknown';
}
