import { ImgHTMLAttributes, SyntheticEvent, useMemo } from 'react';
import { normalizeUnsplashUrl, PLACEHOLDER_TRAVEL_SRC } from '@/utils/unsplash';

type SafeImageProps = ImgHTMLAttributes<HTMLImageElement>;

export default function SafeImage({
  src,
  alt,
  loading,
  onError,
  ...props
}: SafeImageProps) {
  const normalizedSrc = useMemo(() => normalizeUnsplashUrl(typeof src === 'string' ? src : ''), [src]);

  const handleError = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackApplied === 'true') return;
    img.dataset.fallbackApplied = 'true';
    img.src = PLACEHOLDER_TRAVEL_SRC;
    onError?.(e);
  };

  return (
    <img
      src={normalizedSrc}
      alt={alt ?? ''}
      loading={loading ?? 'lazy'}
      onError={handleError}
      {...props}
    />
  );
}
