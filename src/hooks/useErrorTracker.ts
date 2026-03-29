import { useEffect } from 'react';
import { logClientError } from '@/utils/logClientError';

/**
 * Captures unhandled errors and promise rejections, writes them to client_errors table.
 * Mount once in App.tsx alongside useAnalyticsTracker.
 */
export function useErrorTracker() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Skip browser extension errors
      if (event.filename && !event.filename.includes(window.location.origin)) return;
      
      logClientError(
        event.message || 'Unknown error',
        event.error?.stack,
        undefined,
        { filename: event.filename, lineno: event.lineno, colno: event.colno, source: 'window_error' }
      );
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled rejection');
      const stack = event.reason instanceof Error ? event.reason.stack : undefined;
      
      // Skip browser extension errors
      if (msg.includes('message channel closed') || msg.includes('message port closed')) return;
      
      logClientError(msg, stack, undefined, { type: 'unhandled_rejection', source: 'window_error' });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
}
