/**
 * GuideBookmarkButton
 * Toggle bookmark (guide_favorite) for an activity within a trip.
 * When bookmarked, shows an "add note" link and note preview.
 * Standalone — does NOT modify InlineActivityRating.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Pencil } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import GuideNoteModal from './GuideNoteModal';

interface GuideBookmarkButtonProps {
  activityId: string;
  activityName?: string;
  tripId: string;
  compact?: boolean;
}

export function GuideBookmarkButton({ activityId, activityName, tripId, compact = false }: GuideBookmarkButtonProps) {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);

  // Check if this activity is already bookmarked (include note)
  const { data: existing } = useQuery({
    queryKey: ['guide-favorite', tripId, activityId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('guide_favorites')
        .select('id, note')
        .eq('trip_id', tripId)
        .eq('activity_id', activityId)
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 30_000,
  });

  const isBookmarked = optimistic !== null ? optimistic : !!existing;

  const toggle = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (existing) {
        const { error } = await supabase
          .from('guide_favorites')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('guide_favorites')
          .insert({ trip_id: tripId, activity_id: activityId, user_id: user.id });
        if (error) throw error;
      }
    },
    onMutate: () => {
      setOptimistic(!isBookmarked);
    },
    onSettled: () => {
      setOptimistic(null);
      queryClient.invalidateQueries({ queryKey: ['guide-favorite', tripId, activityId] });
      queryClient.invalidateQueries({ queryKey: ['guide-favorites-count', tripId] });
    },
    onError: () => {
      setOptimistic(null);
    },
  });

  // Save note mutation
  const saveNote = useMutation({
    mutationFn: async (note: string) => {
      if (!existing) throw new Error('No bookmark');
      const { error } = await supabase
        .from('guide_favorites')
        .update({ note: note || null })
        .eq('id', existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guide-favorite', tripId, activityId] });
      queryClient.invalidateQueries({ queryKey: ['guide-favorites-full', tripId] });
      setNoteModalOpen(false);
      toast.success('Note saved');
    },
    onError: () => toast.error('Failed to save note'),
  });

  const notePreview = existing?.note
    ? existing.note.length > 40
      ? existing.note.slice(0, 40) + '…'
      : existing.note
    : null;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          toggle.mutate();
        }}
        className={cn(
          'flex-shrink-0 transition-colors',
          compact ? 'h-7 w-7' : 'h-8 w-8',
          isBookmarked
            ? 'text-primary hover:text-primary/80'
            : 'text-muted-foreground hover:text-foreground'
        )}
        title={isBookmarked ? 'Remove from guide' : 'Save to guide'}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isBookmarked ? 'filled' : 'empty'}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Bookmark
              className={cn(compact ? 'w-4 h-4' : 'w-4.5 h-4.5')}
              fill={isBookmarked ? 'currentColor' : 'none'}
            />
          </motion.div>
        </AnimatePresence>
      </Button>

      {/* Note link + preview when bookmarked */}
      {isBookmarked && (
        <div className="flex flex-col items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNoteModalOpen(true);
            }}
            className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-0.5 transition-colors"
          >
            <Pencil className="h-2.5 w-2.5" />
            {notePreview ? 'edit note' : 'add note'}
          </button>
          {notePreview && (
            <p className="text-[10px] text-muted-foreground italic max-w-[120px] truncate mt-0.5">
              "{notePreview}"
            </p>
          )}
        </div>
      )}

      <GuideNoteModal
        open={noteModalOpen}
        onOpenChange={setNoteModalOpen}
        activityName={activityName || 'Activity'}
        currentNote={existing?.note || null}
        onSave={(note) => saveNote.mutate(note)}
        isPending={saveNote.isPending}
      />
    </div>
  );
}

export default GuideBookmarkButton;
