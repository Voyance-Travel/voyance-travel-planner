/**
 * Text sanitizer - removes em dashes and other unwanted characters
 * from user-facing text content.
 */

/**
 * Replace em dashes (—) with standard dashes ( - ) in any text.
 * Also handles en dashes (–).
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/—/g, ' - ')
    .replace(/–/g, '-');
}

/**
 * Sanitize all string fields in an object (shallow, one level deep).
 * Useful for sanitizing activity data from AI.
 */
export function sanitizeObjectStrings<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      (result as any)[key] = sanitizeText(result[key] as string);
    }
  }
  return result;
}
