/**
 * Format duration in minutes to human-readable string
 */
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * Coerce a possibly-malformed duration string (e.g. "15:00:00", "1:05:00", "45 min")
 * into a clean human-readable duration. If `durationMinutes` is provided and valid,
 * it is preferred as the source of truth.
 *
 * Examples:
 *   coerceDurationString("15:00:00")        -> "15h"
 *   coerceDurationString("1:05:00")         -> "1h 5m"
 *   coerceDurationString("45:00")           -> "45m"   (heuristic: >23 = minutes)
 *   coerceDurationString("2:20:00")         -> "2h 20m"
 *   coerceDurationString("90 min")          -> "1h 30m"
 *   coerceDurationString("foo", 60)         -> "1h"
 */
export const coerceDurationString = (
  raw: unknown,
  durationMinutes?: number | null
): string => {
  if (typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0) {
    return formatDuration(Math.round(durationMinutes));
  }
  if (raw == null) return '';
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return formatDuration(Math.round(raw));
  }
  const s = String(raw).trim();
  if (!s) return '';

  // HH:MM:SS or HH:MM
  const colon = s.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    const a = parseInt(colon[1], 10);
    const b = parseInt(colon[2], 10);
    const hasSeconds = colon[3] !== undefined;
    let totalMin: number;
    if (hasSeconds) {
      // True HH:MM:SS clock duration
      totalMin = a * 60 + b;
    } else if (a >= 24 || (a >= 5 && b === 0)) {
      // "45:00" or "90:00" -> minutes:seconds, treat first as minutes
      totalMin = a;
    } else {
      // "1:30" -> 1h 30m
      totalMin = a * 60 + b;
    }
    if (totalMin > 0) return formatDuration(totalMin);
  }

  // "Nh Mm" / "N min" / bare integer
  const hm = s.match(/^(\d+)\s*h(?:ours?|rs?)?(?:\s*(\d+)\s*m(?:in(?:ute)?s?)?)?$/i);
  if (hm) {
    const total = parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);
    if (total > 0) return formatDuration(total);
  }
  const minOnly = s.match(/^(\d+)\s*(?:m|min|mins|minute|minutes)$/i);
  if (minOnly) {
    const total = parseInt(minOnly[1], 10);
    if (total > 0) return formatDuration(total);
  }
  const bare = s.match(/^(\d+)$/);
  if (bare) {
    const total = parseInt(bare[1], 10);
    if (total > 0) return formatDuration(total);
  }

  // Range like "2-3 hours" or "30-45 min" — keep as-is (descriptive)
  if (/^\d+\s*[-–]\s*\d+\s*(h|hr|hour|min|m)/i.test(s)) return s;

  return '';
};

/**
 * Parse duration string to minutes
 */
export const parseDuration = (duration: string): number => {
  const hourMatch = duration.match(/(\d+)\s*h/);
  const minMatch = duration.match(/(\d+)\s*m/);
  
  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;
  
  return hours * 60 + minutes;
};

/**
 * Get activity icon name (Lucide icon) based on type
 */
export const getActivityIconName = (type: string): string => {
  const icons: Record<string, string> = {
    activity: 'Target',
    attraction: 'Landmark',
    restaurant: 'UtensilsCrossed',
    food: 'UtensilsCrossed',
    meal: 'UtensilsCrossed',
    hotel: 'Building2',
    accommodation: 'Building2',
    transport: 'Plane',
    transit: 'Bus',
    break: 'Coffee',
    rest: 'Moon',
    nature: 'Leaf',
    adventure: 'Mountain',
    culture: 'Palette',
    wellness: 'Heart',
    nightlife: 'Moon',
    shopping: 'ShoppingBag',
    default: 'MapPin'
  };
  return icons[(type || 'activity').toLowerCase()] || icons.default;
};

/**
 * Calculate total budget for a day's activities
 */
export const calculateDayBudget = (activities: { price?: number }[]): number => {
  return activities.reduce((total, activity) => total + (activity.price || 0), 0);
};

/**
 * Get activity color based on category
 */
export const getActivityColor = (category: string): string => {
  const colors: Record<string, string> = {
    culture: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    food: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    nature: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    adventure: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    wellness: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    nightlife: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    transit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    break: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    default: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300'
  };
  return colors[(category || 'activity').toLowerCase()] || colors.default;
};

/**
 * Generate time slots for day planning
 */
export const generateTimeSlots = (
  startHour = 8,
  endHour = 22,
  intervalMinutes = 30
): string[] => {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = 0; min < 60; min += intervalMinutes) {
      if (hour === endHour && min > 0) break;
      slots.push(
        `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      );
    }
  }
  return slots;
};

/**
 * Validate trip dates
 */
export const validateTripDates = (
  startDate: string,
  endDate: string
): { valid: boolean; error?: string } => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return { valid: false, error: 'Start date cannot be in the past' };
  }
  
  if (end <= start) {
    return { valid: false, error: 'End date must be after start date' };
  }
  
  const maxDays = 30;
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > maxDays) {
    return { valid: false, error: `Trip cannot exceed ${maxDays} days` };
  }
  
  return { valid: true };
};
