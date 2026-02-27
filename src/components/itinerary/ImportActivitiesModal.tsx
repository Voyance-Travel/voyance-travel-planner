/**
 * ImportActivitiesModal — Paste text to import activities
 * Simple line-by-line parsing, no AI. User arranges manually.
 * Supports Start Over (replace) or Merge (combine + sort by time) when day has existing activities.
 */

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardPaste, Check, X, RefreshCw, Merge, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParsedActivity {
  title: string;
  startTime?: string;
  endTime?: string;
  category: string;
  description?: string;
  location?: { name?: string; address?: string };
  cost?: { amount: number; currency: string };
  included: boolean;
}

export type ImportMode = 'replace' | 'merge';

interface ImportActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (activities: Array<{
    title: string;
    startTime?: string;
    endTime?: string;
    category?: string;
    description?: string;
    location?: { name?: string; address?: string };
    cost?: { amount: number; currency: string };
  }>, mode: ImportMode) => void;
  currency?: string;
  /** Number of existing activities on the target day — drives the merge/replace choice */
  existingActivityCount?: number;
}

// Time patterns: "9:00 AM", "09:00", "9am", "9:00am - 10:30am", "9:00-10:30"
const TIME_PATTERN = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
const TIME_RANGE_PATTERN = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;

// Cost patterns: "$25", "€30", "~$15"
const COST_PATTERN = /[~≈]?[$€£¥]\s*(\d+(?:\.\d{2})?)/;

// Category hints from keywords
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

function normalizeTime(raw: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase();
  
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1]);
    return h <= 23 ? `${h.toString().padStart(2, '0')}:${match24[2]}` : undefined;
  }
  
  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let h = parseInt(match12[1]);
    const m = match12[2] || '00';
    const period = match12[3];
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }
  
  const matchNum = cleaned.match(/^(\d{1,2})$/);
  if (matchNum) {
    const h = parseInt(matchNum[1]);
    if (h <= 23) return `${h.toString().padStart(2, '0')}:00`;
  }

  return undefined;
}

// =============================================================================
// SMART PARSER — Handles ChatGPT / AI-formatted itineraries
// =============================================================================

const SKIP_LINE_PATTERNS: RegExp[] = [
  /^[#*\s]*(?:\*\*)?day\s*\d+/i,
  /^[#*\s🌴🏖️✈️🗺️📍]*\d+-day\s/i,
  /itinerary/i,
  /^[-=*_]{3,}$/,
  /^#{1,4}\s*$/,
  /^(?:\*\*)?why\s+this\s+works/i,
  /^(?:\*\*)?(?:pro\s+)?tips?(?:\s*:|\s+for)/i,
  /^(?:\*\*)?💡/,
  /^(?:\*\*)?optimization/i,
  /^(?:\*\*)?voyance/i,
  /^if\s+you\s+(?:want|need|like)/i,
  /^just\s+tell\s+me/i,
  /^let\s+me\s+know/i,
  /^(?:tailor|rework|adjust|customize|align)\s/i,
  /^(?:\*\*)?(?:morning|afternoon|evening|midday|lunch|departure|arrival|night)(?:\*\*)?$/i,
  /^option\s+[a-c]\s*:/i,
  /^(?:\*\*\s*\*\*|\*\*\*|---+|___+)$/,
  /^(?:best|avoid|stay|book|don't)\s+(?:beaches|midday|dinner|location)/i,
  /^[-•]\s*(?:tailor|rework|align|customize)/i,
];

const SECTION_TIME_MAP: Record<string, string> = {
  'morning': '09:00',
  'late morning': '10:30',
  'midday': '12:00',
  'lunch': '12:30',
  'afternoon': '14:00',
  'late afternoon': '16:00',
  'evening': '18:00',
  'night': '20:00',
  'departure': '08:00',
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

function cleanMarkdown(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-•*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[\p{Emoji}\s]{1,4}(?=\w)/u, '')
    .trim();
}

function parsePastedText(text: string, currency: string): ParsedActivity[] {
  const rawLines = text.split('\n');
  const activities: ParsedActivity[] = [];
  let currentSectionTime: string | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].trim();
    if (!raw) continue;

    const sectionTime = detectSectionTime(raw);
    if (sectionTime) {
      currentSectionTime = sectionTime;
      continue;
    }

    if (isSkipLine(raw)) continue;

    let workingLine = cleanMarkdown(raw);
    if (!workingLine || workingLine.length <= 2) continue;

    if (activities.length > 0 && isDescriptionLine(raw)) {
      const prev = activities[activities.length - 1];
      const detail = cleanMarkdown(raw);
      prev.description = prev.description 
        ? `${prev.description}. ${detail}` 
        : detail;
      continue;
    }

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

    if (!startTime && currentSectionTime) {
      startTime = currentSectionTime;
    }

    let costAmount = 0;
    const costMatch = workingLine.match(COST_PATTERN);
    if (costMatch) {
      costAmount = parseFloat(costMatch[1]);
      workingLine = workingLine.replace(costMatch[0], '').trim();
    }

    workingLine = workingLine.replace(/^[-–—:,]\s*/, '').replace(/[-–—:,]\s*$/, '').trim();

    if (workingLine.length <= 2) continue;

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

    const category = guessCategory(workingLine);

    activities.push({
      title,
      startTime,
      endTime,
      category,
      description,
      location: { name: title },
      cost: costAmount > 0 ? { amount: costAmount, currency } : undefined,
      included: true,
    });
  }

  return activities;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ImportActivitiesModal({ 
  isOpen, onClose, onImport, currency = 'USD', existingActivityCount = 0 
}: ImportActivitiesModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [step, setStep] = useState<'mode' | 'paste' | 'review'>('paste');
  const [parsed, setParsed] = useState<ParsedActivity[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  const hasExistingActivities = existingActivityCount > 0;

  const handleOpen = () => {
    // If day has activities, show mode choice first; otherwise go straight to paste
    if (hasExistingActivities) {
      setStep('mode');
    } else {
      setStep('paste');
      setImportMode('replace'); // No existing activities, replace is the only option
    }
  };

  // Reset to correct initial step when modal opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      handleOpen();
    } else {
      handleClose();
    }
  };

  const handleParse = () => {
    const activities = parsePastedText(pastedText, currency);
    setParsed(activities);
    setStep('review');
  };

  const toggleActivity = (index: number) => {
    setParsed(prev => prev.map((a, i) => i === index ? { ...a, included: !a.included } : a));
  };

  const handleImport = () => {
    const toImport = parsed
      .filter(a => a.included)
      .map(({ included, ...rest }) => rest);
    onImport(toImport, importMode);
    handleClose();
  };

  const handleClose = () => {
    setPastedText('');
    setParsed([]);
    setStep('paste');
    setImportMode('merge');
    onClose();
  };

  const includedCount = parsed.filter(a => a.included).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            Import Activities
          </DialogTitle>
          <DialogDescription>
            {step === 'mode' 
              ? `This day already has ${existingActivityCount} ${existingActivityCount === 1 ? 'activity' : 'activities'}. How would you like to import?`
              : step === 'paste'
                ? 'Paste an itinerary from your research, notes, or any text. One activity per line works best.'
                : `${includedCount} of ${parsed.length} activities selected for import`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'mode' ? (
          <div className="space-y-3 py-2">
            <button
              onClick={() => { setImportMode('replace'); setStep('paste'); }}
              className={cn(
                'w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                'hover:border-primary/40 hover:bg-primary/5 border-border'
              )}
            >
              <div className="mt-0.5 h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <RefreshCw className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm">Start Over</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Replace all {existingActivityCount} existing {existingActivityCount === 1 ? 'activity' : 'activities'} with the imported content
                </p>
              </div>
            </button>

            <button
              onClick={() => { setImportMode('merge'); setStep('paste'); }}
              className={cn(
                'w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                'hover:border-primary/40 hover:bg-primary/5 border-border'
              )}
            >
              <div className="mt-0.5 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Merge className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Merge</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add imported activities alongside existing ones, sorted by time
                </p>
              </div>
            </button>
          </div>
        ) : step === 'paste' ? (
          <div className="space-y-3 py-2">
            {hasExistingActivities && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                importMode === 'replace' 
                  ? 'bg-destructive/10 text-destructive' 
                  : 'bg-primary/10 text-primary'
              )}>
                {importMode === 'replace' ? (
                  <><RefreshCw className="h-3.5 w-3.5" /> Starting over - existing activities will be replaced</>
                ) : (
                  <><Merge className="h-3.5 w-3.5" /> Merging - imported activities will be added alongside existing ones</>
                )}
              </div>
            )}
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Example:\n9:00 AM - Visit Eagle Beach\n11:00 AM - Snorkeling at Malmok - $40\n1:00 PM - Lunch at Zeerovers - fresh seafood\n3:00 PM - Explore Oranjestad downtown\n6:00 PM - Sunset at California Lighthouse`}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Times, costs ($), and categories are auto-detected. You can edit everything after import.
            </p>
          </div>
        ) : (
          <div className="py-2 max-h-[50vh] overflow-y-auto space-y-1">
            {parsed.map((activity, i) => (
              <div
                key={i}
                onClick={() => toggleActivity(i)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border',
                  activity.included
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-muted/30 border-transparent opacity-50'
                )}
              >
                <div className={cn(
                  'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  activity.included ? 'border-primary bg-primary' : 'border-muted-foreground'
                )}>
                  {activity.included && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {activity.startTime && (
                      <span>{activity.startTime}{activity.endTime ? ` – ${activity.endTime}` : ''}</span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wide">
                      {activity.category}
                    </span>
                    {activity.cost && <span>${activity.cost.amount}</span>}
                  </div>
                  {activity.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{activity.description}</p>
                  )}
                </div>
              </div>
            ))}
            {parsed.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No activities could be parsed from the text.</p>
                <Button variant="ghost" size="sm" onClick={() => setStep('paste')} className="mt-2">
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'mode' ? (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          ) : step === 'paste' ? (
            <>
              <Button variant="outline" onClick={hasExistingActivities ? () => setStep('mode') : handleClose}>
                {hasExistingActivities ? 'Back' : 'Cancel'}
              </Button>
              <Button onClick={handleParse} disabled={pastedText.trim().length < 3}>
                Parse Activities
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('paste')}>Back</Button>
              <Button onClick={handleImport} disabled={includedCount === 0}>
                {importMode === 'replace' ? 'Replace with' : 'Merge'} {includedCount} {includedCount === 1 ? 'Activity' : 'Activities'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportActivitiesModal;
