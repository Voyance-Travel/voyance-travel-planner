import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Image load states for tracking
 */
export const ImageLoadState = {
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
} as const;

export type ImageLoadState = typeof ImageLoadState[keyof typeof ImageLoadState];

/**
 * Singleton for managing concurrent image loads
 */
class ImageLoadManager {
  private static instance: ImageLoadManager;
  private loadingImages: Set<string> = new Set();
  private loadQueue: Array<{ src: string; callback: () => void }> = [];
  private maxConcurrent = 4;

  private constructor() {}

  public static getInstance(): ImageLoadManager {
    if (!ImageLoadManager.instance) {
      ImageLoadManager.instance = new ImageLoadManager();
    }
    return ImageLoadManager.instance;
  }

  public setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
  }

  public isAtCapacity(): boolean {
    return this.loadingImages.size >= this.maxConcurrent;
  }

  private processQueue(): void {
    if (this.loadQueue.length === 0 || this.isAtCapacity()) {
      return;
    }

    const next = this.loadQueue.shift();
    if (next) {
      this.loadImage(next.src, next.callback);
    }
  }

  public queueImageLoad(src: string, callback: () => void): void {
    if (!src || this.loadingImages.has(src)) return;

    if (!this.isAtCapacity()) {
      this.loadImage(src, callback);
    } else {
      this.loadQueue.push({ src, callback });
    }
  }

  private loadImage(src: string, callback: () => void): void {
    if (!src) return;
    this.loadingImages.add(src);

    const img = new Image();
    img.onload = () => {
      this.loadingImages.delete(src);
      callback();
      this.processQueue();
    };
    img.onerror = () => {
      this.loadingImages.delete(src);
      callback();
      this.processQueue();
    };
    img.src = src;
  }

  public freeSlot(src: string): void {
    this.loadingImages.delete(src);
    this.processQueue();
  }
}

/**
 * Hook for optimized image loading with queue management
 */
export function useOptimizedImage(
  src: string | undefined,
  fallbackSrc = ''
): {
  displaySrc: string;
  loadState: ImageLoadState;
  isVisible: boolean;
} {
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const [loadState, setLoadState] = useState<ImageLoadState>(ImageLoadState.IDLE);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const sourceRef = useRef<string | undefined>(src);

  useEffect(() => {
    const manager = ImageLoadManager.getInstance();

    if (sourceRef.current !== src) {
      sourceRef.current = src;
      setLoadState(ImageLoadState.IDLE);
      setDisplaySrc('');
      setIsVisible(false);
    }

    if (!src) {
      setLoadState(ImageLoadState.ERROR);
      setDisplaySrc(fallbackSrc);
      return;
    }

    setLoadState(ImageLoadState.LOADING);

    manager.queueImageLoad(src, () => {
      if (sourceRef.current === src) {
        setDisplaySrc(src);
        setLoadState(ImageLoadState.LOADED);
        setIsVisible(true);
      }
    });

    return () => {
      if (loadState === ImageLoadState.LOADING && src) {
        manager.freeSlot(src);
      }
    };
  }, [src, fallbackSrc, loadState]);

  return { displaySrc, loadState, isVisible };
}

/**
 * Hook for lazy loading images with intersection observer
 */
export function useLazyImage(
  src: string | undefined,
  options?: IntersectionObserverInit
): {
  ref: React.RefCallback<HTMLElement>;
  isInView: boolean;
  shouldLoad: boolean;
} {
  const [isInView, setIsInView] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          setIsInView(entry.isIntersecting);
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observerRef.current?.disconnect();
          }
        },
        {
          rootMargin: '100px',
          threshold: 0.1,
          ...options,
        }
      );

      observerRef.current.observe(node);
    },
    [options]
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { ref, isInView, shouldLoad };
}

/**
 * Set max concurrent image loads
 */
export function setMaxConcurrentImageLoads(max: number): void {
  ImageLoadManager.getInstance().setMaxConcurrent(max);
}

/**
 * Check if image is cached by browser
 */
export function isImageCached(src: string): boolean {
  if (!src) return false;
  const img = new Image();
  img.src = src;
  return img.complete;
}

/**
 * Validate if URL is a valid image URL
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed !== '' &&
    !trimmed.includes('undefined') &&
    !trimmed.includes('null') &&
    (trimmed.startsWith('/') || trimmed.startsWith('http'))
  );
}
