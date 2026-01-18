import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RotatingCoverPhotoProps {
  customCoverUrl?: string | null;
  onChangeCover?: () => void;
  className?: string;
}

// Curated cover photos from stunning destinations
const COVER_PHOTOS = [
  {
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920&q=80',
    city: 'Tokyo',
    country: 'Japan',
  },
  {
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80',
    city: 'Paris',
    country: 'France',
  },
  {
    url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80',
    city: 'Bali',
    country: 'Indonesia',
  },
  {
    url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1920&q=80',
    city: 'Amalfi Coast',
    country: 'Italy',
  },
  {
    url: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=80',
    city: 'Maldives',
    country: 'Indian Ocean',
  },
];

export default function RotatingCoverPhoto({ 
  customCoverUrl, 
  onChangeCover,
  className 
}: RotatingCoverPhotoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-rotate every 8 seconds if no custom cover
  useEffect(() => {
    if (customCoverUrl) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % COVER_PHOTOS.length);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [customCoverUrl]);

  const currentPhoto = COVER_PHOTOS[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + COVER_PHOTOS.length) % COVER_PHOTOS.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % COVER_PHOTOS.length);
  };

  return (
    <div 
      className={cn("relative h-64 md:h-80 overflow-hidden", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cover Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={customCoverUrl || currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
          <img
            src={customCoverUrl || currentPhoto.url}
            alt={customCoverUrl ? 'Custom cover' : `${currentPhoto.city}, ${currentPhoto.country}`}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      
      {/* Location badge (only for rotating photos) */}
      {!customCoverUrl && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-4 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full"
        >
          <span className="text-white text-sm font-medium">
            📍 {currentPhoto.city}, {currentPhoto.country}
          </span>
        </motion.div>
      )}
      
      {/* Navigation controls (only show on hover for rotating photos) */}
      {!customCoverUrl && (
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-between px-4"
            >
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                onClick={goToNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      
      {/* Dots indicator */}
      {!customCoverUrl && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5">
          {COVER_PHOTOS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === currentIndex 
                  ? "bg-white w-6" 
                  : "bg-white/50 hover:bg-white/75"
              )}
            />
          ))}
        </div>
      )}
      
      {/* Change cover button */}
      {onChangeCover && (
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-4 right-4"
            >
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 bg-background/80 backdrop-blur-sm hover:bg-background"
                onClick={onChangeCover}
              >
                <Camera className="h-4 w-4" />
                Change Cover
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}