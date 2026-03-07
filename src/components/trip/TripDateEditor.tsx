import { useState, useMemo } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { Calendar as CalendarIcon, AlertTriangle, Pencil, Plus, Minus, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';

export type InsertPosition = 'before' | 'after' | 'at_index';

export interface DateChangeResult {
  newStartDate: string;
  newEndDate: string;
  daysAdded: number;         // positive = added, negative = removed
  isShiftOnly: boolean;      // same duration, different window
  // Extend options
  insertPosition?: InsertPosition;
  insertAtDayNumber?: number; // for 'at_index'
  targetCityId?: string;      // for multi-city: which city gets new days
  // Shorten options
  removedDayNumbers?: number[]; // specific days to remove (user-selected)
  archiveRemovedDays?: boolean; // always true for safety
}

interface TripDateEditorProps {
  startDate: string;
  endDate: string;
  hasItinerary: boolean;
  flightSelection?: Record<string, unknown> | null;
  onDateChange: (result: DateChangeResult) => Promise<void>;
  /** Current itinerary days for shorten preview */
  days?: Array<{ dayNumber: number; theme?: string; activities?: unknown[] }>;
  /** Cities for multi-city extend */
  cities?: Array<{ id: string; city_name: string; nights?: number }>;
  /** Compact icon-only mode for mobile headers */
  compact?: boolean;
  /** Disable editing (e.g. during generation) */
  disabled?: boolean;
  className?: string;
}

export function TripDateEditor({
  startDate,
  endDate,
  hasItinerary,
  flightSelection,
  onDateChange,
  days: itineraryDays,
  cities,
  compact,
  disabled,
  className,
}: TripDateEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [pendingStart, setPendingStart] = useState<Date | undefined>(undefined);
  const [pendingEnd, setPendingEnd] = useState<Date | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // Extend flow state
  const [extendDialog, setExtendDialog] = useState<{
    open: boolean;
    result: DateChangeResult | null;
    warnings: string[];
  }>({ open: false, result: null, warnings: [] });
  const [insertPosition, setInsertPosition] = useState<InsertPosition>('after');
  const [targetCityId, setTargetCityId] = useState<string | null>(null);

  // Shorten flow state
  const [shortenDialog, setShortenDialog] = useState<{
    open: boolean;
    result: DateChangeResult | null;
    warnings: string[];
    maxRemovable: number;
  }>({ open: false, result: null, warnings: [], maxRemovable: 0 });
  const [shortenMode, setShortenMode] = useState<'end' | 'choose'>('end');
  const [selectedRemoveDays, setSelectedRemoveDays] = useState<Set<number>>(new Set());

  // Shift flow state
  const [shiftDialog, setShiftDialog] = useState<{
    open: boolean;
    result: DateChangeResult | null;
    warnings: string[];
    dayOfWeekChanges: Array<{ dayNumber: number; oldDay: string; newDay: string }>;
  }>({ open: false, result: null, warnings: [], dayOfWeekChanges: [] });

  // Generic confirm (flight warnings etc.)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    result: DateChangeResult | null;
    warnings: string[];
    removedDays: number;
  }>({ open: false, result: null, warnings: [], removedDays: 0 });

  const currentStart = parseLocalDate(startDate);
  const currentEnd = parseLocalDate(endDate);
  const currentDays = differenceInDays(currentEnd, currentStart);

  const isMultiCity = cities && cities.length > 1;

  const handleOpenChange = (open: boolean) => {
    if (disabled) return;
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
      if (pendingEnd && day > pendingEnd) {
        setPendingEnd(undefined);
      }
      setPicking('end');
    } else {
      if (pendingStart && day < pendingStart) {
        setPendingStart(day);
        setPendingEnd(undefined);
        setPicking('end');
        return;
      }
      setPendingEnd(day);
    }
  };

  const canApply = pendingStart && pendingEnd && pendingEnd >= pendingStart;

  // Build flight warnings
  const getFlightWarnings = (newStartStr: string, newEndStr: string): string[] => {
    const warnings: string[] = [];
    if (!flightSelection) return warnings;

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
    return warnings;
  };

  // Detect day-of-week changes for shift
  const getDayOfWeekChanges = (newStartStr: string) => {
    if (!itineraryDays || itineraryDays.length === 0) return [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const newStart = parseLocalDate(newStartStr);
    const changes: Array<{ dayNumber: number; oldDay: string; newDay: string }> = [];

    for (let i = 0; i < itineraryDays.length; i++) {
      const oldDate = addDays(currentStart, i);
      const newDate = addDays(newStart, i);
      const oldDow = dayNames[oldDate.getDay()];
      const newDow = dayNames[newDate.getDay()];
      if (oldDow !== newDow) {
        changes.push({
          dayNumber: itineraryDays[i].dayNumber || i + 1,
          oldDay: oldDow,
          newDay: newDow,
        });
      }
    }
    return changes;
  };

  const handleApply = () => {
    if (!pendingStart || !pendingEnd) return;

    const newStartStr = format(pendingStart, 'yyyy-MM-dd');
    const newEndStr = format(pendingEnd, 'yyyy-MM-dd');
    const newDays = differenceInDays(pendingEnd, pendingStart);
    const daysAdded = newDays - currentDays;
    const isShiftOnly = newDays === currentDays && newStartStr !== startDate;

    const result: DateChangeResult = {
      newStartDate: newStartStr,
      newEndDate: newEndStr,
      daysAdded,
      isShiftOnly,
      archiveRemovedDays: true,
    };

    setIsOpen(false);

    // EXTEND — ask where to insert
    if (daysAdded > 0 && hasItinerary) {
      const warnings = getFlightWarnings(newStartStr, newEndStr);
      setInsertPosition('after');
      setTargetCityId(cities?.[cities.length - 1]?.id || null);
      setExtendDialog({ open: true, result, warnings });
      return;
    }

    // SHORTEN — ask which days to remove
    if (daysAdded < 0 && hasItinerary) {
      const removable = Math.abs(daysAdded);
      const warnings = getFlightWarnings(newStartStr, newEndStr);
      warnings.unshift(
        `This will remove ${removable} day${removable > 1 ? 's' : ''} from your itinerary.`
      );
      setShortenMode('end');
      setSelectedRemoveDays(new Set());
      setShortenDialog({ open: true, result, warnings, maxRemovable: removable });
      return;
    }

    // SHIFT — check day-of-week changes
    if (isShiftOnly && hasItinerary) {
      const dowChanges = getDayOfWeekChanges(newStartStr);
      const warnings = getFlightWarnings(newStartStr, newEndStr);
      if (dowChanges.length > 0) {
        warnings.push(`${dowChanges.length} day${dowChanges.length > 1 ? 's' : ''} will fall on different days of the week, which may affect operating hours.`);
      }
      if (warnings.length > 0 || dowChanges.length > 0) {
        setShiftDialog({ open: true, result, warnings, dayOfWeekChanges: dowChanges });
        return;
      }
    }

    // Simple case — no itinerary or no conflicts
    const warnings = getFlightWarnings(newStartStr, newEndStr);
    if (warnings.length > 0) {
      setConfirmDialog({ open: true, result, warnings, removedDays: 0 });
      return;
    }

    applyChange(result);
  };

  const applyChange = async (result: DateChangeResult) => {
    setIsSaving(true);
    try {
      await onDateChange(result);
    } finally {
      setIsSaving(false);
      setIsOpen(false);
      setExtendDialog({ open: false, result: null, warnings: [] });
      setShortenDialog({ open: false, result: null, warnings: [], maxRemovable: 0 });
      setShiftDialog({ open: false, result: null, warnings: [], dayOfWeekChanges: [] });
      setConfirmDialog({ open: false, result: null, warnings: [], removedDays: 0 });
    }
  };

  // Calendar modifiers
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
    range_start: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderRadius: '50%' },
    range_end: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderRadius: '50%' },
    range_middle: { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))', borderRadius: '0' },
  };

  const newDayCount = pendingStart && pendingEnd
    ? differenceInDays(pendingEnd, pendingStart)
    : currentDays;
  const dayDelta = newDayCount - currentDays;

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {compact ? (
            <button
              disabled={disabled}
              className={cn(
                'inline-flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer',
                disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
                className
              )}
              aria-label="Edit dates"
            >
              <Pencil className="w-3 h-3" />
            </button>
          ) : (
            <button
              disabled={disabled}
              className={cn(
                'inline-flex items-center gap-2 text-sm font-medium text-foreground bg-secondary/50 hover:bg-secondary border border-border/50 rounded-full px-3 py-1.5 transition-colors cursor-pointer',
                disabled && 'opacity-40 cursor-not-allowed hover:bg-secondary/50',
                className
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{format(currentStart, 'MMM d')} – {format(currentEnd, 'MMM d, yyyy')}</span>
              <Pencil className="w-3 h-3 text-muted-foreground/60" />
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium">
              {picking === 'start' ? 'Select new start date' : 'Select end date'}
            </p>
            {pendingStart && pendingEnd && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">
                  {newDayCount} day{newDayCount !== 1 ? 's' : ''}
                  {dayDelta !== 0 && hasItinerary && (
                    <span className={dayDelta > 0 ? 'text-primary' : 'text-destructive'}>
                      {' '}({dayDelta > 0 ? '+' : ''}{dayDelta} day{Math.abs(dayDelta) !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
                {dayDelta !== 0 && hasItinerary && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {dayDelta > 0 ? <Plus className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                    {dayDelta > 0 ? 'Extend' : 'Shorten'}
                  </span>
                )}
                {dayDelta === 0 && pendingStart && format(pendingStart, 'yyyy-MM-dd') !== startDate && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    <ArrowRightLeft className="h-2.5 w-2.5" />
                    Shift
                  </span>
                )}
              </div>
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
            <Button size="sm" disabled={!canApply || isSaving} onClick={handleApply}>
              {isSaving ? 'Saving...' : 'Apply'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* ═══ EXTEND DIALOG ═══ */}
      <AlertDialog
        open={extendDialog.open}
        onOpenChange={(open) => { if (!open) setExtendDialog(prev => ({ ...prev, open: false })); }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add {extendDialog.result?.daysAdded} Day{(extendDialog.result?.daysAdded || 0) > 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Where should the new days go?</p>

                {/* Insert position options */}
                <div className="grid gap-2">
                  {[
                    { value: 'before' as InsertPosition, label: 'Before Day 1', desc: 'Add days at the start' },
                    { value: 'after' as InsertPosition, label: `After Day ${currentDays}`, desc: 'Add days at the end' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setInsertPosition(opt.value)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-colors',
                        insertPosition === opt.value
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-secondary/30 border-border hover:bg-secondary/50'
                      )}
                    >
                      <div className={cn(
                        'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        insertPosition === opt.value ? 'border-primary' : 'border-muted-foreground/40'
                      )}>
                        {insertPosition === opt.value && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Multi-city: which city gets the days */}
                {isMultiCity && cities && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Which city gets the extra days?</p>
                    <div className="grid gap-1.5">
                      {cities.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => setTargetCityId(city.id)}
                          className={cn(
                            'flex items-center justify-between p-2.5 rounded-md border text-sm transition-colors',
                            targetCityId === city.id
                              ? 'bg-primary/10 border-primary/30'
                              : 'bg-secondary/20 border-border/50 hover:bg-secondary/40'
                          )}
                        >
                          <span className="font-medium text-foreground">{city.city_name}</span>
                          <span className="text-xs text-muted-foreground">{city.nights || 1} night{(city.nights || 1) !== 1 ? 's' : ''}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flight warnings */}
                {extendDialog.warnings.length > 0 && (
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                    {extendDialog.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={() => {
                if (!extendDialog.result) return;
                applyChange({
                  ...extendDialog.result,
                  insertPosition,
                  targetCityId: targetCityId || undefined,
                });
              }}
            >
              {isSaving ? 'Adding...' : `Add ${extendDialog.result?.daysAdded} Day${(extendDialog.result?.daysAdded || 0) > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ SHORTEN DIALOG ═══ */}
      <AlertDialog
        open={shortenDialog.open}
        onOpenChange={(open) => { if (!open) setShortenDialog(prev => ({ ...prev, open: false })); }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-destructive" />
              Remove {shortenDialog.maxRemovable} Day{shortenDialog.maxRemovable > 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {/* Mode selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setShortenMode('end'); setSelectedRemoveDays(new Set()); }}
                    className={cn(
                      'p-2.5 rounded-lg border text-sm text-center transition-colors',
                      shortenMode === 'end'
                        ? 'bg-primary/10 border-primary/30 font-medium text-foreground'
                        : 'bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50'
                    )}
                  >
                    Remove from end
                  </button>
                  <button
                    onClick={() => setShortenMode('choose')}
                    className={cn(
                      'p-2.5 rounded-lg border text-sm text-center transition-colors',
                      shortenMode === 'choose'
                        ? 'bg-primary/10 border-primary/30 font-medium text-foreground'
                        : 'bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50'
                    )}
                  >
                    Choose specific days
                  </button>
                </div>

                {/* Day previews for choosing */}
                {shortenMode === 'choose' && itineraryDays && (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    <p className="text-xs text-muted-foreground">
                      Select {shortenDialog.maxRemovable} day{shortenDialog.maxRemovable > 1 ? 's' : ''} to remove:
                    </p>
                    {itineraryDays.map((day) => {
                      const isSelected = selectedRemoveDays.has(day.dayNumber);
                      const activityCount = Array.isArray(day.activities) ? day.activities.length : 0;
                      return (
                        <button
                          key={day.dayNumber}
                          onClick={() => {
                            setSelectedRemoveDays(prev => {
                              const next = new Set(prev);
                              if (next.has(day.dayNumber)) {
                                next.delete(day.dayNumber);
                              } else if (next.size < shortenDialog.maxRemovable) {
                                next.add(day.dayNumber);
                              }
                              return next;
                            });
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 p-2.5 rounded-md border text-sm text-left transition-colors',
                            isSelected
                              ? 'bg-destructive/10 border-destructive/30'
                              : 'bg-secondary/20 border-border/50 hover:bg-secondary/40'
                          )}
                        >
                          <div className={cn(
                            'h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center',
                            isSelected ? 'bg-destructive border-destructive' : 'border-muted-foreground/40'
                          )}>
                            {isSelected && <Minus className="h-2.5 w-2.5 text-destructive-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground">Day {day.dayNumber}</span>
                            {day.theme && <span className="text-muted-foreground"> · {day.theme}</span>}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {activityCount} activit{activityCount !== 1 ? 'ies' : 'y'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {shortenMode === 'end' && (
                  <p className="text-sm text-muted-foreground">
                    Day{shortenDialog.maxRemovable > 1 ? 's' : ''}{' '}
                    {currentDays - shortenDialog.maxRemovable + 1}{shortenDialog.maxRemovable > 1 ? `–${currentDays}` : ''}{' '}
                    will be removed from the end. They'll be archived in case you need them later.
                  </p>
                )}

                {/* Flight warnings */}
                {shortenDialog.warnings.filter(w => w.includes('flight')).length > 0 && (
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                    {shortenDialog.warnings.filter(w => w.includes('flight')).map((w, i) => (
                      <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving || (shortenMode === 'choose' && selectedRemoveDays.size !== shortenDialog.maxRemovable)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!shortenDialog.result) return;
                const removedDayNumbers = shortenMode === 'choose'
                  ? Array.from(selectedRemoveDays).sort((a, b) => a - b)
                  : undefined; // undefined = remove from end (default)
                applyChange({
                  ...shortenDialog.result,
                  removedDayNumbers,
                  archiveRemovedDays: true,
                });
              }}
            >
              {isSaving ? 'Removing...' : `Remove ${shortenDialog.maxRemovable} Day${shortenDialog.maxRemovable > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ SHIFT DIALOG ═══ */}
      <AlertDialog
        open={shiftDialog.open}
        onOpenChange={(open) => { if (!open) setShiftDialog(prev => ({ ...prev, open: false })); }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Shift Trip Dates
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Moving trip from{' '}
                  <span className="font-medium text-foreground">{format(currentStart, 'MMM d')}</span>
                  {' '}to{' '}
                  <span className="font-medium text-foreground">{shiftDialog.result ? format(parseLocalDate(shiftDialog.result.newStartDate), 'MMM d') : ''}</span>.
                  All activities stay the same.
                </p>

                {/* Day-of-week changes */}
                {shiftDialog.dayOfWeekChanges.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Day-of-Week Changes</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {shiftDialog.dayOfWeekChanges.slice(0, 5).map((c) => (
                        <div key={c.dayNumber} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-border/40 text-xs">
                          <span className="font-medium text-foreground">Day {c.dayNumber}</span>
                          <span className="text-destructive/70 line-through">{c.oldDay}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-primary font-medium">{c.newDay}</span>
                        </div>
                      ))}
                      {shiftDialog.dayOfWeekChanges.length > 5 && (
                        <p className="text-xs text-muted-foreground pl-2">
                          +{shiftDialog.dayOfWeekChanges.length - 5} more changes
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Venues with day-specific hours (e.g., weekend markets) may be affected.
                      Use "Refresh Day" after shifting to check for issues.
                    </p>
                  </div>
                )}

                {/* Flight warnings */}
                {shiftDialog.warnings.length > 0 && (
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                    {shiftDialog.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={() => shiftDialog.result && applyChange(shiftDialog.result)}
            >
              {isSaving ? 'Shifting...' : 'Shift Dates'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ GENERIC CONFIRM (flight-only warnings, no itinerary case) ═══ */}
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
