/**
 * Trip Notes Component
 * Personal journal entries and memories from the trip
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, MapPin, Lightbulb, Heart, 
  AlertCircle, Sparkles, Calendar, Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TripNote {
  id: string;
  trip_id: string;
  note_type: 'memory' | 'tip' | 'saved_place' | 'regret' | 'discovery';
  content: string;
  location?: string;
  day_number?: number;
  created_at: string;
}

interface TripNotesProps {
  tripId: string;
  destination: string;
}

const NOTE_TYPES = {
  memory: { label: 'Memory', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  tip: { label: 'Tip', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  saved_place: { label: 'Saved Place', icon: MapPin, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  regret: { label: 'Regret', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  discovery: { label: 'Discovery', icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/10' },
} as const;

export function TripNotes({ tripId, destination }: TripNotesProps) {
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState({
    note_type: 'memory' as TripNote['note_type'],
    content: '',
    location: '',
    day_number: undefined as number | undefined,
  });

  useEffect(() => {
    fetchNotes();
  }, [tripId]);

  async function fetchNotes() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('trip_notes')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotes(data as TripNote[]);
    }
    setIsLoading(false);
  }

  async function addNote() {
    if (!newNote.content.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('trip_notes')
      .insert({
        trip_id: tripId,
        user_id: user.id,
        note_type: newNote.note_type,
        content: newNote.content,
        location: newNote.location || null,
        day_number: newNote.day_number || null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to save note');
      return;
    }

    setNotes([data as TripNote, ...notes]);
    setNewNote({ note_type: 'memory', content: '', location: '', day_number: undefined });
    toast.success('Note saved! Add another or close when done.');
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase
      .from('trip_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error('Failed to delete note');
      return;
    }

    setNotes(notes.filter(n => n.id !== noteId));
    toast.success('Note deleted');
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border p-8 text-center">
        <div className="animate-pulse text-muted-foreground">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{destination} · Trip Notes</h2>
          <p className="text-sm text-muted-foreground">
            Your personal travel journal
          </p>
        </div>
        <Button onClick={() => setShowAddNote(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="bg-card rounded-2xl border p-8 text-center">
          <Edit3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">No notes yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Capture memories, tips, and discoveries from your trip
          </p>
          <Button variant="outline" onClick={() => setShowAddNote(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Note
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {notes.map((note) => {
              const typeConfig = NOTE_TYPES[note.note_type] || NOTE_TYPES.memory;
              const Icon = typeConfig.icon;
              
              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-card rounded-xl border p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg', typeConfig.bg)}>
                      <Icon className={cn('w-4 h-4', typeConfig.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {typeConfig.label}
                        </Badge>
                        {note.day_number && (
                          <span className="text-xs text-muted-foreground">
                            Day {note.day_number}
                          </span>
                        )}
                        {note.location && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {note.location}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(note.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteNote(note.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a Note</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <Select
              value={newNote.note_type}
              onValueChange={(value) => setNewNote({ ...newNote, note_type: value as TripNote['note_type'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Note type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NOTE_TYPES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <config.icon className={cn('w-4 h-4', config.color)} />
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              placeholder="What do you want to remember?"
              value={newNote.content}
              onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
              rows={4}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Location (optional)"
                value={newNote.location}
                onChange={(e) => setNewNote({ ...newNote, location: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Day # (optional)"
                min={1}
                value={newNote.day_number || ''}
                onChange={(e) => setNewNote({ 
                  ...newNote, 
                  day_number: e.target.value ? parseInt(e.target.value) : undefined 
                })}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={addNote} disabled={!newNote.content.trim()}>
                Save Note
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowAddNote(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
