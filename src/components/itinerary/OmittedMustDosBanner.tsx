/**
 * OmittedMustDosBanner — Phase 3 of the schema-driven pipeline.
 *
 * Reads `trips.metadata.omitted_must_dos` (written by the Trip Planner LLM
 * BEFORE per-day generation begins) and surfaces an honest "we couldn't fit
 * everything you asked for" notice with each item's reason and a suggestion.
 *
 * Purely presentational. Hidden when there's nothing to show.
 */

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface OmittedMustDo {
  mustDoTitle: string;
  reason:
    | 'not_enough_time'
    | 'wrong_day_type'
    | 'no_compatible_slot'
    | 'duplicate'
    | 'low_priority_after_anchors'
    | 'other';
  detail?: string | null;
  suggestion?: string | null;
}

interface OmittedMustDosBannerProps {
  items: OmittedMustDo[] | null | undefined;
  className?: string;
}

const REASON_LABEL: Record<OmittedMustDo['reason'], string> = {
  not_enough_time: 'Not enough time across the trip',
  wrong_day_type: "Didn't fit any day's pace",
  no_compatible_slot: 'No matching activity slot',
  duplicate: 'Already covered by another stop',
  low_priority_after_anchors: 'Pushed out by higher-priority anchors',
  other: 'Could not fit',
};

export function OmittedMustDosBanner({ items, className }: OmittedMustDosBannerProps) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-amber-500/30 bg-amber-500/5 dark:border-amber-400/20',
        className,
      )}
    >
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-transparent"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-medium">
              We couldn't fit {items.length} of your must-do
              {items.length === 1 ? '' : 's'}
            </div>
            <div className="text-xs text-muted-foreground">
              Review what was left out and decide whether to swap, drop, or extend the trip.
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {open && (
        <ul className="px-4 pb-4 space-y-3">
          {items.map((it, i) => (
            <li
              key={`${it.mustDoTitle}-${i}`}
              className="rounded-lg border border-amber-500/20 bg-background/60 p-3"
            >
              <div className="text-sm font-medium">{it.mustDoTitle}</div>
              <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {REASON_LABEL[it.reason] ?? REASON_LABEL.other}
              </div>
              {it.detail && (
                <div className="text-xs text-muted-foreground mt-1">{it.detail}</div>
              )}
              {it.suggestion && (
                <div className="text-xs mt-1">
                  <span className="font-medium">Suggestion:</span> {it.suggestion}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
