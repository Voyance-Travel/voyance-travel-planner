import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import SafeImage from '@/components/SafeImage';

interface HeroImageWithFallbackProps {
  src: string;
  alt: string;
  fallbackSources?: string[];
  overlayGradient?: string;
  className?: string;
  /** Optional external onLoad handler for additional validation */
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  /** Optional external onError handler */
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Hero image component with fallback support
 * Tries multiple image sources if the primary fails
 * Also detects blank/tiny images that load successfully but contain no content
 */
export default function HeroImageWithFallback({
  src,
  alt,
  fallbackSources = [],
  overlayGradient = 'from-black/50 via-transparent to-black/50',
  className,
  onLoad: externalOnLoad,
  onError: externalOnError,
}: HeroImageWithFallbackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  const allSources = [src, ...fallbackSources];

  const handleError = useCallback(() => {
    if (currentIndex < allSources.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setHasError(true);
    }
  }, [currentIndex, allSources.length]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    handleError();
    externalOnError?.(e);
  }, [handleError, externalOnError]);

  /**
   * Validate image dimensions after load
   * Detects blank/tiny images that return HTTP 200 but contain no useful content
   * (e.g., expired TripAdvisor CDN URLs)
   */
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    
    // Check for blank/tiny images (expired CDN responses)
    if (img.naturalWidth < 10 || img.naturalHeight < 10) {
      console.warn('[HeroImage] Loaded but blank/tiny, triggering fallback:', allSources[currentIndex]);
      handleError();
      return;
    }
    
    // Call external onLoad for additional validation
    externalOnLoad?.(e);
  }, [currentIndex, allSources, handleError, externalOnLoad]);

  if (hasError) {
    // Fallback to a gradient background if all images fail
    return (
      <div
        className={cn(
          'w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20',
          className
        )}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <>
      <SafeImage
        src={allSources[currentIndex]}
        alt={alt}
        onError={handleImageError}
        onLoad={handleImageLoad}
        className={cn('object-cover', className)}
      />
      {overlayGradient && (
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-b',
            overlayGradient
          )}
          aria-hidden="true"
        />
      )}
    </>
  );
}