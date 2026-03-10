/**
 * Maps raw backend error strings to user-friendly messages.
 * Falls back to a generic friendly message if no match is found.
 */

const ERROR_MAP: Array<{ pattern: RegExp; friendly: string }> = [
  // Auth
  { pattern: /unauthorized|please sign in|not authenticated/i, friendly: 'Please sign in to continue.' },
  { pattern: /session expired|token expired/i, friendly: 'Your session expired. Please sign in again.' },

  // Rate limiting
  { pattern: /rate limit/i, friendly: 'You\'re moving fast! Give it a moment and try again.' },

  // Credits
  { pattern: /insufficient credits|credits exhausted|need \d+ credits/i, friendly: 'You need more credits for this. Check your balance.' },
  { pattern: /credits.*refund|refund.*credits/i, friendly: 'No worries — your credits have been returned.' },

  // Generation
  { pattern: /failed to generate|generation failed|generate.*error/i, friendly: 'Trip generation hit a snag. Give it another try.' },
  { pattern: /failed to enrich|enrichment failed/i, friendly: 'We couldn\'t load all the details. Try again.' },
  { pattern: /timeout|timed out|__TIMEOUT__/i, friendly: 'That took longer than expected. Try again.' },

  // Data
  { pattern: /trip not found|no trip found/i, friendly: 'We couldn\'t find that trip. It may have been deleted.' },
  { pattern: /missing required/i, friendly: 'Some info is missing. Please fill in all required fields.' },

  // Payments
  { pattern: /payment.*failed|checkout.*failed|failed.*payment/i, friendly: 'Payment didn\'t go through. Please try again.' },
  { pattern: /price.*mismatch|price.*changed/i, friendly: 'The price has changed. Please review and try again.' },

  // Permissions
  { pattern: /you must own|not the owner|permission denied|forbidden/i, friendly: 'You don\'t have permission to do that.' },
  { pattern: /already exists|already.*member|duplicate/i, friendly: 'Already done! No action needed.' },

  // Network / Server
  { pattern: /network|fetch.*failed|connection/i, friendly: 'Connection issue. Check your internet and try again.' },
  { pattern: /server error|internal error|500/i, friendly: 'Something went wrong on our end. Try again shortly.' },
  { pattern: /service unavailable|503/i, friendly: 'We\'re briefly unavailable. Try again in a moment.' },
];

const GENERIC_FRIENDLY = 'Something went wrong. Please try again.';

export function toFriendlyError(rawError: string | undefined | null): string {
  if (!rawError) return GENERIC_FRIENDLY;

  for (const { pattern, friendly } of ERROR_MAP) {
    if (pattern.test(rawError)) return friendly;
  }

  // If the raw error is already short and clean (no stack traces, no technical jargon),
  // use it as-is. Otherwise fall back to generic.
  if (rawError.length < 80 && !rawError.includes('Error:') && !rawError.includes('at ')) {
    return rawError;
  }

  return GENERIC_FRIENDLY;
}
