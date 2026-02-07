/**
 * ActivityMediaCapture
 * Modal for attaching a photo or recording a voice note to an activity
 */

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, Mic, MicOff, X, Upload, 
  Image as ImageIcon, Check, Loader2, Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ActivityMediaCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
  activityName: string;
  tripId: string;
  mode: 'photo' | 'voice';
}

export function ActivityMediaCapture({
  open,
  onOpenChange,
  activityId,
  activityName,
  tripId,
  mode,
}: ActivityMediaCaptureProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Max 10MB.');
      return;
    }
    
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setAudioDuration(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      setRecording(true);

      // Timer
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setAudioDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setRecording(false);
        }
      }, 60000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let filePath = '';
      let fileToUpload: File | Blob | null = null;

      if (mode === 'photo' && selectedFile) {
        const ext = selectedFile.name.split('.').pop() || 'jpg';
        filePath = `${user.id}/${tripId}/${activityId}/photo_${Date.now()}.${ext}`;
        fileToUpload = selectedFile;
      } else if (mode === 'voice' && audioBlob) {
        filePath = `${user.id}/${tripId}/${activityId}/voice_${Date.now()}.webm`;
        fileToUpload = audioBlob;
      }

      if (!fileToUpload || !filePath) {
        toast.error('Nothing to upload');
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from('trip-photos')
        .upload(filePath, fileToUpload, {
          contentType: mode === 'photo' ? selectedFile?.type : 'audio/webm',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('trip-photos')
        .getPublicUrl(filePath);

      // Save reference in activity_feedback as metadata
      const { error: fbError } = await supabase
        .from('activity_feedback')
        .upsert({
          user_id: user.id,
          trip_id: tripId,
          activity_id: activityId,
          rating: 'liked', // Default rating when adding media
          personalization_tags: [mode === 'photo' ? 'has_photo' : 'has_voice_note'],
          feedback_text: mode === 'voice' ? `[Voice note: ${audioDuration}s]` : null,
        }, {
          onConflict: 'user_id,activity_id'
        });

      // Ignore feedback error — media is still uploaded
      if (fbError) console.warn('Feedback upsert warning:', fbError);

      toast.success(mode === 'photo' ? 'Photo saved!' : 'Voice note saved!');
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetState = useCallback(() => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setAudioBlob(null);
    setAudioDuration(0);
    setRecording(false);
  }, []);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {mode === 'photo' ? <Camera className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {mode === 'photo' ? 'Add Photo' : 'Voice Note'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{activityName}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo mode */}
          {mode === 'photo' && (
            <>
              {previewUrl ? (
                <div className="relative rounded-xl overflow-hidden aspect-video bg-muted">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => { setPreviewUrl(null); setSelectedFile(null); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-3 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Tap to add a photo</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG up to 10MB</p>
                  </div>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}

          {/* Voice mode */}
          {mode === 'voice' && (
            <div className="flex flex-col items-center gap-4 py-4">
              {!audioBlob ? (
                <>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={recording ? stopRecording : startRecording}
                    className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center transition-all',
                      recording
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                    )}
                  >
                    {recording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                  </motion.button>
                  <div className="text-center">
                    {recording ? (
                      <>
                        <p className="text-sm font-medium text-red-500">Recording...</p>
                        <p className="text-2xl font-mono font-bold">{formatDuration(audioDuration)}</p>
                        <p className="text-xs text-muted-foreground">Tap to stop (max 60s)</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Tap to record</p>
                        <p className="text-xs text-muted-foreground">Share your thoughts about this experience</p>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="w-full space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mic className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Voice note</p>
                      <p className="text-xs text-muted-foreground">{formatDuration(audioDuration)}</p>
                    </div>
                    <button onClick={resetState} className="p-1.5 rounded-full hover:bg-muted">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload button */}
          {((mode === 'photo' && selectedFile) || (mode === 'voice' && audioBlob)) && (
            <Button className="w-full gap-2" onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
              ) : (
                <><Upload className="w-4 h-4" />Save {mode === 'photo' ? 'Photo' : 'Voice Note'}</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityMediaCapture;
