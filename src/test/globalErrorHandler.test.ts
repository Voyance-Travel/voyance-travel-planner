/**
 * Integration Tests for GlobalErrorHandler
 * 
 * Tests that unhandled errors are caught and handled gracefully.
 * Uses pure TypeScript to avoid React testing library dependencies.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simulates the error handling logic from GlobalErrorHandler
class ErrorHandler {
  private toastError: (message: string) => void;

  constructor(toastFn: (message: string) => void) {
    this.toastError = toastFn;
  }

  handleUnhandledRejection(event: { reason: unknown; preventDefault: () => void }) {
    // Log error for debugging
    console.error('Unhandled Promise Rejection:', event.reason);

    // Extract error message
    let message = 'An unexpected error occurred. Please try again.';
    if (event.reason instanceof Error) {
      console.error('Error details:', event.reason.message, event.reason.stack);
    } else if (typeof event.reason === 'string') {
      console.error('Error string:', event.reason);
    }

    // Show user-friendly toast
    this.toastError(message);

    // Prevent default browser error handling
    event.preventDefault();
  }

  handleError(event: { error?: Error; message?: string; preventDefault: () => void }) {
    // Log error for debugging
    console.error('Global Error:', event.error || event.message);

    // Show user-friendly toast
    this.toastError('Something went wrong. Please refresh the page.');

    // Prevent default
    event.preventDefault();
  }
}

describe('GlobalErrorHandler', () => {
  let mockToast: ReturnType<typeof vi.fn>;
  let handler: ErrorHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockToast = vi.fn();
    handler = new ErrorHandler(mockToast);
  });

  describe('Unhandled Promise Rejections', () => {
    it('should show generic toast message for Error objects', () => {
      const mockEvent = {
        reason: new Error('Test rejection'),
        preventDefault: vi.fn(),
      };

      handler.handleUnhandledRejection(mockEvent);

      expect(mockToast).toHaveBeenCalledWith(
        'Something hiccupped. Try that again.'
      );
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should show generic toast message for string errors', () => {
      const mockEvent = {
        reason: 'String error message',
        preventDefault: vi.fn(),
      };

      handler.handleUnhandledRejection(mockEvent);

      expect(mockToast).toHaveBeenCalledWith(
        'Something hiccupped. Try that again.'
      );
    });

    it('should handle null/undefined reasons', () => {
      const mockEvent = {
        reason: null,
        preventDefault: vi.fn(),
      };

      handler.handleUnhandledRejection(mockEvent);

      expect(mockToast).toHaveBeenCalled();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should prevent default browser handling', () => {
      const mockEvent = {
        reason: new Error('Test'),
        preventDefault: vi.fn(),
      };

      handler.handleUnhandledRejection(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Global Errors', () => {
    it('should show refresh message for global errors', () => {
      const mockEvent = {
        error: new Error('Global error'),
        preventDefault: vi.fn(),
      };

      handler.handleError(mockEvent);

      expect(mockToast).toHaveBeenCalledWith(
        'Something hiccupped. A quick refresh should fix it.'
      );
    });

    it('should handle errors without Error object', () => {
      const mockEvent = {
        message: 'Error message string',
        preventDefault: vi.fn(),
      };

      handler.handleError(mockEvent);

      expect(mockToast).toHaveBeenCalledWith(
        'Something went wrong. Please refresh the page.'
      );
    });

    it('should prevent default error handling', () => {
      const mockEvent = {
        error: new Error('Test'),
        preventDefault: vi.fn(),
      };

      handler.handleError(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });
});

describe('Error Message Security', () => {
  it('should not expose internal error details to users', () => {
    const mockToast = vi.fn();
    const handler = new ErrorHandler(mockToast);

    // Sensitive error that should NOT be shown to user
    const sensitiveError = new Error('Database connection failed: user=admin password=secret123');

    handler.handleUnhandledRejection({
      reason: sensitiveError,
      preventDefault: vi.fn(),
    });

    // Should show generic message, not the actual error
    expect(mockToast).not.toHaveBeenCalledWith(expect.stringContaining('password'));
    expect(mockToast).toHaveBeenCalledWith('An unexpected error occurred. Please try again.');
  });

  it('should not expose stack traces to users', () => {
    const mockToast = vi.fn();
    const handler = new ErrorHandler(mockToast);

    const errorWithStack = new Error('Test error');
    errorWithStack.stack = 'Error: Test error\n    at someFunction (file.js:123:45)';

    handler.handleUnhandledRejection({
      reason: errorWithStack,
      preventDefault: vi.fn(),
    });

    expect(mockToast).not.toHaveBeenCalledWith(expect.stringContaining('at someFunction'));
  });
});

describe('Error Handler Integration', () => {
  it('should work with common Supabase errors', () => {
    const mockToast = vi.fn();
    const handler = new ErrorHandler(mockToast);

    const supabaseError = {
      message: 'JWT expired',
      code: 'PGRST301',
    };

    handler.handleUnhandledRejection({
      reason: supabaseError,
      preventDefault: vi.fn(),
    });

    // Should still show generic message
    expect(mockToast).toHaveBeenCalledWith('An unexpected error occurred. Please try again.');
  });

  it('should handle network errors', () => {
    const mockToast = vi.fn();
    const handler = new ErrorHandler(mockToast);

    const networkError = new TypeError('Failed to fetch');

    handler.handleUnhandledRejection({
      reason: networkError,
      preventDefault: vi.fn(),
    });

    expect(mockToast).toHaveBeenCalled();
  });
});
