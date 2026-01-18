/**
 * Text formatting utilities for display purposes
 */

/**
 * Format enum-style strings for display
 * Converts "snake_case" or "kebab-case" to "Title Case"
 * 
 * @example
 * formatEnumDisplay("not_started") → "Not Started"
 * formatEnumDisplay("partly_cloudy") → "Partly Cloudy"
 * formatEnumDisplay("adventure-seeker") → "Adventure Seeker"
 */
export function formatEnumDisplay(value: string | undefined | null): string {
  if (!value) return '';
  
  return value
    .replace(/[-_]/g, ' ')  // Replace dashes and underscores with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase())  // Capitalize first letter of each word
    .trim();
}

/**
 * Format a string to title case
 * 
 * @example
 * toTitleCase("hello world") → "Hello World"
 */
export function toTitleCase(value: string | undefined | null): string {
  if (!value) return '';
  
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Truncate text with ellipsis
 * 
 * @example
 * truncateText("Hello world this is a long text", 15) → "Hello world..."
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Format a status for display with proper casing
 */
export function formatStatus(status: string | undefined | null): string {
  if (!status) return 'Unknown';
  
  const statusMap: Record<string, string> = {
    // Trip statuses
    'draft': 'Draft',
    'planning': 'Planning',
    'booked': 'Booked',
    'active': 'Active',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    // Itinerary statuses
    'not_started': 'Not Started',
    'queued': 'Queued',
    'generating': 'Generating',
    'ready': 'Ready',
    'failed': 'Failed',
  };
  
  return statusMap[status.toLowerCase()] || formatEnumDisplay(status);
}

/**
 * Format weather condition for display
 */
export function formatWeatherCondition(condition: string | undefined | null): string {
  if (!condition) return '';
  
  const weatherMap: Record<string, string> = {
    'partly_cloudy': 'Partly Cloudy',
    'mostly_cloudy': 'Mostly Cloudy',
    'mostly_sunny': 'Mostly Sunny',
    'light_rain': 'Light Rain',
    'heavy_rain': 'Heavy Rain',
    'thunderstorm': 'Thunderstorm',
    'snow': 'Snow',
    'fog': 'Fog',
    'sunny': 'Sunny',
    'cloudy': 'Cloudy',
    'clear': 'Clear',
  };
  
  return weatherMap[condition.toLowerCase()] || formatEnumDisplay(condition);
}

export default {
  formatEnumDisplay,
  toTitleCase,
  truncateText,
  formatStatus,
  formatWeatherCondition,
};
