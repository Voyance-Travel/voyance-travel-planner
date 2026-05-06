/**
 * TripHealthPanel — Trip Completion + Trip Health + Quick-fix suggestions
 *
 * Replaces the old confusing rating system with:
 * 1. Clear "X of Y days planned" completion indicator with progress bar
 * 2. Checklist of done vs missing items (flights, hotels, days, transfers)
 * 3. Trip Health score based on conflicts, gaps, closed venues, budget balance
 * 4. Quick-fix suggestions for low scores
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, ChevronDown, AlertTriangle,
  Plane, Hotel, CalendarDays, Bus, Clock,
  Sparkles, ArrowRight, Shield, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  icon: React.ElementType;
  fixLabel?: string;
  fixAction?: string; // action key for parent to handle
}

interface HealthIssue {
  id: string;
  severity: 'warning' | 'error';
  message: string;
  fixLabel?: string;
  fixAction?: string;
  dayNumber?: number;
}

export interface TripHealthPanelProps {
  days: any[];
  totalDaysExpected: number;
  hasFlights: boolean;
  hasHotel: boolean;
  hasAirportTransfer?: boolean;
  hasInterCityTransport?: boolean;
  isMultiCity?: boolean;
  className?: string;
  onAction?: (action: string, context?: { dayNumber?: number }) => void;
}

// ─── Health Analysis ────────────────────────────────────────────────────────

function analyzeHealth(days: any[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  days.forEach((day: any) => {
    const activities = day.activities || [];
    const dayNum = day.dayNumber || day.day_number;

    // Empty day
    const realActivities = activities.filter((a: any) => {
      const cat = (a.category || a.type || '').toLowerCase();
      return !['check-in', 'check-out', 'hotel', 'accommodation'].includes(cat);
    });

    if (realActivities.length === 0) {
      issues.push({
        id: `empty-day-${dayNum}`,
        severity: 'error',
        message: `Day ${dayNum} has no activities`,
        fixLabel: 'Generate Day',
        fixAction: 'generate_day',
        dayNumber: dayNum,
      });
      return;
    }

    // Timing conflicts — overlapping activities
    const timed = activities
      .filter((a: any) => a.startTime && a.endTime)
      .map((a: any) => ({
        name: a.name || a.title,
        start: parseTime(a.startTime),
        end: parseTime(a.endTime),
      }))
      .filter((a: { start: number; end: number }) => a.start > 0 || a.end > 0)
      .sort((a: { start: number }, b: { start: number }) => a.start - b.start);

    for (let i = 0; i < timed.length - 1; i++) {
      if (timed[i].end > timed[i + 1].start) {
        issues.push({
          id: `conflict-day-${dayNum}-${i}`,
          severity: 'error',
          message: `Day ${dayNum}: "${timed[i].name}" overlaps with "${timed[i + 1].name}"`,
          fixLabel: 'Fix timing',
          fixAction: 'fix_timing',
          dayNumber: dayNum,
        });
        break; // Only report first conflict per day
      }
    }

    // Missing buffer — activities < 5 min apart (excluding transit)
    for (let i = 0; i < timed.length - 1; i++) {
      const gap = timed[i + 1].start - timed[i].end;
      if (gap > 0 && gap < 5) {
        const catA = (activities[i]?.category || '').toLowerCase();
        const catB = (activities[i + 1]?.category || '').toLowerCase();
        const isTransit = ['transit', 'transportation', 'transfer', 'walking'].includes(catA) ||
                          ['transit', 'transportation', 'transfer', 'walking'].includes(catB);
        if (!isTransit) {
          issues.push({
            id: `buffer-day-${dayNum}-${i}`,
            severity: 'warning',
            message: `Day ${dayNum}: Only ${gap}min between "${timed[i].name}" and "${timed[i + 1].name}"`,
            fixLabel: 'Fix timing',
            fixAction: 'fix_timing',
            dayNumber: dayNum,
          });
          break;
        }
      }
    }

    // Budget balance — check if day spend is very high vs others
    // (simple check: flag if >3x average)
  });

  // Budget balance across days
  const dayCosts = days.map((day: any) => {
    const activities = day.activities || [];
    return activities.reduce((sum: number, a: any) => {
      const cost = a.estimatedCost?.amount || a.cost || a.price || 0;
      return sum + (typeof cost === 'number' ? cost : 0);
    }, 0);
  }).filter((c: number) => c > 0);

  if (dayCosts.length > 2) {
    const avg = dayCosts.reduce((a: number, b: number) => a + b, 0) / dayCosts.length;
    dayCosts.forEach((cost: number, i: number) => {
      if (avg > 0 && cost > avg * 3) {
        issues.push({
          id: `budget-heavy-${i}`,
          severity: 'warning',
          message: `Day ${days[i].dayNumber || i + 1} spending is 3× the average. Consider redistributing`,
        });
      }
    });
  }

  return issues;
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().toUpperCase();
  const match12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3];
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const match24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  return 0;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TripHealthPanel({
  days,
  totalDaysExpected,
  hasFlights,
  hasHotel,
  hasAirportTransfer = false,
  hasInterCityTransport = false,
  isMultiCity = false,
  className,
  onAction,
}: TripHealthPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { checklist, healthIssues, completionPct, healthScore, daysPlanned } = useMemo(() => {
    // Count days with real activities
    const planned = days.filter((d: any) => {
      const acts = d.activities || [];
      return acts.some((a: any) => {
        const cat = (a.category || a.type || '').toLowerCase();
        return !['check-in', 'check-out', 'hotel', 'accommodation'].includes(cat);
      });
    }).length;

    // Build checklist
    const items: ChecklistItem[] = [
      { id: 'flights', label: 'Flights booked', done: hasFlights, icon: Plane, fixLabel: 'Add flights', fixAction: 'add_flights' },
      { id: 'hotel', label: 'Hotels confirmed', done: hasHotel, icon: Hotel, fixLabel: 'Add hotel', fixAction: 'add_hotel' },
    ];

    // Days checklist entries
    if (planned === totalDaysExpected) {
      items.push({ id: 'days-all', label: `All ${totalDaysExpected} days planned`, done: true, icon: CalendarDays });
    } else if (planned > 0) {
      items.push({ id: 'days-partial', label: `Days 1-${planned} planned`, done: true, icon: CalendarDays });
      const missingStart = planned + 1;
      const missingEnd = totalDaysExpected;
      items.push({
        id: 'days-missing',
        label: `Days ${missingStart}${missingEnd > missingStart ? `-${missingEnd}` : ''} need activities`,
        done: false,
        icon: CalendarDays,
        fixLabel: 'Generate',
        fixAction: 'generate_missing_days',
      });
    } else {
      items.push({
        id: 'days-none',
        label: `${totalDaysExpected} days need activities`,
        done: false,
        icon: CalendarDays,
        fixLabel: 'Generate itinerary',
        fixAction: 'generate_all',
      });
    }

    if (isMultiCity) {
      items.push({
        id: 'intercity',
        label: 'Inter-city transport booked',
        done: hasInterCityTransport,
        icon: Bus,
        fixLabel: 'Add transport',
        fixAction: 'add_intercity',
      });
    }

    // Health analysis
    const issues = analyzeHealth(days);

    // Compute completion %
    const completionFactors = [
      planned / Math.max(totalDaysExpected, 1),
      hasFlights ? 1 : 0,
      hasHotel ? 1 : 0,
    ];
    if (isMultiCity) completionFactors.push(hasInterCityTransport ? 1 : 0);
    const completion = Math.round(
      (completionFactors.reduce((a, b) => a + b, 0) / completionFactors.length) * 100
    );

    // Health score: start at 100, deduct for issues
    let health = 100;
    issues.forEach(issue => {
      // Timing issues are one-click fixable; weight them lighter so the score
      // doesn't look alarming for a problem the user can resolve instantly.
      const isTiming = issue.fixAction === 'fix_timing';
      if (issue.severity === 'error') health -= isTiming ? 8 : 15;
      else health -= isTiming ? 3 : 5;
    });
    health = Math.max(0, Math.min(100, health));

    return {
      checklist: items,
      healthIssues: issues,
      completionPct: completion,
      healthScore: health,
      daysPlanned: planned,
    };
  }, [days, totalDaysExpected, hasFlights, hasHotel, hasAirportTransfer, hasInterCityTransport, isMultiCity]);

  const healthColor = healthScore >= 80 ? 'text-green-600' : healthScore >= 50 ? 'text-amber-500' : 'text-destructive';
  const healthBg = healthScore >= 80 ? 'bg-green-600' : healthScore >= 50 ? 'bg-amber-500' : 'bg-destructive';
  const completionColor = completionPct >= 80 ? 'bg-primary' : completionPct >= 40 ? 'bg-amber-500' : 'bg-muted-foreground';

  const doneCount = checklist.filter(c => c.done).length;
  const totalChecklist = checklist.length;

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)} data-tour="health-score">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            {/* Completion ring */}
            <div className="relative w-10 h-10 shrink-0">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  className="stroke-muted"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="3"
                  strokeDasharray={`${completionPct}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                {completionPct}%
              </span>
            </div>

            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-foreground">
                {daysPlanned} of {totalDaysExpected} days planned
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {doneCount}/{totalChecklist} items ready
                </span>
                {healthIssues.length > 0 && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', healthColor, 'border-current')}>
                    {healthIssues.length} {healthIssues.length === 1 ? 'issue' : 'issues'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Health pill */}
          <div className={cn(
            'hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium',
            healthScore >= 80 ? 'bg-green-500/10 text-green-600' :
            healthScore >= 50 ? 'bg-amber-500/10 text-amber-600' :
            'bg-destructive/10 text-destructive'
          )}>
            <Shield className="w-3 h-3" />
            Health: {healthScore}
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-180',
          )} />
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

              {/* ── Completion Progress ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Trip Completion</span>
                  <span className="text-muted-foreground">{completionPct}%</span>
                </div>
                <Progress value={completionPct} className="h-2" />
              </div>

              {/* ── Checklist ── */}
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between group">
                    <button
                      type="button"
                      className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.fixAction && onAction) {
                          onAction(item.fixAction, {});
                        }
                      }}
                    >
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <item.icon className={cn('w-3.5 h-3.5 shrink-0', item.done ? 'text-foreground' : 'text-muted-foreground')} />
                      <span className={cn(
                        'text-xs truncate',
                        item.done ? 'text-foreground' : 'text-muted-foreground',
                      )}>
                        {item.label}
                      </span>
                    </button>
                    {!item.done && item.fixLabel && onAction && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-primary"
                        onClick={(e) => { e.stopPropagation(); onAction(item.fixAction!, {}); }}
                      >
                        {item.fixLabel}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Trip Health ── */}
              {healthIssues.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className={cn('w-4 h-4', healthColor)} />
                    <span className="text-xs font-medium text-foreground">Trip Health</span>
                    <div className={cn('h-1.5 flex-1 rounded-full bg-muted overflow-hidden')}>
                      <div className={cn('h-full rounded-full transition-all', healthBg)} style={{ width: `${healthScore}%` }} />
                    </div>
                    <span className={cn('text-xs font-semibold', healthColor)}>{healthScore}/100</span>
                  </div>

                  <div className="space-y-1.5 pl-6">
                    {healthIssues.map((issue) => (
                      <div key={issue.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          {issue.severity === 'error' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                          )}
                          <span className="text-xs text-muted-foreground leading-relaxed">{issue.message}</span>
                        </div>
                        {issue.fixLabel && onAction && (
                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                            <Button
                              variant={issue.severity === 'error' ? 'default' : 'outline'}
                              size="sm"
                              className="h-8 px-3 text-xs"
                              aria-label={`${issue.fixLabel}${issue.dayNumber ? ` on day ${issue.dayNumber}` : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction(issue.fixAction!, { dayNumber: issue.dayNumber });
                              }}
                            >
                              <Zap className="w-3 h-3 mr-1" aria-hidden="true" />
                              {issue.fixLabel}
                            </Button>
                            {issue.fixAction === 'fix_timing' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                                aria-label={`Review day ${issue.dayNumber} in detail`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAction('refresh_day', { dayNumber: issue.dayNumber });
                                }}
                              >
                                Review
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── All clear ── */}
              {healthIssues.length === 0 && completionPct >= 80 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                  <Sparkles className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-green-700 font-medium">
                    Your trip looks great! All days are planned with no conflicts.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TripHealthPanel;
