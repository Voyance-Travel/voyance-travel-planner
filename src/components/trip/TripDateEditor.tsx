import { useState, useMemo } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { Calendar as CalendarIcon, AlertTriangle, Pencil } from 'lucide-react';
import { parseLocalDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface DateChangeResult {
  newStartDate: string;
  newEndDate: string;
  daysAdded: number;      // positive = added, negative = removed
  isShiftOnly: boolean;    // same duration, different window
}

interface TripDateEditorProps {
  startDate: string;
  endDate: string;
  hasItinerary: boolean;
  flightSelection?: Record<string, unknown> | null;
  onDateChange: (result: DateChangeResult) => Promise<void>;
  className?: string;
}

export function TripDateEditor({
  startDate,
  endDate,
  hasItinerary,
  flightSelection,
  onDateChange,
  className,
}: TripDateEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [pendingStart, setPendingStart] = useState<Date | undefined>(undefined);
  const [pendingEnd, setPendingEnd] = useState<Date | undefined>(undefined);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    result: DateChangeResult | null;
    warnings: string[];
    removedDays: number;
  }>({ open: false, result: null, warnings: [], removedDays: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const currentStart = parseLocalDate(startDate);
  const currentEnd = parseLocalDate(endDate);
  const currentDays = differenceInDays(currentEnd, currentStart) + 1;

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setPendingStart(currentStart);
      setPendingEnd(currentEnd);
      setPicking('start');
    }
    setIsOpen(open);
  };

  const handleDayClick = (day: Date) => {
    if (picking === 'start') {
      setPendingStart(day);
      // If new start is after current pending end, clear end
      if (pendingEnd && day > pendingEnd) {
        setPendingEnd(undefined);
      }
      setPicking('end');
    } else {
      if (pendingStart && day < pendingStart) {
        // Clicked before start — restart
        setPendingStart(day);
        setPendingEnd(undefined);
        setPicking('end');
        return;
      }
      setPendingEnd(day);
    }
  };

  const canApply = pendingStart && pendingEnd && pendingEnd >= pendingStart;

  const handleApply = () => {
    if (!pendingStart || !pendingEnd) return;

    const newStartStr = format(pendingStart, 'yyyy-MM-dd');
    const newEndStr = format(pendingEnd, 'yyyy-MM-dd');
    const newDays = differenceInDays(pendingEnd, pendingStart) + 1;
    const daysAdded = newDays - currentDays;
    const isShiftOnly = newDays === currentDays && newStartStr !== startDate;

    const result: DateChangeResult = {
      newStartDate: newStartStr,
      newEndDate: newEndStr,
      daysAdded,
      isShiftOnly,
    };

    // Check for warnings
    const warnings: string[] = [];

    // Flight mismatch warnings
    if (flightSelection) {
      const checkFlightDate = (leg: Record<string, unknown> | undefined, label: string, expectedDate: string) => {
        if (!leg) return;
        const dep = leg.departure as Record<string, unknown> | undefined;
        const flightDate = dep?.date as string | undefined;
        if (flightDate && flightDate !== expectedDate) {
          warnings.push(
            `Your ${label} flight is on ${format(parseLocalDate(flightDate), 'MMM d')} but the trip now ${label === 'outbound' ? 'starts' : 'ends'} ${format(parseLocalDate(expectedDate), 'MMM d')}.`
          );
        }
      };

      const outbound = (flightSelection.outbound || flightSelection.departure) as Record<string, unknown> | undefined;
      const returnFlight = flightSelection.return as Record<string, unknown> | undefined;
      checkFlightDate(outbound, 'outbound', newStartStr);
      checkFlightDate(returnFlight, 'return', newEndStr);
    }

    // If shortening and has itinerary, require confirmation
    if (daysAdded < 0 && hasItinerary) {
      const removedDays = Math.abs(daysAdded);
      const fromDay = currentDays - removedDays + 1;
      warnings.unshift(
        `This will remove Day${removedDays > 1 ? 's' : ''} ${fromDay}${removedDays > 1 ? `–${currentDays}` : ''} from your itinerary.`
      );
      setConfirmDialog({ open: true, result, warnings, removedDays });
      setIsOpen(false);
      return;
    }

    // If there are flight warnings, still confirm
    if (warnings.length > 0) {
      setConfirmDialog({ open: true, result, warnings, removedDays: 0 });
      setIsOpen(false);
      return;
    }

    // No confirmation needed — apply directly
    applyChange(result);
  };

  const applyChange = async (result: DateChangeResult) => {
    setIsSaving(true);
    try {
      await onDateChange(result);
    } finally {
      setIsSaving(false);
      setIsOpen(false);
      setConfirmDialog({ open: false, result: null, warnings: [], removedDays: 0 });
    }
  };

  // Calendar modifiers for range display
  const modifiers = useMemo(() => {
    if (!pendingStart) return {};
    return {
      range_start: pendingStart,
      range_end: pendingEnd || undefined,
      range_middle: pendingStart && pendingEnd
        ? { from: addDays(pendingStart, 1), to: addDays(pendingEnd, -1) }
        : undefined,
    };
  }, [pendingStart, pendingEnd]);

  const modifiersStyles = {
    range_start: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
      borderRadius: '50%',
    },
    range_end: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
      borderRadius: '50%',
    },
    range_middle: {
      backgroundColor: 'hsl(var(--accent))',
      color: 'hsl(var(--accent-foreground))',
      borderRadius: '0',
    },
  };

  const newDayCount = pendingStart && pendingEnd
    ? differenceInDays(pendingEnd, pendingStart) + 1
    : currentDays;
  const dayDelta = newDayCount - currentDays;

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
              className
            )}
          >
            <CalendarIcon className="w-4 h-4" />
            {format(currentStart, 'MMM d')} - {format(currentEnd, 'MMM d, yyyy')}
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium">
              {picking === 'start' ? 'Select new start date' : 'Select end date'}
            </p>
            {pendingStart && pendingEnd && (
              <p className="text-xs text-muted-foreground mt-1">
                {newDayCount} day{newDayCount !== 1 ? 's' : ''}
                {dayDelta !== 0 && hasItinerary && (
                  <span className={dayDelta > 0 ? 'text-green-600' : 'text-destructive'}>
                    {' '}({dayDelta > 0 ? '+' : ''}{dayDelta} day{Math.abs(dayDelta) !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
            )}
          </div>
          <Calendar
            mode="single"
            selected={picking === 'start' ? pendingStart : pendingEnd}
            onSelect={(day) => day && handleDayClick(day)}
            numberOfMonths={2}
            modifiers={modifiers as any}
            modifiersStyles={modifiersStyles}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
          <div className="flex items-center justify-between p-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canApply || isSaving}
              onClick={handleApply}
            >
              {isSaving ? 'Saving...' : 'Apply'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ open: false, result: null, warnings: [], removedDays: 0 });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm date change
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {confirmDialog.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
                <p className="font-medium mt-2">Continue?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog.result && applyChange(confirmDialog.result)}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
