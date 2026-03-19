/**
 * Shared time formatting utility.
 * Converts 24-hour "HH:MM" strings to 12-hour "h:MM AM/PM" format.
 * Passes through already-formatted 12h strings (containing AM/PM).
 */

/**
 * Normalize any time string (12h or 24h) to "HH:MM" 24-hour format.
 * Returns undefined for unparseable input.
 */
export function normalizeTimeTo24h(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase();

  // Already 24h — e.g. "14:30"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    return h <= 23 ? `${h.toString().padStart(2, '0')}:${match24[2]}` : undefined;
  }

  // 12h — e.g. "11:00 AM", "1:30pm", "9 am"
  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2] || '00';
    if (match12[3] === 'pm' && h !== 12) h += 12;
    if (match12[3] === 'am' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }

  return undefined;
}

/**
 * Parse a time string to total minutes since midnight.
 * Handles both 24h ("14:30") and 12h ("2:30 PM") formats.
 */
export function parseTimeToMinutes(time: string | undefined | null): number {
  if (!time) return 0;
  const normalized = normalizeTimeTo24h(time);
  if (!normalized) {
    // Fallback: try bare parseInt for legacy "HH:MM" strings
    const h = parseInt(time.split(':')[0], 10);
    const m = parseInt(time.split(':')[1] || '0', 10);
    return isNaN(h) ? 0 : h * 60 + (isNaN(m) ? 0 : m);
  }
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

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
