/**
 * MemoryUploadButton
 * Compact button + modal for capturing trip memories (photo upload + optional caption)
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Upload, Loader2, MapPin, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUploadMemory } from '@/services/tripMemoriesAPI';
import { cn } from '@/lib/utils';

interface MemoryUploadButtonProps {
  tripId: string;
  activityId?: string;
  activityName?: string;
  locationName?: string;
  dayNumber?: number;
  variant?: 'icon' | 'full';
  className?: string;
}

export function MemoryUploadButton({
  tripId,
  activityId,
  activityName,
  locationName,
  dayNumber,
  variant = 'icon',
  className,
}: MemoryUploadButtonProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadMemory();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    await uploadMutation.mutateAsync({
      tripId,
      file: selectedFile,
      activityId,
      activityName,
      caption: caption.trim() || undefined,
      locationName,
      dayNumber,
    });

    // Reset and close
    setPreview(null);
    setSelectedFile(null);
    setCaption('');
    setOpen(false);
  }, [selectedFile, tripId, activityId, activityName, caption, locationName, dayNumber, uploadMutation]);

  const handleClose = useCallback(() => {
    if (!uploadMutation.isPending) {
      setOpen(false);
      setPreview(null);
      setSelectedFile(null);
      setCaption('');
    }
  }, [uploadMutation.isPending]);

  return (
    <>
      {variant === 'icon' ? (
        <Button
          size="icon"
          variant="ghost"
          className={cn('h-8 w-8', className)}
          onClick={() => setOpen(true)}
        >
          <Camera className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className={cn('gap-1.5', className)}
          onClick={() => setOpen(true)}
        >
          <Camera className="w-3.5 h-3.5" />
          Capture Memory
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Capture a Memory
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Photo preview or upload area */}
            {preview ? (
              <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 flex flex-col items-center justify-center gap-3 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Tap to add a photo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG up to 20MB</p>
                </div>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Context info */}
            {(activityName || locationName) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{activityName || locationName}</span>
              </div>
            )}

            {/* Caption input */}
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Add a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="pl-9"
                maxLength={200}
                disabled={uploadMutation.isPending}
              />
            </div>

            {/* Upload button */}
            <Button
              className="w-full gap-2"
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={handleUpload}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Save Memory
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
