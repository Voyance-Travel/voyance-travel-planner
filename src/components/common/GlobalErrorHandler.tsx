import { useEffect } from 'react';
import toast from '@/utils/simpleToast';

/**
 * Global error handler component that catches unhandled promise rejections
 * and prevents white-screen crashes by showing user-friendly error messages.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    const isSuppressedRoute = () => {
      const path = window.location.pathname.toLowerCase();
      const query = window.location.search.toLowerCase();
      return path.includes('/itinerary') || query.includes('generate=true');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);

      if (isSuppressedRoute()) {
        console.log('[GlobalErrorHandler] Suppressing global error UI on itinerary generation route');
        event.preventDefault();
        return;
      }

      if (event.reason instanceof Error) {
        console.error('Error details:', event.reason.message, event.reason.stack);
      } else if (typeof event.reason === 'string') {
        console.error('Error string:', event.reason);
      }

      toast.error('Something hiccupped. Try that again.');
      event.preventDefault();
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global Error:', event.error || event.message);

      if (isSuppressedRoute()) {
        console.log('[GlobalErrorHandler] Suppressing global error toast on itinerary generation route');
        event.preventDefault();
        return;
      }

      toast.error('Something hiccupped. A quick refresh should fix it.');
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
