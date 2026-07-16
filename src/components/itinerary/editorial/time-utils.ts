// Shared clock-time helpers used by EditorialItinerary and its sub-components.
// Extracted from EditorialItinerary.tsx during the file-size decomposition.

/** Parse "HH:MM" to minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Convert minutes since midnight to "HH:MM" (clamped to 00:00–23:59) */
export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
