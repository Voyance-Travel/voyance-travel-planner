import { useState, useRef } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PhotoItem {
  url: string;
  caption: string;
}

interface PhotoUploadGridProps {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  userId: string;
  guideId: string;
  sectionId: string;
  maxPhotos?: number;
  readonly?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function PhotoUploadGrid({
  photos,
  onChange,
  userId,
  guideId,
  sectionId,
  maxPhotos = 4,
  readonly = false,
}: PhotoUploadGridProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxPhotos} photos per activity`);
      return;
    }

    const validFiles = files.slice(0, remaining).filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Only JPG, PNG, and WebP are accepted`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: Max file size is 5MB`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    setUploading(true);
    const newPhotos: PhotoItem[] = [];

    for (const file of validFiles) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${guideId}/${sectionId}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('guide-photos')
        .upload(path, file, { contentType: file.type });

      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('guide-photos')
        .getPublicUrl(path);

      newPhotos.push({ url: urlData.publicUrl, caption: '' });
    }

    if (newPhotos.length > 0) {
      onChange([...photos, ...newPhotos]);
      toast.success(`${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} uploaded`);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async (index: number) => {
    const photo = photos[index];
    // Try to delete from storage (best effort)
    try {
      const url = new URL(photo.url);
      const pathMatch = url.pathname.match(/\/guide-photos\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from('guide-photos').remove([pathMatch[1]]);
      }
    } catch { /* ignore */ }

    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative group aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={photo.url}
                alt={photo.caption || `Photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
              {!readonly && (
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-background/80 text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemove(i)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readonly && photos.length < maxPhotos && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs w-full"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            {uploading ? 'Uploading…' : `Add Photos (${photos.length}/${maxPhotos})`}
          </Button>
        </>
      )}
    </div>
  );
}
