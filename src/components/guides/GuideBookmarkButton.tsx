/**
 * GuideBookmarkButton
 * Toggle bookmark (guide_favorite) for an activity within a trip.
 * Standalone — does NOT modify InlineActivityRating.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface GuideBookmarkButtonProps {
  activityId: string;
  tripId: string;
  compact?: boolean;
}

export function GuideBookmarkButton({ activityId, tripId, compact = false }: GuideBookmarkButtonProps) {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  // Check if this activity is already bookmarked
  const { data: existing } = useQuery({
    queryKey: ['guide-favorite', tripId, activityId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('guide_favorites')
        .select('id')
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

  return (
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
  );
}

export default GuideBookmarkButton;
