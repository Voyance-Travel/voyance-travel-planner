import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { prefetchDestinationImages } from '@/utils/imagePrefetch';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

interface DynamicDestinationPhotosProps {
  destination: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  variant?: 'hero' | 'compact' | 'banner';
  className?: string;
  hideOverlayText?: boolean;
}

interface DestinationImage {
  id: string;
  url: string;
  alt: string;
  type: string;
  source: 'curated' | 'database' | 'google_places' | 'lovable_ai' | 'pexels' | 'fallback';
}

/**
 * Simplified destination photos component
 * - Uses landmark-driven fetching from backend (POI-based queries)
 * - Shows only 1 photo (single hero, no carousel)
 * - Backend already uses points_of_interest for relevant landmark searches
 */
export default function DynamicDestinationPhotos({
  destination,
  startDate,
  endDate,
  travelers,
  variant = 'hero',
  className = '',
  hideOverlayText = false,
}: DynamicDestinationPhotosProps) {
  const [heroImage, setHeroImage] = useState<DestinationImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Clean destination name (remove airport code)
  const cleanDestination = destination
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    .trim();

  // Track if we've already fetched for this destination
  const fetchedRef = useRef<string | null>(null);

  // Fetch single hero image (landmark-driven from backend)
  useEffect(() => {
    if (!cleanDestination) return;

    // Skip if we already fetched for this exact destination
    if (fetchedRef.current === cleanDestination && heroImage) {
      return;
    }

    const loadImage = async () => {
      setIsLoading(true);
      setError(false);

      try {
        // Fetching landmark-driven image

        // Trigger prefetch for future use
        prefetchDestinationImages(cleanDestination);

        // Fetch only 1 image - backend uses POI-based query for relevance
        const { getDestinationImages: fetchDestinationImages } = await import('@/services/destinationImagesAPI');
        const fetchedImages = await fetchDestinationImages({
          destination: cleanDestination,
          imageType: 'hero',
          limit: 1, // Only 1 image - no carousel
        });

        if (fetchedImages.length > 0) {
          // Got landmark image
          setHeroImage(fetchedImages[0]);
          fetchedRef.current = cleanDestination;
        } else {
          // No images returned
          setError(true);
        }
      } catch (err) {
        console.error('[DynamicPhotos] Fetch error:', err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [cleanDestination]);

  const formatDateRange = () => {
    if (!startDate || !endDate) return null;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } catch {
      return null;
    }
  };

  const heroSrc = heroImage ? normalizeUnsplashUrl(heroImage.url) : '';

  // Generate gradient fallback
  const getGradientStyle = () => {
    let hash = 0;
    for (let i = 0; i < cleanDestination.length; i++) {
      hash = cleanDestination.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 40) % 360;
    return {
      background: `linear-gradient(135deg, hsl(${hue1}, 60%, 35%), hsl(${hue2}, 70%, 25%))`,
    };
  };

  // Compact variant - loading
  if (isLoading && variant === 'compact') {
    return (
      <div className={`relative rounded-xl overflow-hidden h-20 ${className}`} style={getGradientStyle()}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
        </div>
        <div className="absolute inset-0 p-3 flex items-center" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          <div className="flex items-center gap-2 text-white text-sm">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{cleanDestination}</span>
          </div>
        </div>
      </div>
    );
  }

  // Loading state for hero/banner
  if (isLoading) {
    return (
      <div className={`relative rounded-2xl overflow-hidden ${variant === 'banner' ? 'h-32' : 'h-56 md:h-72'} ${className}`} style={getGradientStyle()}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
        </div>
        {!hideOverlayText && (
          <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            <div className="flex items-center gap-2 text-white mb-2">
              <MapPin className="w-5 h-5" />
              <h2 className="text-3xl md:text-4xl font-serif font-semibold">{cleanDestination}</h2>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Error/no image - show gradient with text overlay
  if (error || !heroImage) {
    if (variant === 'compact') {
      return (
        <div className={`relative rounded-xl overflow-hidden h-20 ${className}`} style={getGradientStyle()}>
          <div className="absolute inset-0 p-3 flex items-center">
            <div className="flex items-center gap-2 text-white text-sm">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{cleanDestination}</span>
            </div>
          </div>
        </div>
      );
    }

    if (variant === 'banner') {
      return (
        <div className={`relative rounded-2xl overflow-hidden h-32 ${className}`} style={getGradientStyle()}>
          <div className="absolute inset-0 p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-white mb-1">
                <MapPin className="w-5 h-5" />
                <h3 className="text-xl font-serif font-semibold">{cleanDestination}</h3>
              </div>
              <div className="flex items-center gap-4 text-white/80 text-sm">
                {formatDateRange() && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {formatDateRange()}
                  </span>
                )}
                {travelers && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {travelers} traveler{travelers > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`relative rounded-2xl overflow-hidden h-56 md:h-72 ${className}`} style={getGradientStyle()}>
        {!hideOverlayText && (
          <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            <div className="flex items-center gap-2 text-white mb-2">
              <MapPin className="w-5 h-5" />
              <h2 className="text-3xl md:text-4xl font-serif font-semibold">{cleanDestination}</h2>
            </div>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              {formatDateRange() && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDateRange()}
                </span>
              )}
              {travelers && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {travelers} traveler{travelers > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Compact variant with image
  if (variant === 'compact') {
    return (
      <div className={`relative rounded-xl overflow-hidden h-20 bg-muted ${className}`}>
        <img
          src={heroSrc}
          alt={heroImage.alt || cleanDestination}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => { setHeroImage(null); setError(true); }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
        <div className="absolute inset-0 p-3 flex items-center">
          <div className="flex items-center gap-2 text-white text-sm">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{cleanDestination}</span>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant with image
  if (variant === 'banner') {
    return (
      <div className={`relative rounded-2xl overflow-hidden h-32 bg-muted ${className}`}>
        <img
          src={heroSrc}
          alt={heroImage.alt || cleanDestination}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => { setHeroImage(null); setError(true); }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
         <div className="absolute inset-0 p-5 flex items-center justify-between" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          <div>
            <div className="flex items-center gap-2 text-white mb-1">
              <MapPin className="w-5 h-5" />
              <h3 className="text-xl font-serif font-semibold">{cleanDestination}</h3>
            </div>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              {formatDateRange() && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDateRange()}
                </span>
              )}
              {travelers && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {travelers} traveler{travelers > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Hero variant (default) - single static image, no carousel
  return (
    <div className={`relative rounded-2xl overflow-hidden h-56 md:h-72 bg-muted ${className}`}>
      {/* Single hero image - landmark-driven */}
      <motion.img
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        src={heroSrc}
        alt={heroImage.alt || cleanDestination}
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => { setHeroImage(null); setError(true); }}
      />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
      
      {/* Content overlay */}
      {!hideOverlayText && (
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 text-white mb-2">
                <MapPin className="w-5 h-5" />
                <h2 className="text-3xl md:text-4xl font-serif font-semibold">{cleanDestination}</h2>
              </div>
              <div className="flex items-center gap-4 text-white/80 text-sm">
                {formatDateRange() && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {formatDateRange()}
                  </span>
                )}
                {travelers && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {travelers} traveler{travelers > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            
            {/* Source indicator */}
            {heroImage.source && heroImage.source !== 'fallback' && (
              <div className="text-white/50 text-xs">
                {heroImage.source === 'lovable_ai' && 'AI Generated'}
                {heroImage.source === 'google_places' && 'Places'}
                {heroImage.source === 'pexels' && 'Pexels'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
