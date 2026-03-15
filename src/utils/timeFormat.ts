/**
 * Shared time formatting utility.
 * Converts 24-hour "HH:MM" strings to 12-hour "h:MM AM/PM" format.
 * Passes through already-formatted 12h strings (containing AM/PM).
 */

export function formatTime12h(time: string | undefined | null): string {
  if (!time) return '';

  // Already in 12h format
  if (/[APap][Mm]/.test(time)) return time;

  const parts = time.split(':');
  if (parts.length < 2) return time;

  const hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');

  if (isNaN(hours)) return time;

  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
}
