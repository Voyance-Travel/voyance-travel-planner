/**
 * Integration Tests for GlobalErrorHandler
 * 
 * Tests that unhandled errors don't crash the app.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { GlobalErrorHandler } from '@/components/common/GlobalErrorHandler';

// Mock toast
const mockToast = {
  error: vi.fn(),
  success: vi.fn(),
};

vi.mock('@/utils/simpleToast', () => ({
  default: mockToast,
}));

describe('GlobalErrorHandler', () => {
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  let eventListeners: Map<string, EventListener>;

  beforeEach(() => {
    vi.clearAllMocks();
    eventListeners = new Map();
    
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;
    
    window.addEventListener = vi.fn((type: string, listener: EventListener) => {
      eventListeners.set(type, listener);
    });
    
    window.removeEventListener = vi.fn((type: string) => {
      eventListeners.delete(type);
    });
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  it('should register event listeners on mount', () => {
    render(<GlobalErrorHandler />);
    
    expect(window.addEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
    expect(window.addEventListener).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
  });

  it('should unregister event listeners on unmount', () => {
    const { unmount } = render(<GlobalErrorHandler />);
    
    unmount();
    
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
  });

  it('should show toast on unhandled promise rejection', () => {
    render(<GlobalErrorHandler />);
    
    const handler = eventListeners.get('unhandledrejection');
    expect(handler).toBeDefined();
    
    const mockEvent = {
      reason: new Error('Test rejection'),
      preventDefault: vi.fn(),
    };
    
    act(() => {
      handler!(mockEvent as unknown as Event);
    });
    
    expect(mockToast.error).toHaveBeenCalledWith(
      'An unexpected error occurred. Please try again.'
    );
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should show toast on global error', () => {
    render(<GlobalErrorHandler />);
    
    const handler = eventListeners.get('error');
    expect(handler).toBeDefined();
    
    const mockEvent = {
      error: new Error('Test error'),
      message: 'Test error message',
      preventDefault: vi.fn(),
    };
    
    act(() => {
      handler!(mockEvent as unknown as Event);
    });
    
    expect(mockToast.error).toHaveBeenCalledWith(
      'Something went wrong. Please refresh the page.'
    );
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should handle string rejection reasons', () => {
    render(<GlobalErrorHandler />);
    
    const handler = eventListeners.get('unhandledrejection');
    
    const mockEvent = {
      reason: 'String error message',
      preventDefault: vi.fn(),
    };
    
    act(() => {
      handler!(mockEvent as unknown as Event);
    });
    
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('should render null (no visible UI)', () => {
    const { container } = render(<GlobalErrorHandler />);
    
    expect(container.firstChild).toBeNull();
  });
});
