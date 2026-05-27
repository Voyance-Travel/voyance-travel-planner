/**
 * FreeTimeMarker — calm inline acknowledgment of unscheduled time between
 * two activities. Replaces the "3h gap" warning yelling, treats open time
 * as a first-class part of the day.
 *
 * See mem://constraints/itinerary/believable-human-pacing-principle
 */

import { useState, useEffect } from 'react';
import { Coffee, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OpenWindow } from './TransitGapIndicator';

interface FreeTimeMarkerProps {
  window: OpenWindow;
  tripId?: string;
  dayNumber: number;
  beforeActivityId?: string;
  isEditable?: boolean;
  onAdd?: () => void;
}

function format12h(t?: string): string {
  if (!t) return '';
  const m = t.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const period = m[3];
  if (period) return `${h}:${min} ${period}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${min} ${ampm}`;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `~${h}h`;
  if (m < 15) return `~${h}h`;
  if (m >= 45) return `~${h + 1}h`;
  return `${h}h ${m}m`;
}

const LABEL: Record<OpenWindow['category'], string> = {
  short: 'Short break',
  free: 'Free time',
  long: 'Long open block',
};

const SUBTITLE: Record<OpenWindow['category'], string> = {
  short: 'Catch your breath, grab a coffee.',
  free: 'Rest, wander, or grab a bite — not every moment needs a plan.',
  long: 'A wide-open stretch. Wander, rest, or slot something in.',
};

export function FreeTimeMarker({
  window: w,
  tripId,
  dayNumber,
  beforeActivityId,
  isEditable,
  onAdd,
}: FreeTimeMarkerProps) {
  const storageKey = tripId && beforeActivityId
    ? `voyance.freeTime.dismiss.${tripId}.${dayNumber}.${beforeActivityId}`
    : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try { setDismissed(!!localStorage.getItem(storageKey)); } catch { /* ignore */ }
  }, [storageKey]);

  const dismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    }
  };

  const duration = formatDuration(w.minutes);
  const fromTo = w.fromTime && w.toTime ? `${format12h(w.fromTime)} – ${format12h(w.toTime)}` : '';

  if (dismissed) {
    return (
      <div className="flex items-center gap-2 pl-7 sm:pl-[12.5rem] py-1.5 text-[11px] text-muted-foreground/80">
        <Coffee className="h-3 w-3" aria-hidden="true" />
        <span>{LABEL[w.category]} · {duration}{fromTo ? ` · ${fromTo}` : ''}</span>
      </div>
    );
  }

  return (
    <div className="px-2 sm:pl-[12.5rem] sm:pr-2 py-1.5">
      <div
        className={cn(
          'rounded-lg border border-dashed border-border/70 bg-muted/30',
          'px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3',
        )}
        role="note"
        aria-label={`${LABEL[w.category]} between activities`}
      >
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <Coffee className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col min-w-0">
            <div className="text-xs font-medium text-foreground">
              {LABEL[w.category]} · {duration}
              {fromTo ? <span className="text-muted-foreground font-normal"> · {fromTo}</span> : null}
            </div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              {SUBTITLE[w.category]}
            </div>
          </div>
        </div>
        {isEditable && (
          <div className="flex items-center gap-1 shrink-0">
            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex items-center gap-1 text-[11px] text-foreground hover:text-primary transition-colors px-2 py-1 rounded-full border border-border hover:border-primary/40 bg-background"
              >
                <Plus className="h-3 w-3" />
                Add something
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full"
              aria-label="Keep this time open"
            >
              <X className="h-3 w-3" />
              Keep it open
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
