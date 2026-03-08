/**
 * VoiceNotesList
 * Lists and plays voice notes recorded during a trip
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mic, Play, Pause, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface VoiceNote {
  filePath: string;
  fileName: string;
  activityId: string;
  activityName?: string;
  feedbackText?: string;
  signedUrl?: string;
}

interface VoiceNotesListProps {
  tripId: string;
  className?: string;
}

async function fetchVoiceNotes(tripId: string, userId: string): Promise<VoiceNote[]> {
  // Get feedback entries with voice notes
  const { data: feedbackRows, error: fbErr } = await supabase
    .from('activity_feedback')
    .select('activity_id, feedback_text, personalization_tags')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .contains('personalization_tags', ['has_voice_note']);

  if (fbErr) throw fbErr;
  if (!feedbackRows || feedbackRows.length === 0) return [];

  const notes: VoiceNote[] = [];

  for (const fb of feedbackRows) {
    const prefix = `${userId}/${tripId}/${fb.activity_id}`;
    const { data: files, error: listErr } = await supabase.storage
      .from('trip-photos')
      .list(prefix, { search: 'voice_' });

    if (listErr || !files) continue;

    for (const file of files) {
      if (!file.name.startsWith('voice_')) continue;

      const filePath = `${prefix}/${file.name}`;
      const { data: urlData } = await supabase.storage
        .from('trip-photos')
        .createSignedUrl(filePath, 3600);

      notes.push({
        filePath,
        fileName: file.name,
        activityId: fb.activity_id,
        feedbackText: fb.feedback_text || undefined,
        signedUrl: urlData?.signedUrl,
      });
    }
  }

  return notes;
}

export function VoiceNotesList({ tripId, className }: VoiceNotesListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: voiceNotes = [], isLoading } = useQuery({
    queryKey: ['voice-notes', tripId],
    queryFn: () => fetchVoiceNotes(tripId, user!.id),
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const { error } = await supabase.storage.from('trip-photos').remove([filePath]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-notes', tripId] });
      setDeleteTarget(null);
    },
  });

  const togglePlay = useCallback((url: string) => {
    if (playingUrl === url && audioEl) {
      audioEl.pause();
      setPlayingUrl(null);
      setAudioEl(null);
      return;
    }

    if (audioEl) {
      audioEl.pause();
    }

    const audio = new Audio(url);
    audio.play();
    audio.onended = () => {
      setPlayingUrl(null);
      setAudioEl(null);
    };
    setPlayingUrl(url);
    setAudioEl(audio);
  }, [playingUrl, audioEl]);

  if (isLoading || voiceNotes.length === 0) return null;

  // Extract duration from feedback_text like "[Voice note: 5s]"
  const parseDuration = (text?: string) => {
    if (!text) return null;
    const match = text.match(/\[Voice note: (\d+)s\]/);
    return match ? `${match[1]}s` : null;
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Voice Notes
        </h3>
        <span className="text-xs text-muted-foreground">
          · {voiceNotes.length} {voiceNotes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      <div className="space-y-2">
        {voiceNotes.map((note) => {
          const duration = parseDuration(note.feedbackText);
          const isPlaying = playingUrl === note.signedUrl;

          return (
            <div
              key={note.filePath}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 group"
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 shrink-0"
                onClick={() => note.signedUrl && togglePlay(note.signedUrl)}
                disabled={!note.signedUrl}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-primary" />
                ) : (
                  <Play className="w-4 h-4 text-primary ml-0.5" />
                )}
              </Button>

              <div className="flex-1 min-w-0">
                {note.activityName && (
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                    {note.activityName}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {duration ? `${duration} voice note` : 'Voice note'}
                </p>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setDeleteTarget(note.filePath)}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this voice note?</AlertDialogTitle>
            <AlertDialogDescription>
              This voice note will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
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
