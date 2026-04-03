import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronLeft, ChevronRight, Upload, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

interface RotatingCoverPhotoProps {
  customCoverUrl?: string | null;
  userId?: string;
  onCoverChange?: (url: string | null) => void;
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
  userId,
  onCoverChange,
  className 
}: RotatingCoverPhotoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localCustomUrl, setLocalCustomUrl] = useState(customCoverUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-rotate every 8 seconds if no custom cover
  useEffect(() => {
    if (localCustomUrl) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % COVER_PHOTOS.length);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [localCustomUrl]);

  const currentPhoto = COVER_PHOTOS[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + COVER_PHOTOS.length) % COVER_PHOTOS.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % COVER_PHOTOS.length);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/cover-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setLocalCustomUrl(publicUrl);
      onCoverChange?.(publicUrl);
      setShowPicker(false);
      toast.success('Cover photo updated!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const selectPreset = (url: string) => {
    setLocalCustomUrl(url);
    onCoverChange?.(url);
    setShowPicker(false);
    toast.success('Cover photo updated!');
  };

  const resetToDefault = () => {
    setLocalCustomUrl(null);
    onCoverChange?.(null);
    setShowPicker(false);
    toast.success('Cover reset to default');
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
          key={localCustomUrl || currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
          <img
            src={localCustomUrl || currentPhoto.url}
            alt={localCustomUrl ? 'Custom cover' : `${currentPhoto.city}, ${currentPhoto.country}`}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      
      {/* Navigation controls (only show on hover for rotating photos) */}
      {!localCustomUrl && (
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
      {!localCustomUrl && (
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
      {userId && (
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
                onClick={() => setShowPicker(!showPicker)}
              >
                <Camera className="h-4 w-4" />
                Change Cover
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Cover Picker Modal */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/95 backdrop-blur-sm z-20 flex flex-col"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Choose Cover Photo</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPicker(false)} aria-label="Close photo picker">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Upload Option */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Upload your own</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Upload Image'}
                </Button>
              </div>

              {/* Preset Options */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Or choose a preset</p>
                <div className="grid grid-cols-3 gap-2">
                  {COVER_PHOTOS.map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => selectPreset(photo.url)}
                      className={cn(
                        "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                        localCustomUrl === photo.url 
                          ? "border-primary ring-2 ring-primary/20" 
                          : "border-transparent hover:border-muted-foreground/50"
                      )}
                    >
                      <img
                        src={photo.url}
                        alt={`${photo.city}, ${photo.country}`}
                        className="w-full h-full object-cover"
                      />
                      {localCustomUrl === photo.url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-1">
                        <p className="text-xs text-white truncate">{photo.city}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Option */}
              {localCustomUrl && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={resetToDefault}
                >
                  Reset to rotating default
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
