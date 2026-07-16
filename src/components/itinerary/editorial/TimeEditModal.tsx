// Extracted from EditorialItinerary.tsx during the file-size decomposition.
// A small modal for editing an activity's start/end time, with an optional
// "shift everything after" cascade.
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { timeToMinutes, minutesToTime } from './time-utils';
import type { EditorialActivity } from '../EditorialItinerary';

// When an activity has no explicit end time, derive a sensible one (start + 90m)
// so the modal never opens with an impossible end-before-start (e.g. start 20:15,
// end 13:00). Clamped to end-of-day by minutesToTime.
function defaultEndFor(start: string): string {
  return minutesToTime(timeToMinutes(start) + 90);
}

interface TimeEditModalProps {
  isOpen: boolean;
  activity: EditorialActivity | null;
  onClose: () => void;
  onSave: (startTime: string, endTime: string, cascade: boolean) => void;
}

export function TimeEditModal({ isOpen, activity, onClose, onSave }: TimeEditModalProps) {
  const initialStart = activity?.startTime || activity?.time || '12:00';
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(activity?.endTime || defaultEndFor(initialStart));
  const [cascade, setCascade] = useState(true);

  useEffect(() => {
    if (activity) {
      const s = activity.startTime || activity.time || '12:00';
      setStartTime(s);
      setEndTime(activity.endTime || defaultEndFor(s));
      setCascade(true);
    }
  }, [activity]);

  // Calculate the time delta for preview
  const originalStart = activity?.startTime || activity?.time || '12:00';
  const deltaMinutes = timeToMinutes(startTime) - timeToMinutes(originalStart);
  const deltaLabel = deltaMinutes === 0 ? '' : deltaMinutes > 0 ? `+${deltaMinutes} min` : `${deltaMinutes} min`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md pointer-events-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Edit Time
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">{activity?.title}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-time-input" className="text-sm font-medium mb-2 block">Start Time</label>
              <input
                id="start-time-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-events-auto touch-manipulation"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <label htmlFor="end-time-input" className="text-sm font-medium mb-2 block">End Time</label>
              <input
                id="end-time-input"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-events-auto touch-manipulation"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {/* Cascade toggle */}
          {deltaMinutes !== 0 && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cascade}
                  onChange={(e) => setCascade(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Shift all following activities ({deltaLabel})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cascade
                      ? 'Everything after this will move by the same amount'
                      : 'Only this activity will change'}
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

          {/* Validation: end time must be after start time */}
          {timeToMinutes(endTime) <= timeToMinutes(startTime) && (
            <p className="text-sm text-destructive font-medium">End time must be after start time</p>
          )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={timeToMinutes(endTime) <= timeToMinutes(startTime)}
            onClick={() => onSave(startTime, endTime, cascade && deltaMinutes !== 0)}
          >
            {cascade && deltaMinutes !== 0 ? 'Shift Schedule' : 'Save Time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
