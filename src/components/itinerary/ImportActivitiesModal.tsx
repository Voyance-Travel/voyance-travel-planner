/**
 * ImportActivitiesModal — Paste text to import activities
 * Simple line-by-line parsing, no AI. User arranges manually.
 */

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardPaste, Check, X, GripVertical } from 'lucide-react';
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
  }>) => void;
  currency?: string;
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
  
  // Already 24h: "14:30"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1]);
    return h <= 23 ? `${h.toString().padStart(2, '0')}:${match24[2]}` : undefined;
  }
  
  // 12h: "2:30pm", "2pm", "2:30 PM"
  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let h = parseInt(match12[1]);
    const m = match12[2] || '00';
    const period = match12[3];
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }
  
  // Just a number: "9" → "09:00"
  const matchNum = cleaned.match(/^(\d{1,2})$/);
  if (matchNum) {
    const h = parseInt(matchNum[1]);
    if (h <= 23) return `${h.toString().padStart(2, '0')}:00`;
  }

  return undefined;
}

function parsePastedText(text: string, currency: string): ParsedActivity[] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    // Skip lines that are just headers/day markers
    .filter(l => !/^(day\s*\d+|---+|===+|\*\*\*+|#{1,3}\s)$/i.test(l));

  return lines.map(line => {
    let workingLine = line;
    
    // Remove common list markers: "- ", "• ", "1. ", "* "
    workingLine = workingLine.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '');

    // Extract time range
    let startTime: string | undefined;
    let endTime: string | undefined;
    const rangeMatch = workingLine.match(TIME_RANGE_PATTERN);
    if (rangeMatch) {
      startTime = normalizeTime(rangeMatch[1]);
      endTime = normalizeTime(rangeMatch[2]);
      workingLine = workingLine.replace(rangeMatch[0], '').trim();
    } else {
      // Single time
      const times = workingLine.match(TIME_PATTERN);
      if (times && times.length > 0) {
        startTime = normalizeTime(times[0]);
        workingLine = workingLine.replace(times[0], '').trim();
      }
    }

    // Extract cost
    let costAmount = 0;
    const costMatch = workingLine.match(COST_PATTERN);
    if (costMatch) {
      costAmount = parseFloat(costMatch[1]);
      workingLine = workingLine.replace(costMatch[0], '').trim();
    }

    // Clean up separators
    workingLine = workingLine.replace(/^[-–—:,]\s*/, '').replace(/[-–—:,]\s*$/, '').trim();

    // Split title from description at first sentence break or dash
    let title = workingLine;
    let description: string | undefined;
    
    // If there's a dash or colon separating title from detail
    const separatorMatch = workingLine.match(/^([^-–—:]+?)\s*[-–—:]\s*(.+)$/);
    if (separatorMatch && separatorMatch[1].length > 3 && separatorMatch[1].length < 80) {
      title = separatorMatch[1].trim();
      description = separatorMatch[2].trim();
    }

    const category = guessCategory(workingLine);

    return {
      title,
      startTime,
      endTime,
      category,
      description,
      location: { name: title },
      cost: costAmount > 0 ? { amount: costAmount, currency } : undefined,
      included: true,
    };
  }).filter(a => a.title.length > 1);
}

export function ImportActivitiesModal({ isOpen, onClose, onImport, currency = 'USD' }: ImportActivitiesModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [parsed, setParsed] = useState<ParsedActivity[]>([]);

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
    onImport(toImport);
    handleClose();
  };

  const handleClose = () => {
    setPastedText('');
    setParsed([]);
    setStep('paste');
    onClose();
  };

  const includedCount = parsed.filter(a => a.included).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            Import Activities
          </DialogTitle>
          <DialogDescription>
            {step === 'paste' 
              ? 'Paste an itinerary from ChatGPT, notes, or any text. One activity per line works best.'
              : `${includedCount} of ${parsed.length} activities selected for import`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'paste' ? (
          <div className="space-y-3 py-2">
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
          {step === 'paste' ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleParse} disabled={pastedText.trim().length < 3}>
                Parse Activities
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('paste')}>Back</Button>
              <Button onClick={handleImport} disabled={includedCount === 0}>
                Import {includedCount} {includedCount === 1 ? 'Activity' : 'Activities'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportActivitiesModal;
