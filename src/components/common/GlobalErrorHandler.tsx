import { useEffect } from 'react';
import toast from '@/utils/simpleToast';

/**
 * Global error handler component that catches unhandled promise rejections
 * and prevents white-screen crashes by showing user-friendly error messages.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Log error for debugging
      console.error('Unhandled Promise Rejection:', event.reason);
      
      // Extract error message
      let message = 'An unexpected error occurred. Please try again.';
      if (event.reason instanceof Error) {
        // Don't expose internal error details to users, but log them
        console.error('Error details:', event.reason.message, event.reason.stack);
      } else if (typeof event.reason === 'string') {
        console.error('Error string:', event.reason);
      }
      
      // Show user-friendly toast
      toast.error(message);
      
      // Prevent the default browser error handling (which can crash the app)
      event.preventDefault();
    };

    const handleError = (event: ErrorEvent) => {
      // Log error for debugging
      console.error('Global Error:', event.error || event.message);
      
      // Show user-friendly toast for uncaught errors
      toast.error('Something went wrong. Please refresh the page.');
      
      // Prevent default to avoid duplicate error reporting
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
