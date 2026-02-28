import { format as dateFnsFormat, parseISO } from 'date-fns';

/**
 * Get today's date as a YYYY-MM-DD string using LOCAL time (not UTC).
 * Use this instead of `new Date().toISOString().split('T')[0]` to avoid
 * timezone-related off-by-one errors for users west of UTC.
 */
export const getLocalToday = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a YYYY-MM-DD date string as local midnight instead of UTC midnight.
 * This prevents the off-by-one-day bug for users in timezones west of UTC.
 * Use this instead of parseISO() when displaying date-only strings from the database.
 */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(); // Graceful fallback for missing dates
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date();
  return new Date(year, month - 1, day);
};

/**
 * Format a date for display
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date as short form (e.g., "Jan 15")
 */
export const formatDateShort = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a date with weekday (e.g., "Mon, Jan 15")
 */
export const formatDateWithWeekday = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get the number of days between two dates
 */
export const getDaysBetween = (start: string | Date, end: string | Date): number => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Add days to a date
 */
export const addDays = (date: string | Date, days: number): string => {
  const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get relative time string (e.g., "2 days ago", "in 3 hours")
 */
export const getRelativeTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) return 'now';
    if (diffHours > 0) return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? '' : 's'} ago`;
  }
  
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
};

/**
 * Check if a date is in the past
 */
export const isPast = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
};

/**
 * Check if a date is today
 */
export const isToday = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

/**
 * Format date range (e.g., "Jan 15 - 22, 2025")
 */
export const formatDateRange = (start: string | Date, end: string | Date): string => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  
  if (sameMonth && sameYear) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  
  if (sameYear) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endDate.getFullYear()}`;
  }
  
  return `${formatDateShort(startDate)}, ${startDate.getFullYear()} - ${formatDateShort(endDate)}, ${endDate.getFullYear()}`;
};

/**
 * Check if a string is a valid ISO date format (YYYY-MM-DD)
 */
export const isValidISODateString = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
};

/**
 * Safely format a date string with a fallback value.
 * Prevents "Invalid time value" crashes from malformed date strings.
 */
export const safeFormatDate = (
  dateString: string | undefined | null,
  formatStr: string,
  fallback: string = ''
): string => {
  if (!dateString) return fallback;
  
  // Early return if it doesn't look like an ISO date
  if (!isValidISODateString(dateString)) {
    console.warn(`[safeFormatDate] Invalid date string: "${dateString}"`);
    return fallback;
  }
  
  try {
    const date = parseLocalDate(dateString);
    if (isNaN(date.getTime())) return fallback;
    return dateFnsFormat(date, formatStr);
  } catch {
    console.warn(`[safeFormatDate] Failed to format date: "${dateString}"`);
    return fallback;
  }
};
