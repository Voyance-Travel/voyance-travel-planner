/**
 * itinerarySanitize — defensive coercion for itinerary render data.
 *
 * ROOT-CAUSE NOTE: the recurring "Small Detour" crash is an ErrorBoundary
 * catching `.toLowerCase()` (and similar string ops) called on `undefined`.
 * It surfaces when generation half-completes and emits partial/malformed
 * activity data into the renderer. Rather than guard 80+ individual call
 * sites (and miss the next variant), we (a) expose `safeLower` for the known
 * risky sites and (b) coerce every string field that downstream code calls
 * string methods on at the single data boundary where raw days enter the
 * component. A field that is always a string can never throw.
 */

/** Lowercase that never throws — null/undefined/non-string → ''. */
export function safeLower(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase();
  if (value == null) return '';
  return String(value).toLowerCase();
}

/** Trim that never throws. */
export function safeTrim(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

/** Coerce to a string, with an optional fallback for null/undefined. */
export function safeStr(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

/**
 * Coerce one activity-like object so every field the renderer calls string
 * methods on is guaranteed to be a string, and array fields are arrays.
 * Preserves every other field untouched (non-destructive spread).
 */
export function sanitizeActivity<T = Record<string, unknown>>(activity: unknown): T {
  if (activity == null || typeof activity !== 'object') {
    // Return a minimal safe shell rather than null so callers can map freely.
    return { title: 'Untitled Activity' } as unknown as T;
  }
  const a = activity as Record<string, unknown>;
  const loc = (a.location && typeof a.location === 'object') ? a.location as Record<string, unknown> : undefined;
  const transport = (a.transportation && typeof a.transportation === 'object') ? a.transportation as Record<string, unknown> : undefined;

  return {
    ...a,
    title: safeStr(a.title || a.name || a.venue, 'Untitled Activity'),
    description: safeStr(a.description),
    category: safeStr(a.category),
    startTime: safeStr(a.startTime || a.start_time || a.time),
    endTime: safeStr(a.endTime || a.end_time),
    tags: Array.isArray(a.tags) ? a.tags : [],
    ...(loc
      ? { location: { ...loc, name: safeStr(loc.name), address: safeStr(loc.address) } }
      : {}),
    ...(transport
      ? { transportation: { ...transport, method: safeStr(transport.method), duration: safeStr(transport.duration) } }
      : {}),
  } as unknown as T;
}

/**
 * Sanitize an array of raw days for rendering: guarantees `.activities` is an
 * array of sanitized activities and the day's identifying strings are strings.
 * Null/garbage days are dropped. Never throws.
 */
export function sanitizeEditorialDays<T = unknown>(days: unknown): T[] {
  if (!Array.isArray(days)) return [];
  return days
    .filter((d) => d != null && typeof d === 'object')
    .map((day) => {
      const d = day as Record<string, unknown>;
      const activities = Array.isArray(d.activities) ? d.activities : [];
      return {
        ...d,
        title: safeStr(d.title),
        city: safeStr(d.city),
        activities: activities
          .filter((a) => a != null)
          .map((a) => sanitizeActivity(a as Record<string, unknown>)),
      } as unknown as T;
    });
}
