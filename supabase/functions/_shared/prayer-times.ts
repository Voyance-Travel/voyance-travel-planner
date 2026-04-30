/**
 * prayer-times.ts — Day Brief enrichment for Muslim-majority destinations.
 *
 * Activated only for flagged countries; otherwise returns null. Stub for now.
 */

const FLAGGED_COUNTRIES = new Set([
  'morocco', 'uae', 'united arab emirates', 'saudi arabia', 'egypt',
  'turkey', 'tunisia', 'jordan', 'qatar', 'kuwait', 'oman', 'bahrain',
  'indonesia', 'malaysia', 'pakistan', 'iran', 'lebanon',
]);

export interface PrayerTimes {
  fajr?: string;    // HH:MM
  dhuhr?: string;
  asr?: string;
  maghrib?: string;
  isha?: string;
  note?: string;
}

export function shouldFetchPrayerTimes(country: string): boolean {
  return FLAGGED_COUNTRIES.has((country || '').toLowerCase().trim());
}

export async function fetchPrayerTimes(
  _city: string,
  country: string,
  _dateYMD: string,
): Promise<PrayerTimes | null> {
  if (!shouldFetchPrayerTimes(country)) return null;
  // Stub. Real implementation can call Aladhan API.
  return null;
}
