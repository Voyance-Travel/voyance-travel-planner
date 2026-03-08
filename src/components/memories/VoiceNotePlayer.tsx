/**
 * VoiceNotePlayer
 * Inline mini-player for a single voice note on an activity card
 */

import { useState, useCallback } from 'react';
import { Mic, Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface VoiceNotePlayerProps {
  tripId: string;
  activityId: string;
}

export function VoiceNotePlayer({ tripId, activityId }: VoiceNotePlayerProps) {
  const { user } = useAuth();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlay = useCallback(async () => {
    if (playing && audio) {
      audio.pause();
      setPlaying(false);
      return;
    }

    if (signedUrl && audio) {
      audio.play();
      setPlaying(true);
      return;
    }

    if (!user) return;
    setLoading(true);

    try {
      const prefix = `${user.id}/${tripId}/${activityId}`;
      const { data: files } = await supabase.storage
        .from('trip-photos')
        .list(prefix, { search: 'voice_' });

      const voiceFile = files?.find(f => f.name.startsWith('voice_'));
      if (!voiceFile) return;

      const { data } = await supabase.storage
        .from('trip-photos')
        .createSignedUrl(`${prefix}/${voiceFile.name}`, 3600);

      if (data?.signedUrl) {
        setSignedUrl(data.signedUrl);
        const el = new Audio(data.signedUrl);
        el.onended = () => setPlaying(false);
        el.play();
        setPlaying(true);
        setAudio(el);
      }
    } finally {
      setLoading(false);
    }
  }, [user, tripId, activityId, signedUrl, audio, playing]);

  return (
    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
      <Mic className="w-3 h-3" />
      <span>Voice note saved</span>
      <button
        onClick={handlePlay}
        disabled={loading}
        className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
      >
        {loading ? (
          <span>Loading…</span>
        ) : playing ? (
          <>
            <Pause className="w-3 h-3" />
            <span>Pause</span>
          </>
        ) : (
          <>
            <Play className="w-3 h-3" />
            <span>Play</span>
          </>
        )}
      </button>
    </div>
  );
}
