import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin, Calendar, Users, ImageOff, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getCachedImages, prefetchDestinationImages } from '@/utils/imagePrefetch';

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
  source: 'database' | 'google_places' | 'lovable_ai' | 'fallback';
}

export default function DynamicDestinationPhotos({
  destination,
  startDate,
  endDate,
  travelers,
  variant = 'hero',
  className = '',
  hideOverlayText = false,
}: DynamicDestinationPhotosProps) {
  const [images, setImages] = useState<DestinationImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Clean destination name (remove airport code)
  const cleanDestination = destination
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '') // Remove (XXX) airport codes
    .trim();

  // Track if we've already fetched for this destination to prevent re-fetching
  const fetchedRef = useRef<string | null>(null);

  // Fetch images from cache first, then backend if needed
  useEffect(() => {
    if (!cleanDestination) return;

    // Reset carousel index when destination changes
    setCurrentIndex(0);

    // Skip if we already fetched for this exact destination
    if (fetchedRef.current === cleanDestination && images.length > 0) {
      console.log('[DynamicPhotos] Already loaded for:', cleanDestination);
      return;
    }

    const loadImages = async () => {
      // First, check if images are already cached (normalize via util)
      const cachedUrls = getCachedImages(cleanDestination);
      if (cachedUrls.length > 0) {
        console.log('[DynamicPhotos] Using cached images for:', cleanDestination, cachedUrls.length);
        setImages(
          cachedUrls.map((url, i) => ({
            id: `cached-${i}`,
            url,
            alt: `${cleanDestination} view ${i + 1}`,
            type: 'hero',
            source: 'database' as const,
          }))
        );
        setIsLoading(false);
        fetchedRef.current = cleanDestination;
        return;
      }

      setIsLoading(true);
      setError(false);

      try {
        console.log('[DynamicPhotos] Fetching images for:', cleanDestination);

        // Trigger prefetch to populate persistent cache for future use
        prefetchDestinationImages(cleanDestination);

        const { data, error: fetchError } = await supabase.functions.invoke('destination-images', {
          body: {
            destination: cleanDestination,
            imageType: 'hero',
            limit: 4,
          },
        });

        if (fetchError) {
          console.error('[DynamicPhotos] Error:', fetchError);
          setError(true);
          return;
        }

        if (data?.images && data.images.length > 0) {
          console.log('[DynamicPhotos] Got images:', data.images.length, 'source:', data.source);
          setImages(data.images);
          fetchedRef.current = cleanDestination;
        } else {
          console.log('[DynamicPhotos] No images returned');
          setError(true);
        }
      } catch (err) {
        console.error('[DynamicPhotos] Fetch error:', err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadImages();
  }, [cleanDestination]);

  // Auto-rotate images
  useEffect(() => {
    if (isHovered || variant === 'compact' || images.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [images.length, isHovered, variant]);

  const goNext = useCallback(() => setCurrentIndex((prev) => (prev + 1) % images.length), [images.length]);
  const goPrev = useCallback(() => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length), [images.length]);

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

  // Loading state
  if (isLoading) {
    if (variant === 'compact') {
      return (
        <div className={`relative rounded-xl overflow-hidden h-20 ${className}`} style={getGradientStyle()}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
          </div>
          <div className="absolute inset-0 p-3 flex items-center">
            <div className="flex items-center gap-2 text-white text-sm">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{cleanDestination}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`relative rounded-2xl overflow-hidden ${variant === 'banner' ? 'h-32' : 'h-56 md:h-72'} ${className}`} style={getGradientStyle()}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
        </div>
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
          <div className="flex items-center gap-2 text-white mb-2">
            <MapPin className="w-5 h-5" />
            <h2 className="text-3xl md:text-4xl font-serif font-semibold">{cleanDestination}</h2>
          </div>
        </div>
      </div>
    );
  }

  // Error/no images - show gradient
  if (error || images.length === 0) {
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
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
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
      </div>
    );
  }

  const currentImage = images[currentIndex];

  if (variant === 'compact') {
    return (
      <div className={`relative rounded-xl overflow-hidden h-20 bg-muted ${className}`}>
        <img
          src={currentImage.url}
          alt={currentImage.alt || cleanDestination}
          className="absolute inset-0 w-full h-full object-cover"
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

  if (variant === 'banner') {
    return (
      <div 
        className={`relative rounded-2xl overflow-hidden h-32 bg-muted ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            src={currentImage.url}
            alt={currentImage.alt || cleanDestination}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
        
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
          
          {images.length > 1 && (
            <div className="flex gap-1">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex ? 'bg-white w-4' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Hero variant (default)
  return (
    <div 
      className={`relative rounded-2xl overflow-hidden h-56 md:h-72 bg-muted ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image Carousel */}
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          src={currentImage.url}
          alt={currentImage.alt || cleanDestination}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
      
      {/* Navigation Arrows */}
      {isHovered && images.length > 1 && (
        <>
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        </>
      )}
      
      {/* Dots Indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex 
                  ? 'bg-white w-6' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Content Overlay - only show if not hidden */}
      {!hideOverlayText && (
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
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
            
            {/* Image source indicator */}
            {currentImage.source && currentImage.source !== 'fallback' && (
              <div className="text-white/50 text-xs">
                {currentImage.source === 'lovable_ai' && '✨ AI Generated'}
                {currentImage.source === 'google_places' && '📍 Google Places'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
