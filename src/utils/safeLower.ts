/**
 * Safely converts any value to a lowercase string.
 * Returns '' for null, undefined, or non-string values.
 * Prevents "Cannot read properties of undefined (reading 'toLowerCase')" crashes.
 */
export function safeLower(value: unknown): string {
  if (value == null) return '';
  return String(value).toLowerCase();
}
