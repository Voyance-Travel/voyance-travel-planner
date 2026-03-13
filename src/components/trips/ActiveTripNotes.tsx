/**
 * ActiveTripNotes — Inline text notes for the live trip view.
 * Reads/writes the `trip_notes` table, filtered by day_number.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Heart, Lightbulb, MapPin, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type NoteType = 'memory' | 'tip' | 'saved_place' | 'discovery' | 'regret';

interface TripNote {
  id: string;
  trip_id: string;
  note_type: NoteType;
  content: string;
  location?: string;
  day_number?: number;
  created_at: string;
}

const NOTE_TYPES: Record<NoteType, { label: string; icon: typeof Heart; color: string }> = {
  memory: { label: 'Memory', icon: Heart, color: 'text-pink-500' },
  tip: { label: 'Tip', icon: Lightbulb, color: 'text-amber-500' },
  saved_place: { label: 'Place', icon: MapPin, color: 'text-blue-500' },
  discovery: { label: 'Discovery', icon: Sparkles, color: 'text-purple-500' },
  regret: { label: 'Regret', icon: AlertCircle, color: 'text-orange-500' },
};

interface ActiveTripNotesProps {
  tripId: string;
  dayNumber: number;
}

export function ActiveTripNotes({ tripId, dayNumber }: ActiveTripNotesProps) {
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('memory');
  const [saving, setSaving] = useState(false);

  // Fetch notes for this day
  useEffect(() => {
    async function fetchNotes() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('trip_notes')
        .select('*')
        .eq('trip_id', tripId)
        .eq('day_number', dayNumber)
        .order('created_at', { ascending: false });

      if (data) setNotes(data as TripNote[]);
    }
    fetchNotes();
  }, [tripId, dayNumber]);

  const addNote = useCallback(async () => {
    if (!content.trim()) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase
      .from('trip_notes')
      .insert({
        trip_id: tripId,
        user_id: user.id,
        note_type: noteType,
        content: content.trim(),
        day_number: dayNumber,
      })
      .select()
      .single();

    setSaving(false);
    if (error) { toast.error('Failed to save note'); return; }

    setNotes(prev => [data as TripNote, ...prev]);
    setContent('');
    setShowInput(false);
    toast.success('Note saved');
  }, [content, noteType, tripId, dayNumber]);

  const deleteNote = useCallback(async (noteId: string) => {
    const { error } = await supabase
      .from('trip_notes')
      .delete()
      .eq('id', noteId);

    if (error) { toast.error('Failed to delete'); return; }
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }, []);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-serif text-sm font-medium text-muted-foreground italic">
          Journal
        </h4>
        {!showInput && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => setShowInput(true)}
          >
            <Plus className="w-3 h-3" />
            Add note
          </Button>
        )}
      </div>

      {/* Input area */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border/60 bg-card p-3 space-y-3">
              {/* Type selector */}
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(NOTE_TYPES) as [NoteType, typeof NOTE_TYPES['memory']][]).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setNoteType(key)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors border',
                        noteType === key
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className={cn('w-3 h-3', noteType === key ? config.color : '')} />
                      {config.label}
                    </button>
                  );
                })}
              </div>

              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you want to remember?"
                rows={2}
                className="text-sm resize-none border-0 bg-transparent p-0 focus-visible:ring-0 min-h-[60px]"
                autoFocus
              />

              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setShowInput(false); setContent(''); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={addNote}
                  disabled={!content.trim() || saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing notes */}
      <AnimatePresence>
        {notes.map((note) => {
          const config = NOTE_TYPES[note.note_type] || NOTE_TYPES.memory;
          const Icon = config.icon;

          return (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="group relative pl-4 border-l-2 border-primary/20"
            >
              <div className="flex items-start gap-2">
                <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', config.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{note.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                      {config.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), 'h:mm a')}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => deleteNote(note.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
