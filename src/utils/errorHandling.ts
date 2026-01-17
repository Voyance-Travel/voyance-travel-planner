import toast from './simpleToast';

/**
 * Error handling utilities
 */

/**
 * Handle API errors consistently
 */
export function handleAPIError(error: Error, customMessage?: string): void {
  console.error('API Error:', error);
  
  const message = customMessage || error.message || 'Something went wrong. Please try again.';
  toast.error(message);
}

/**
 * Format error for display
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Safe async wrapper with error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleAPIError(error as Error, errorMessage);
    return null;
  }
}

/**
 * Create error boundary fallback component
 */
export function getErrorFallback(error: Error) {
  return {
    title: 'Something went wrong',
    message: error.message,
    action: 'Please refresh the page and try again.',
  };
}
