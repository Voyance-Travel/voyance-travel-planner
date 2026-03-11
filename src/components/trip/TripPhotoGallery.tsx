import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, 
  Plus, 
  Heart, 
  Trash2, 
  X, 
  Image as ImageIcon,
  Loader2,
  Star,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTripPhotos, TripPhoto } from '@/hooks/useTripPhotos';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TripPhotoGalleryProps {
  tripId: string;
  className?: string;
  /** Hide upload controls (used in preview mode) */
  hideUpload?: boolean;
}

export default function TripPhotoGallery({ tripId, className, hideUpload = false }: TripPhotoGalleryProps) {
  const { photos, isLoading, uploadPhoto, deletePhoto, toggleFavorite, setCoverPhoto } = useTripPhotos(tripId);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<TripPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        continue;
      }
      await uploadPhoto(file, { caption });
    }
    
    setIsUploading(false);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photo: TripPhoto) => {
    if (confirm('Delete this photo?')) {
      await deletePhoto(photo.id);
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto(null);
      }
    }
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    const newIndex = direction === 'prev' 
      ? (currentIndex - 1 + photos.length) % photos.length
      : (currentIndex + 1) % photos.length;
    setSelectedPhoto(photos[newIndex]);
  };

  const favoritePhotos = photos.filter(p => p.isFavorite);

  if (isLoading) {
    return (
      <div className={cn("bg-card rounded-2xl border border-border p-8", className)}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Camera className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Trip Photos</h2>
            <p className="text-sm text-muted-foreground">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} • {favoritePhotos.length} favorite{favoritePhotos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Upload Button — hidden in preview mode */}
        {!hideUpload && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            size="sm"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add Photos
          </Button>
        </div>
        )}
      </div>

      {/* Empty State */}
      {photos.length === 0 && !hideUpload && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/30 rounded-2xl border border-dashed border-border p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="h-8 w-8 text-primary/60" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">No photos yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Capture your trip memories! Upload photos from your adventure to create your personal travel gallery.
          </p>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Camera className="h-4 w-4 mr-2" />
            Upload Your First Photo
          </Button>
        </motion.div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo, index) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-muted"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img
                src={photo.publicUrl}
                alt={photo.caption || 'Trip photo'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {/* Badges */}
              <div className="absolute top-2 right-2 flex gap-1">
                {photo.isCover && (
                  <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" /> Cover
                  </span>
                )}
                {photo.isFavorite && (
                  <span className="bg-pink-500 text-white p-1 rounded-full">
                    <Heart className="h-3 w-3 fill-current" />
                  </span>
                )}
              </div>

              {/* Caption */}
              {photo.caption && (
                <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{photo.caption}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          {selectedPhoto && (
            <div className="relative">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedPhoto(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Navigation */}
              {photos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={(e) => { e.stopPropagation(); navigatePhoto('prev'); }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={(e) => { e.stopPropagation(); navigatePhoto('next'); }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              {/* Image */}
              <div className="flex items-center justify-center min-h-[60vh] p-8">
                <img
                  src={selectedPhoto.publicUrl}
                  alt={selectedPhoto.caption || 'Trip photo'}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>

              {/* Photo Info & Actions */}
              <div className="p-4 bg-black/80">
                <div className="flex items-center justify-between">
                  <div>
                    {selectedPhoto.caption && (
                      <p className="text-white font-medium">{selectedPhoto.caption}</p>
                    )}
                    <p className="text-white/60 text-sm">
                      {format(new Date(selectedPhoto.createdAt), 'MMM d, yyyy')}
                      {selectedPhoto.dayNumber && ` • Day ${selectedPhoto.dayNumber}`}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-white hover:bg-white/20",
                        selectedPhoto.isFavorite && "text-pink-500"
                      )}
                      onClick={() => toggleFavorite(selectedPhoto.id)}
                    >
                      <Heart className={cn("h-4 w-4", selectedPhoto.isFavorite && "fill-current")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-white hover:bg-white/20",
                        selectedPhoto.isCover && "text-primary"
                      )}
                      onClick={() => setCoverPhoto(selectedPhoto.id)}
                    >
                      <Star className={cn("h-4 w-4", selectedPhoto.isCover && "fill-current")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                      asChild
                    >
                      <a href={selectedPhoto.publicUrl} download={selectedPhoto.fileName}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:bg-red-500/20"
                      onClick={() => handleDelete(selectedPhoto)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
