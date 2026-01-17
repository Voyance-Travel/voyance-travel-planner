/**
 * Performance Polyfill
 * Enhanced polyfill for PerformanceObserver to prevent warnings
 */

class NoopPerformanceObserver implements PerformanceObserver {
  static readonly supportedEntryTypes: ReadonlyArray<string> = [];

  constructor(_callback: PerformanceObserverCallback) {}

  observe(_options: PerformanceObserverInit): void {}

  disconnect(): void {}

  takeRecords(): PerformanceEntryList {
    return [];
  }
}

/**
 * Polyfill PerformanceObserver if needed
 */
export function polyfillPerformanceObserver(): void {
  if (typeof window === 'undefined') return;

  // If PerformanceObserver doesn't exist, use noop
  if (!window.PerformanceObserver) {
    (window as unknown as { PerformanceObserver: typeof NoopPerformanceObserver }).PerformanceObserver = NoopPerformanceObserver;
    return;
  }

  // Add supportedEntryTypes if missing
  if (!('supportedEntryTypes' in window.PerformanceObserver)) {
    try {
      Object.defineProperty(window.PerformanceObserver, 'supportedEntryTypes', {
        value: [],
        configurable: true,
        enumerable: true,
        writable: false,
      });
    } catch {
      // Silently fail
    }
  }

  // Wrap observe method to handle unsupported entry types
  const originalObserve = window.PerformanceObserver.prototype.observe;
  window.PerformanceObserver.prototype.observe = function (
    options: PerformanceObserverInit
  ): void {
    try {
      originalObserve.call(this, options);
    } catch {
      // Silently fail for unsupported entry types
    }
  };
}

/**
 * Setup performance monitoring (safe version)
 */
export function setupPerformanceMonitoring(): void {
  if (typeof window === 'undefined' || !window.PerformanceObserver) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      // Log slow resources in development
      if (import.meta.env.DEV) {
        entries.forEach((entry) => {
          if (entry.entryType === 'resource' && entry.duration > 1000) {
            console.debug(`Slow resource: ${entry.name} (${Math.round(entry.duration)}ms)`);
          }
        });
      }
    });

    // Observe without buffered flag to avoid warnings
    observer.observe({
      entryTypes: ['resource', 'navigation'],
    });
  } catch {
    // Silently fail if not supported
  }
}

export default setupPerformanceMonitoring;
