/**
 * MemoriesTimeline
 * Gallery/timeline view of trip memories organized by day
 */

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Trash2, X, MapPin, Calendar, ImageOff } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTripMemories, useDeleteMemory, type TripMemory } from '@/services/tripMemoriesAPI';
import { MemoryUploadButton } from './MemoryUploadButton';
import { VoiceNotesList } from './VoiceNotesList';
import { cn } from '@/lib/utils';

interface MemoriesTimelineProps {
  tripId: string;
  tripName: string;
  className?: string;
}

export function MemoriesTimeline({ tripId, tripName, className }: MemoriesTimelineProps) {
  const { data: memories = [], isLoading } = useTripMemories(tripId);
  const deleteMutation = useDeleteMemory();
  const [lightboxImage, setLightboxImage] = useState<TripMemory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Group memories by day
  const groupedMemories = useMemo(() => {
    const groups = new Map<number | string, TripMemory[]>();
    
    memories.forEach(memory => {
      const key = memory.day_number || format(parseLocalDate(memory.taken_at), 'yyyy-MM-dd');
      const existing = groups.get(key) || [];
      existing.push(memory);
      groups.set(key, existing);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      });
  }, [memories]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget);
    setDeleteTarget(null);
    if (lightboxImage?.id === deleteTarget) setLightboxImage(null);
  }, [deleteTarget, deleteMutation, lightboxImage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Memories
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {memories.length} {memories.length === 1 ? 'photo' : 'photos'} captured
          </p>
        </div>
        <MemoryUploadButton tripId={tripId} variant="full" />
      </div>

      {/* Empty state */}
      {memories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">No memories yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Capture photos and voice notes during your trip to build a beautiful memory timeline
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grouped timeline */}
      {groupedMemories.map(([dayKey, dayMemories]) => (
        <div key={String(dayKey)}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {typeof dayKey === 'number' ? `Day ${dayKey}` : format(parseLocalDate(dayKey), 'EEEE, MMM d')}
            </h3>
            <span className="text-xs text-muted-foreground">
              · {dayMemories.length} {dayMemories.length === 1 ? 'photo' : 'photos'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {dayMemories.map((memory, idx) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="relative group cursor-pointer rounded-xl overflow-hidden aspect-square bg-muted"
                onClick={() => setLightboxImage(memory)}
              >
                <img
                  src={memory.image_url}
                  alt={memory.caption || 'Trip memory'}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />

                {/* Overlay with info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {memory.caption && (
                      <p className="text-white text-xs line-clamp-2">{memory.caption}</p>
                    )}
                    {memory.activity_name && (
                      <p className="text-white/70 text-[10px] flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {memory.activity_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(memory.id);
                  }}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      ))}

      {/* Voice Notes */}
      <VoiceNotesList tripId={tripId} />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
              onClick={() => setLightboxImage(null)}
            >
              <X className="w-6 h-6" />
            </Button>

            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage.image_url}
                alt={lightboxImage.caption || 'Trip memory'}
                className="w-full rounded-xl object-contain max-h-[70vh]"
              />
              <div className="mt-4 text-center">
                {lightboxImage.caption && (
                  <p className="text-white text-sm">{lightboxImage.caption}</p>
                )}
                <div className="flex items-center justify-center gap-3 mt-2 text-white/60 text-xs">
                  {lightboxImage.activity_name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {lightboxImage.activity_name}
                    </span>
                  )}
                  <span>{format(parseLocalDate(lightboxImage.taken_at), 'MMM d, h:mm a')}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              This photo will be permanently removed from your trip memories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
