/**
 * ImportActivitiesModal — Multi-day, city-aware import
 * 
 * Flow: Paste text → Detect days/cities → Assign to trip days → Review → Import
 */

import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardPaste, Check, RefreshCw, Merge, ArrowRight, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeTimeTo24h, formatTime12h } from '@/utils/timeFormat';

// =============================================================================
// TYPES
// =============================================================================

interface ParsedActivity {
  title: string;
  startTime?: string;
  endTime?: string;
  category: string;
  description?: string;
  location?: { name?: string; address?: string };
  cost?: { amount: number; currency: string };
  included: boolean;
  isEstimatedTime?: boolean;
}

interface ParsedGroup {
  /** Label detected from text (e.g. "Day 1", "Rome", or "Ungrouped") */
  detectedLabel: string;
  /** Target day index in the trip, user-assignable */
  targetDayIndex: number;
  /** Import mode for this group's target day */
  mode: ImportMode;
  activities: ParsedActivity[];
}

export type ImportMode = 'replace' | 'merge';

interface TripDayInfo {
  dayNumber: number;
  city?: string;
  activities: { title: string; startTime?: string }[];
}

interface ImportActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (imports: Array<{
    dayIndex: number;
    activities: Array<{
      title: string;
      startTime?: string;
      endTime?: string;
      category?: string;
      description?: string;
      location?: { name?: string; address?: string };
      cost?: { amount: number; currency: string };
    }>;
    mode: ImportMode;
  }>) => void;
  currency?: string;
  days: TripDayInfo[];
  /** Which day the user clicked "Import" from */
  initialDayIndex?: number;
}

// =============================================================================
// PARSING UTILITIES
// =============================================================================

// Requires either :MM portion, or am/pm, or both — bare digits alone won't match
const TIME_PATTERN = /(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))/gi;
const TIME_RANGE_PATTERN = /(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\s*[-–—to]+\s*(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))/i;
const COST_PATTERN = /[~≈]?[$€£¥]\s*(\d+(?:\.\d{2})?)/;

/** Detect "Day 1", "Day 2", "## Day 3", etc. */
const DAY_BOUNDARY = /^[#*\s]*(?:\*\*)?day\s*(\d+)/i;

const CATEGORY_HINTS: Record<string, string[]> = {
  dining: ['restaurant', 'café', 'cafe', 'bar', 'lunch', 'dinner', 'breakfast', 'brunch', 'eat', 'food', 'bistro', 'grill', 'seafood', 'sushi', 'pizza', 'taco'],
  sightseeing: ['visit', 'see', 'view', 'tower', 'monument', 'landmark', 'museum', 'gallery', 'church', 'cathedral', 'palace', 'castle', 'ruins'],
  cultural: ['museum', 'gallery', 'art', 'theater', 'theatre', 'show', 'performance', 'concert', 'festival', 'temple', 'shrine'],
  activity: ['hike', 'swim', 'surf', 'dive', 'snorkel', 'kayak', 'bike', 'tour', 'class', 'workshop', 'adventure', 'zip', 'climb'],
  relaxation: ['spa', 'beach', 'pool', 'relax', 'massage', 'yoga', 'meditation', 'hammock', 'sunset'],
  shopping: ['shop', 'market', 'mall', 'store', 'boutique', 'souvenir'],
  nightlife: ['club', 'nightclub', 'pub', 'cocktail', 'drinks', 'lounge', 'rooftop'],
};

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_HINTS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'activity';
}

/** Use shared normalizeTimeTo24h — single source of truth */
const normalizeTime = normalizeTimeTo24h;

const SKIP_LINE_PATTERNS: RegExp[] = [
  /^[-=*_]{3,}$/,
  /^#{1,4}\s*$/,
  /^(?:\*\*)?why\s+this\s+works/i,
  /^(?:\*\*)?(?:pro\s+)?tips?(?:\s*:|\s+for)/i,
  /^(?:\*\*)?💡/,
  /^(?:\*\*)?optimization/i,
  /^if\s+you\s+(?:want|need|like)/i,
  /^let\s+me\s+know/i,
  /^(?:tailor|rework|adjust|customize|align)\s/i,
  /^option\s+[a-c]\s*:/i,
  /^(?:\*\*\s*\*\*|\*\*\*|---+|___+)$/,
  /^[-•]\s*(?:tailor|rework|align|customize)/i,
];

const SECTION_TIME_MAP: Record<string, string> = {
  'morning': '09:00', 'late morning': '10:30', 'midday': '12:00',
  'lunch': '12:30', 'afternoon': '14:00', 'late afternoon': '16:00',
  'evening': '18:00', 'night': '20:00', 'departure': '08:00',
};

function detectSectionTime(line: string): string | null {
  const cleaned = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim().toLowerCase();
  return SECTION_TIME_MAP[cleaned] || null;
}

function isSkipLine(line: string): boolean {
  const stripped = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
  if (stripped.length <= 2) return true;
  if (/^[\p{Emoji}\s]+$/u.test(stripped)) return true;
  for (const pattern of SKIP_LINE_PATTERNS) {
    if (pattern.test(stripped)) return true;
  }
  return false;
}

function isDescriptionLine(line: string): boolean {
  const stripped = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
  if (/^[-•]\s/.test(line) && stripped.length < 60) return false;
  if (/^[(\[]/.test(stripped)) return true;
  if (/^[a-z]/.test(stripped) && stripped.length < 80) return true;
  if (/^[-•]\s+[a-z]/.test(line) && !/\b(?:visit|explore|go|head|drive|walk|swim|hike|tour|book|check|arrive|depart|stroll|browse|try)\b/i.test(stripped)) return true;
  return false;
}

/** Strip invisible Unicode chars that break time parsing (ZWSP, soft hyphens, BOM, etc.) */
function sanitizeInvisibleChars(text: string): string {
  return text.replace(/[\u200B\u200C\u200D\u00AD\u2060\uFEFF\u200E\u200F\u2028\u2029\u202A-\u202E]/g, '');
}

function cleanMarkdown(line: string): string {
  return sanitizeInvisibleChars(line)
    .replace(/^#+\s*/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-•*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]{1,4}(?=\w)/u, '')
    .trim();
}

/**
 * Detect city headers like "Rome:", "**Florence**", "### Paris"
 */
function detectCityHeader(line: string, knownCities: string[]): string | null {
  const stripped = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/:$/, '').trim();
  if (!stripped || stripped.length > 40) return null;
  
  for (const city of knownCities) {
    if (stripped.toLowerCase() === city.toLowerCase()) return city;
    if (stripped.toLowerCase().includes(city.toLowerCase()) && stripped.length < city.length + 15) return city;
  }
  return null;
}

/**
 * Parse pasted text into groups (by day/city boundaries)
 */
function parsePastedTextGrouped(text: string, currency: string, knownCities: string[]): ParsedGroup[] {
  const rawLines = text.split('\n');
  const groups: ParsedGroup[] = [];
  let currentGroup: ParsedGroup = {
    detectedLabel: 'Ungrouped',
    targetDayIndex: 0,
    mode: 'merge',
    activities: [],
  };
  let currentSectionTime: string | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].trim();
    if (!raw) continue;

    // Check for day boundary
    const dayMatch = raw.match(DAY_BOUNDARY);
    if (dayMatch) {
      // Save current group if it has activities
      if (currentGroup.activities.length > 0) {
        groups.push(currentGroup);
      }
      const dayNum = parseInt(dayMatch[1]);
      currentGroup = {
        detectedLabel: `Day ${dayNum}`,
        targetDayIndex: dayNum - 1,
        mode: 'merge',
        activities: [],
      };
      currentSectionTime = null;
      continue;
    }

    // Check for city header
    const cityMatch = detectCityHeader(raw, knownCities);
    if (cityMatch) {
      if (currentGroup.activities.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = {
        detectedLabel: cityMatch,
        targetDayIndex: 0,
        mode: 'merge',
        activities: [],
      };
      currentSectionTime = null;
      continue;
    }

    // Check section time
    const sectionTime = detectSectionTime(raw);
    if (sectionTime) {
      currentSectionTime = sectionTime;
      continue;
    }

    if (isSkipLine(raw)) continue;

    let workingLine = cleanMarkdown(raw);
    if (!workingLine || workingLine.length <= 2) continue;

    // Check if description of previous activity
    if (currentGroup.activities.length > 0 && isDescriptionLine(raw)) {
      const prev = currentGroup.activities[currentGroup.activities.length - 1];
      const detail = cleanMarkdown(raw);
      prev.description = prev.description ? `${prev.description}. ${detail}` : detail;
      continue;
    }

    // Extract time
    let startTime: string | undefined;
    let endTime: string | undefined;
    const rangeMatch = workingLine.match(TIME_RANGE_PATTERN);
    if (rangeMatch) {
      startTime = normalizeTime(rangeMatch[1]);
      endTime = normalizeTime(rangeMatch[2]);
      workingLine = workingLine.replace(rangeMatch[0], '').trim();
    } else {
      const times = workingLine.match(TIME_PATTERN);
      if (times && times.length > 0) {
        startTime = normalizeTime(times[0]);
        workingLine = workingLine.replace(times[0], '').trim();
      }
    }

    // Cross-check: if parsed time is single-digit hour but raw text has two-digit hour, fix it
    if (startTime) {
      const sanitizedRaw = sanitizeInvisibleChars(raw);
      const twoDigitMatch = sanitizedRaw.match(/\b(1[0-2]):(\d{2})\s*(am|pm)/i);
      if (twoDigitMatch) {
        const crossCheck = normalizeTime(twoDigitMatch[0]);
        if (crossCheck && crossCheck !== startTime) {
          startTime = crossCheck;
        }
      }
    }

    if (!startTime && currentSectionTime) startTime = currentSectionTime;

    // Extract cost
    let costAmount = 0;
    const costMatch = workingLine.match(COST_PATTERN);
    if (costMatch) {
      costAmount = parseFloat(costMatch[1]);
      workingLine = workingLine.replace(costMatch[0], '').trim();
    }

    workingLine = workingLine.replace(/^[-–—:,]\s*/, '').replace(/[-–—:,]\s*$/, '').trim();
    if (workingLine.length <= 2) continue;

    // Extract title/description
    let title = workingLine;
    let description: string | undefined;
    const parenMatch = workingLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (parenMatch && parenMatch[1].length > 3) {
      title = parenMatch[1].trim();
      description = parenMatch[2].trim();
    } else {
      const separatorMatch = workingLine.match(/^([^-–—]+?)\s*[-–—]\s*(.+)$/);
      if (separatorMatch && separatorMatch[1].length > 3 && separatorMatch[1].length < 80) {
        title = separatorMatch[1].trim();
        description = separatorMatch[2].trim();
      }
    }

    currentGroup.activities.push({
      title,
      startTime,
      endTime,
      category: guessCategory(workingLine),
      description,
      location: { name: title },
      cost: costAmount > 0 ? { amount: costAmount, currency } : undefined,
      included: true,
    });
  }

  // Push last group
  if (currentGroup.activities.length > 0) {
    groups.push(currentGroup);
  }

  // Post-process: assign sequential daytime defaults to untimed activities
  for (const group of groups) {
    let nextDefault = 9 * 60; // 9:00 AM in minutes
    for (const activity of group.activities) {
      if (activity.startTime) {
        // Advance the default clock past this timed activity
        const [h, m] = activity.startTime.split(':').map(Number);
        const mins = h * 60 + m;
        nextDefault = Math.max(nextDefault, mins + 90);
      } else {
        // Assign a reasonable daytime slot, cap at 21:00
        const capped = Math.min(nextDefault, 21 * 60);
        const hh = Math.floor(capped / 60).toString().padStart(2, '0');
        const mm = (capped % 60).toString().padStart(2, '0');
        activity.startTime = `${hh}:${mm}`;
        activity.isEstimatedTime = true;
        nextDefault += 90;
      }
    }
  }

  return groups;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ImportActivitiesModal({
  isOpen, onClose, onImport, currency = 'USD', days, initialDayIndex = 0,
}: ImportActivitiesModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [step, setStep] = useState<'paste' | 'assign' | 'review'>('paste');
  const [groups, setGroups] = useState<ParsedGroup[]>([]);

  const knownCities = useMemo(() => {
    const cities: string[] = [];
    for (const d of days) {
      if (d.city && !cities.includes(d.city)) cities.push(d.city);
    }
    return cities;
  }, [days]);

  // Parse and detect groups
  const handleParse = useCallback(() => {
    const parsed = parsePastedTextGrouped(pastedText, currency, knownCities);
    
    // If only 1 group detected (no day/city boundaries), assign to the initial day
    if (parsed.length <= 1) {
      const singleGroup = parsed[0] || { detectedLabel: 'All Activities', targetDayIndex: initialDayIndex, mode: 'merge' as ImportMode, activities: [] };
      singleGroup.targetDayIndex = initialDayIndex;
      // If that day has existing activities, default to merge
      singleGroup.mode = (days[initialDayIndex]?.activities?.length ?? 0) > 0 ? 'merge' : 'replace';
      setGroups([singleGroup]);
    } else {
      // Auto-match city groups to day indices
      const matched = parsed.map(g => {
        // Try to match by city name
        const cityIdx = days.findIndex(d => (d.city || '').toLowerCase() === (g.detectedLabel || '').toLowerCase());
        if (cityIdx >= 0) {
          g.targetDayIndex = cityIdx;
        }
        // Clamp to valid range
        g.targetDayIndex = Math.min(g.targetDayIndex, days.length - 1);
        g.targetDayIndex = Math.max(g.targetDayIndex, 0);
        // Set mode based on whether target day has activities
        g.mode = (days[g.targetDayIndex]?.activities?.length ?? 0) > 0 ? 'merge' : 'replace';
        return g;
      });
      setGroups(matched);
    }
    setStep('assign');
  }, [pastedText, currency, knownCities, initialDayIndex, days]);

  const updateGroupTarget = useCallback((groupIndex: number, dayIndex: number) => {
    setGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      return {
        ...g,
        targetDayIndex: dayIndex,
        mode: (days[dayIndex]?.activities?.length ?? 0) > 0 ? 'merge' : 'replace',
      };
    }));
  }, [days]);

  const updateGroupMode = useCallback((groupIndex: number, mode: ImportMode) => {
    setGroups(prev => prev.map((g, i) => i === groupIndex ? { ...g, mode } : g));
  }, []);

  const toggleActivity = useCallback((groupIndex: number, activityIndex: number) => {
    setGroups(prev => prev.map((g, gi) => {
      if (gi !== groupIndex) return g;
      return {
        ...g,
        activities: g.activities.map((a, ai) => ai === activityIndex ? { ...a, included: !a.included } : a),
      };
    }));
  }, []);

  const updateActivityTime = useCallback((groupIndex: number, activityIndex: number, newTime: string) => {
    setGroups(prev => prev.map((g, gi) => {
      if (gi !== groupIndex) return g;
      return {
        ...g,
        activities: g.activities.map((a, ai) => ai === activityIndex ? { ...a, startTime: newTime, isEstimatedTime: false } : a),
      };
    }));
  }, []);

  const handleImport = useCallback(() => {
    // Group by target day index, merging groups that target the same day
    const byDay = new Map<number, { activities: ParsedActivity[]; mode: ImportMode }>();
    for (const group of groups) {
      const existing = byDay.get(group.targetDayIndex);
      const included = group.activities.filter(a => a.included);
      if (!included.length) continue;
      if (existing) {
        existing.activities.push(...included);
        // If any group targeting this day wants replace, use replace
        if (group.mode === 'replace') existing.mode = 'replace';
      } else {
        byDay.set(group.targetDayIndex, { activities: [...included], mode: group.mode });
      }
    }

    const imports = Array.from(byDay.entries()).map(([dayIndex, { activities, mode }]) => ({
      dayIndex,
      activities: activities.map(({ included, ...rest }) => rest),
      mode,
    }));

    if (imports.length > 0) {
      onImport(imports);
    }
    handleClose();
  }, [groups, onImport]);

  const handleClose = () => {
    setPastedText('');
    setGroups([]);
    setStep('paste');
    onClose();
  };

  const totalIncluded = groups.reduce((sum, g) => sum + g.activities.filter(a => a.included).length, 0);
  const totalParsed = groups.reduce((sum, g) => sum + g.activities.length, 0);

  // Conflict summary
  const conflictSummary = useMemo(() => {
    const summary: Array<{ dayNumber: number; newCount: number; existingCount: number; mode: ImportMode }> = [];
    const byDay = new Map<number, { count: number; mode: ImportMode }>();
    for (const g of groups) {
      const included = g.activities.filter(a => a.included).length;
      if (!included) continue;
      const existing = byDay.get(g.targetDayIndex);
      if (existing) {
        existing.count += included;
        if (g.mode === 'replace') existing.mode = 'replace';
      } else {
        byDay.set(g.targetDayIndex, { count: included, mode: g.mode });
      }
    }
    for (const [dayIndex, { count, mode }] of byDay.entries()) {
      const day = days[dayIndex];
      if (day) {
        summary.push({
          dayNumber: day.dayNumber,
          newCount: count,
          existingCount: day.activities.length,
          mode,
        });
      }
    }
    return summary;
  }, [groups, days]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            Import Activities
          </DialogTitle>
          <DialogDescription>
            {step === 'paste'
              ? 'Paste an itinerary from ChatGPT, Claude, or any text. Multi-day content is auto-detected.'
              : step === 'assign'
                ? `${totalParsed} activities found in ${groups.length} group${groups.length > 1 ? 's' : ''}. Assign each group to a day.`
                : `Review: ${totalIncluded} activities ready to import`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'paste' ? (
            <div className="space-y-3 py-2">
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`Example:\nDay 1 - Rome\n9:00 AM - Colosseum tour - $25\n12:00 PM - Lunch at Trattoria\n\nDay 2 - Florence\n10:00 AM - Uffizi Gallery - $20\n1:00 PM - Ponte Vecchio walk`}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Day markers (Day 1, Day 2) and city names are auto-detected. Times and costs ($) are extracted automatically.
              </p>
            </div>
          ) : step === 'assign' ? (
            <div className="space-y-4 py-2">
              {groups.map((group, gi) => (
                <div key={gi} className="border rounded-xl p-4 space-y-3">
                  {/* Group header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{group.detectedLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.activities.filter(a => a.included).length} activities
                    </span>
                  </div>

                  {/* Day assignment */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Import to:</span>
                    <Select
                      value={String(group.targetDayIndex)}
                      onValueChange={(v) => updateGroupTarget(gi, parseInt(v))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((d, di) => (
                          <SelectItem key={di} value={String(di)} className="text-xs">
                            Day {d.dayNumber}{d.city ? ` · ${d.city}` : ''}
                            {d.activities.length > 0 ? ` (${d.activities.length} existing)` : ' (empty)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mode choice — only if target day has activities */}
                  {(days[group.targetDayIndex]?.activities?.length ?? 0) > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateGroupMode(gi, 'merge')}
                        className={cn(
                          'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                          group.mode === 'merge'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/30'
                        )}
                      >
                        <Merge className="h-3.5 w-3.5" />
                        Merge
                      </button>
                      <button
                        onClick={() => updateGroupMode(gi, 'replace')}
                        className={cn(
                          'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                          group.mode === 'replace'
                            ? 'border-destructive bg-destructive/10 text-destructive'
                            : 'border-border hover:border-destructive/30'
                        )}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Replace
                      </button>
                    </div>
                  )}

                  {/* Activities preview */}
                  <div className="space-y-1">
                    {group.activities.map((activity, ai) => (
                      <div
                        key={ai}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-xs',
                          activity.included
                            ? 'bg-primary/5'
                            : 'opacity-40 line-through'
                        )}
                      >
                        <div
                          onClick={() => toggleActivity(gi, ai)}
                          className={cn(
                            'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer',
                            activity.included ? 'border-primary bg-primary' : 'border-muted-foreground'
                          )}
                        >
                          {activity.included && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                        <span className="flex-1 truncate cursor-pointer" onClick={() => toggleActivity(gi, ai)}>{activity.title}</span>
                        {activity.startTime && (
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {activity.isEstimatedTime && <Clock className="h-3 w-3 text-muted-foreground" />}
                            <span className={cn(
                              'text-xs font-mono whitespace-nowrap',
                              activity.isEstimatedTime ? 'italic text-muted-foreground' : 'text-foreground'
                            )}>
                              {formatTime12h(activity.startTime)}
                            </span>
                            <input
                              type="time"
                              value={activity.startTime}
                              onChange={(e) => updateActivityTime(gi, ai, e.target.value)}
                              className={cn(
                                'w-[100px] h-6 px-1 text-xs rounded border bg-background text-foreground [font-variant-numeric:tabular-nums]',
                                activity.isEstimatedTime
                                  ? 'border-dashed border-muted-foreground/50 italic text-muted-foreground'
                                  : 'border-border'
                              )}
                            />
                          </div>
                        )}
                        {activity.cost && <span className="text-muted-foreground">${activity.cost.amount}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {groups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No activities could be parsed from the text.</p>
                  <Button variant="ghost" size="sm" onClick={() => setStep('paste')} className="mt-2">
                    Try again
                  </Button>
                </div>
              )}

              {/* Conflict summary */}
              {conflictSummary.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Import Summary
                  </p>
                  {conflictSummary.map((s, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      Day {s.dayNumber}: {s.newCount} new activit{s.newCount === 1 ? 'y' : 'ies'}
                      {s.existingCount > 0 && (
                        <span>
                          {s.mode === 'replace'
                            ? ` (replacing ${s.existingCount} existing)`
                            : ` (merging with ${s.existingCount} existing)`
                          }
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {step === 'paste' ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleParse} disabled={pastedText.trim().length < 3}>
                <ArrowRight className="h-4 w-4 mr-1" />
                Parse & Assign
              </Button>
            </>
          ) : step === 'assign' ? (
            <>
              <Button variant="outline" onClick={() => setStep('paste')}>Back</Button>
              <Button onClick={handleImport} disabled={totalIncluded === 0}>
                Import {totalIncluded} Activit{totalIncluded === 1 ? 'y' : 'ies'}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportActivitiesModal;
