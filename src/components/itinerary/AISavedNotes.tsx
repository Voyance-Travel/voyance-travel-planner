import { useState } from 'react';
import { Sparkles, X, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AISavedNote } from './ActivityConciergeSheet';

interface AISavedNotesProps {
  notes: AISavedNote[];
  onDeleteNote?: (noteId: string) => void;
}

export function AISavedNotes({ notes, onDeleteNote }: AISavedNotesProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!notes || notes.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors w-full"
      >
        <Sparkles className="h-3 w-3" />
        <span className="font-medium">AI Notes</span>
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-[16px] justify-center">
          {notes.length}
        </Badge>
        <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="relative bg-primary/[0.04] border border-primary/10 rounded-lg p-2.5 text-xs"
            >
              {onDeleteNote && (
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="absolute top-1.5 right-1.5 p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove note"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {note.query && (
                <p className="text-muted-foreground mb-1 italic text-[10px]">Q: {note.query}</p>
              )}
              <div className="prose prose-xs dark:prose-invert max-w-none [&>p]:mb-1 [&>ul]:mb-1 [&>ul]:ml-3 pr-4">
                <ReactMarkdown>{note.content}</ReactMarkdown>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {new Date(note.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
