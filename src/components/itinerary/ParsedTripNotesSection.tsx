/**
 * ParsedTripNotesSection — collapsible sections for accommodation notes
 * and practical tips extracted from user's pasted trip research.
 */

import { Hotel, Lightbulb } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ParsedTripMetadata {
  accommodationNotes?: string[];
  practicalTips?: string[];
  unparsed?: string[];
  source?: string;
}

interface ParsedTripNotesSectionProps {
  metadata: ParsedTripMetadata;
}

export function ParsedTripNotesSection({ metadata }: ParsedTripNotesSectionProps) {
  const hasAccommodation = metadata.accommodationNotes && metadata.accommodationNotes.length > 0;
  const hasTips = metadata.practicalTips && metadata.practicalTips.length > 0;

  if (!hasAccommodation && !hasTips) return null;

  return (
    <div className="space-y-3">
      {hasAccommodation && (
        <NoteBlock
          icon={<Hotel className="h-4 w-4" />}
          title="Accommodation Notes"
          items={metadata.accommodationNotes!}
        />
      )}
      {hasTips && (
        <NoteBlock
          icon={<Lightbulb className="h-4 w-4" />}
          title="Practical Tips"
          items={metadata.practicalTips!}
        />
      )}
    </div>
  );
}

function NoteBlock({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors group">
        <div className="flex items-center gap-2.5">
          <div className="text-primary">{icon}</div>
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-200",
          open && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 p-4 rounded-b-xl border border-t-0 border-border bg-card">
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary/60 mt-1 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
