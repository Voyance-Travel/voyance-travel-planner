import { useState } from 'react';
import { cn } from '@/lib/utils';

interface HeroImageWithFallbackProps {
  src: string;
  alt: string;
  fallbackSources?: string[];
  overlayGradient?: string;
  className?: string;
}

/**
 * Hero image component with fallback support
 * Tries multiple image sources if the primary fails
 */
export default function HeroImageWithFallback({
  src,
  alt,
  fallbackSources = [],
  overlayGradient = 'from-black/50 via-transparent to-black/50',
  className,
}: HeroImageWithFallbackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  const allSources = [src, ...fallbackSources];

  const handleError = () => {
    if (currentIndex < allSources.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setHasError(true);
    }
  };

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
      <img
        src={allSources[currentIndex]}
        alt={alt}
        onError={handleError}
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
