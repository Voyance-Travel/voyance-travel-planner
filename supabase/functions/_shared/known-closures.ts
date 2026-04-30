/**
 * known-closures.ts — Static, hand-curated map of "what is generally closed
 * on this weekday in this city/country." Used by the Day Truth Ledger so the
 * AI doesn't schedule the Louvre on a Monday.
 *
 * Conservative on purpose: only well-known, broadly-applicable closures.
 * Per-venue truth still lives in Google Places opening_hours; this is the
 * "everyone knows" baseline.
 */

export interface KnownClosure {
  /** Day-of-week index, 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** Short human reason — surfaced in the prompt. */
  reason: string;
  /** Examples of venues this typically affects. */
  examples?: string[];
}

const LISBON: KnownClosure[] = [
  { dayOfWeek: 1, reason: 'Most Lisbon museums close Mondays', examples: ['MAAT', 'Gulbenkian', 'National Tile Museum'] },
];
const PARIS: KnownClosure[] = [
  { dayOfWeek: 2, reason: 'Louvre and many Paris museums close Tuesdays', examples: ['Louvre', 'Centre Pompidou', 'Musée d\'Orsay (closed Mon)'] },
  { dayOfWeek: 1, reason: 'Several Paris museums close Mondays', examples: ['Musée d\'Orsay', 'Versailles'] },
];
const ROME: KnownClosure[] = [
  { dayOfWeek: 1, reason: 'Many Rome museums and the Vatican Museums close Sundays (Vatican) / Mondays (state museums)', examples: ['Borghese (limited)', 'state museums'] },
];
const FLORENCE: KnownClosure[] = [
  { dayOfWeek: 1, reason: 'Uffizi and Accademia close Mondays', examples: ['Uffizi', 'Accademia'] },
];
const MADRID: KnownClosure[] = [
  { dayOfWeek: 1, reason: 'Prado and Reina Sofia have reduced hours / closures Mondays', examples: ['Prado', 'Reina Sofia'] },
];
const ISTANBUL: KnownClosure[] = [
  { dayOfWeek: 2, reason: 'Topkapı Palace and several Istanbul museums close Tuesdays', examples: ['Topkapı', 'Hagia Sophia museum sections'] },
];
const AMSTERDAM: KnownClosure[] = [
  // Rijksmuseum is open daily — but many smaller museums close Mondays
  { dayOfWeek: 1, reason: 'Many smaller Amsterdam museums close Mondays', examples: ['Anne Frank House (variable)', 'smaller museums'] },
];
const LONDON: KnownClosure[] = [
  // Most London majors are 7-day. Leave empty by default.
];

const CITY_MAP: Record<string, KnownClosure[]> = {
  lisbon: LISBON,
  paris: PARIS,
  rome: ROME,
  florence: FLORENCE,
  madrid: MADRID,
  istanbul: ISTANBUL,
  amsterdam: AMSTERDAM,
  london: LONDON,
};

export function getKnownClosures(city: string | undefined, dayOfWeek: number): KnownClosure[] {
  if (!city) return [];
  const key = city.trim().toLowerCase();
  const list = CITY_MAP[key] || [];
  return list.filter((c) => c.dayOfWeek === dayOfWeek);
}
