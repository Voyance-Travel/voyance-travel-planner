/**
 * GuideNoteModal
 * Bottom-sheet style dialog for adding/editing a note on a guide favorite.
 */
import { useState, useEffect } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface GuideNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityName: string;
  currentNote: string | null;
  onSave: (note: string) => void;
  isPending: boolean;
}

const MAX_CHARS = 500;

export default function GuideNoteModal({
  open,
  onOpenChange,
  activityName,
  currentNote,
  onSave,
  isPending,
}: GuideNoteModalProps) {
  const [note, setNote] = useState(currentNote || '');

  useEffect(() => {
    if (open) setNote(currentNote || '');
  }, [open, currentNote]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4 text-primary" />
            Guide Note
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm font-medium text-foreground truncate">{activityName}</p>

        <div className="space-y-1.5">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Add a personal tip, recommendation, or memory…"
            maxLength={MAX_CHARS}
            rows={4}
            className="text-sm resize-none"
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-right">
            {note.length}/{MAX_CHARS}
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => onSave(note.trim())}
            className="gap-1.5"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
