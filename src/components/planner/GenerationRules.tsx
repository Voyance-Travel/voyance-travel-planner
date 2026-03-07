/**
 * GenerationRules — Structured constraint rules for trip itinerary generation.
 * Replaces free-text approach with typed, reliable constraints.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Clock, CalendarHeart, Hotel, Users, MessageSquare, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface GenerationRule {
  type: 'blocked_time' | 'special_event' | 'hotel_change' | 'guest_change' | 'free_text';
  // blocked_time
  days?: string[];
  from?: string;
  to?: string;
  reason?: string;
  // special_event / hotel_change / guest_change
  date?: string;
  description?: string;
  hotelName?: string;
  additionalGuests?: number;
  note?: string;
  // free_text
  text?: string;
}

const DAY_OPTIONS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

const RULE_TYPES = [
  { type: 'blocked_time' as const, label: 'Blocked time', icon: Clock, description: "I'm unavailable during certain hours" },
  { type: 'special_event' as const, label: 'Special event', icon: CalendarHeart, description: 'Something happening on a specific date' },
  { type: 'hotel_change' as const, label: 'Hotel change', icon: Hotel, description: "I'm switching hotels mid-trip" },
  { type: 'guest_change' as const, label: 'Group change', icon: Users, description: 'Someone joins or leaves mid-trip' },
  { type: 'free_text' as const, label: 'Other', icon: MessageSquare, description: 'Anything else the planner should know' },
];

function getRuleIcon(type: GenerationRule['type']) {
  switch (type) {
    case 'blocked_time': return Clock;
    case 'special_event': return CalendarHeart;
    case 'hotel_change': return Hotel;
    case 'guest_change': return Users;
    default: return MessageSquare;
  }
}

function getRuleSummary(rule: GenerationRule): { label: string; detail: string } {
  switch (rule.type) {
    case 'blocked_time': {
      const dayLabels = (rule.days || []).map(d => DAY_OPTIONS.find(o => o.id === d)?.label || d).join(', ');
      return {
        label: `Unavailable ${dayLabels}`,
        detail: `${rule.from || '?'} – ${rule.to || '?'}${rule.reason ? ` (${rule.reason})` : ''}`,
      };
    }
    case 'special_event':
      return {
        label: `Event on ${rule.date || '?'}`,
        detail: rule.description || 'Special event',
      };
    case 'hotel_change':
      return {
        label: `Hotel change on ${rule.date || '?'}`,
        detail: rule.hotelName ? `Moving to ${rule.hotelName}` : 'Switching hotels',
      };
    case 'guest_change':
      return {
        label: `Group change on ${rule.date || '?'}`,
        detail: rule.additionalGuests
          ? `${rule.additionalGuests > 0 ? '+' : ''}${rule.additionalGuests} traveler${Math.abs(rule.additionalGuests) !== 1 ? 's' : ''}`
          : rule.note || 'Group size changes',
      };
    case 'free_text':
      return {
        label: 'Custom rule',
        detail: rule.text || '',
      };
    default:
      return { label: 'Rule', detail: '' };
  }
}

interface GenerationRulesProps {
  rules: GenerationRule[];
  onRulesChange: (rules: GenerationRule[]) => void;
  startDate?: string;
  endDate?: string;
}

export function GenerationRules({ rules, onRulesChange, startDate, endDate }: GenerationRulesProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<GenerationRule['type'] | null>(null);

  // Draft state for each rule type
  const [draftDays, setDraftDays] = useState<string[]>([]);
  const [draftFrom, setDraftFrom] = useState('09:00');
  const [draftTo, setDraftTo] = useState('15:00');
  const [draftReason, setDraftReason] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftHotelName, setDraftHotelName] = useState('');
  const [draftAdditionalGuests, setDraftAdditionalGuests] = useState(1);
  const [draftNote, setDraftNote] = useState('');
  const [draftFreeText, setDraftFreeText] = useState('');

  const resetDraft = () => {
    setDraftDays([]);
    setDraftFrom('09:00');
    setDraftTo('15:00');
    setDraftReason('');
    setDraftDate('');
    setDraftDescription('');
    setDraftHotelName('');
    setDraftAdditionalGuests(1);
    setDraftNote('');
    setDraftFreeText('');
    setSelectedType(null);
  };

  const addRule = () => {
    if (!selectedType) return;

    let newRule: GenerationRule;
    switch (selectedType) {
      case 'blocked_time':
        if (draftDays.length === 0) return;
        newRule = { type: 'blocked_time', days: draftDays, from: draftFrom, to: draftTo, reason: draftReason || undefined };
        break;
      case 'special_event':
        if (!draftDate || !draftDescription) return;
        newRule = { type: 'special_event', date: draftDate, description: draftDescription };
        break;
      case 'hotel_change':
        if (!draftDate) return;
        newRule = { type: 'hotel_change', date: draftDate, hotelName: draftHotelName || undefined, note: draftNote || undefined };
        break;
      case 'guest_change':
        if (!draftDate) return;
        newRule = { type: 'guest_change', date: draftDate, additionalGuests: draftAdditionalGuests, note: draftNote || undefined };
        break;
      case 'free_text':
        if (!draftFreeText.trim()) return;
        newRule = { type: 'free_text', text: draftFreeText.trim() };
        break;
      default:
        return;
    }

    onRulesChange([...rules, newRule]);
    resetDraft();
    setSheetOpen(false);
  };

  const removeRule = (index: number) => {
    onRulesChange(rules.filter((_, i) => i !== index));
  };

  const toggleDay = (dayId: string) => {
    setDraftDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]);
  };

  const hasComplexRules = rules.some(r => r.type === 'blocked_time' || r.type === 'hotel_change' || r.type === 'guest_change');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
          <AlertTriangle className="w-4 h-4" />
          Rules for your trip
        </label>
        <span className="text-xs text-muted-foreground/60">(optional)</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Schedule constraints, special events, or anything the itinerary should work around.
      </p>

      {/* Existing rules */}
      <AnimatePresence mode="popLayout">
        {rules.map((rule, i) => {
          const Icon = getRuleIcon(rule.type);
          const { label, detail } = getRuleSummary(rule);
          return (
            <motion.div
              key={`${rule.type}-${i}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 bg-muted/50 rounded-lg p-3 border border-border"
            >
              <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground block truncate">{detail}</span>
              </div>
              <button
                type="button"
                onClick={() => removeRule(i)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Best-effort warning */}
      {hasComplexRules && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-foreground font-medium">Heads up</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complex rules like blocked time windows and mid-trip changes are best-effort. 
              The itinerary will try to respect them, but you may need to manually adjust.
            </p>
          </div>
        </div>
      )}

      {/* Add rule button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { resetDraft(); setSheetOpen(true); }}
        className="text-sm gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Add a rule
      </Button>

      {/* Add Rule Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedType ? `Add ${RULE_TYPES.find(r => r.type === selectedType)?.label}` : 'Choose rule type'}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {!selectedType ? (
              /* Rule type selection */
              <div className="space-y-2">
                {RULE_TYPES.map(rt => {
                  const Icon = rt.icon;
                  return (
                    <button
                      key={rt.type}
                      type="button"
                      onClick={() => setSelectedType(rt.type)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-left"
                    >
                      <Icon className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-foreground">{rt.label}</div>
                        <div className="text-xs text-muted-foreground">{rt.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : selectedType === 'blocked_time' ? (
              /* Blocked time form */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Which days?</label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map(day => (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm border transition-all',
                          draftDays.includes(day.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:border-primary/50'
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setDraftDays(['mon', 'tue', 'wed', 'thu', 'fri'])}
                      className="text-xs text-primary hover:underline"
                    >
                      Weekdays
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftDays(['sat', 'sun'])}
                      className="text-xs text-primary hover:underline"
                    >
                      Weekends
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftDays(DAY_OPTIONS.map(d => d.id))}
                      className="text-xs text-primary hover:underline"
                    >
                      Every day
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">From</label>
                    <Input type="time" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">To</label>
                    <Input type="time" value={draftTo} onChange={e => setDraftTo(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    value={draftReason}
                    onChange={e => setDraftReason(e.target.value)}
                    placeholder="e.g., School, work meetings, nap time..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" onClick={addRule} disabled={draftDays.length === 0} className="flex-1">Add Rule</Button>
                </div>
              </div>
            ) : selectedType === 'special_event' ? (
              /* Special event form */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Date</label>
                  <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} min={startDate} max={endDate} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">What's happening?</label>
                  <Input
                    value={draftDescription}
                    onChange={e => setDraftDescription(e.target.value)}
                    placeholder="e.g., My mother arrives — plan activities for two"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" onClick={addRule} disabled={!draftDate || !draftDescription} className="flex-1">Add Rule</Button>
                </div>
              </div>
            ) : selectedType === 'hotel_change' ? (
              /* Hotel change form */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Date of hotel change</label>
                  <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} min={startDate} max={endDate} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">New hotel name <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    value={draftHotelName}
                    onChange={e => setDraftHotelName(e.target.value)}
                    placeholder="e.g., Hotel Lunetta, Trastevere"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input value={draftNote} onChange={e => setDraftNote(e.target.value)} placeholder="e.g., Check-in after 3pm" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" onClick={addRule} disabled={!draftDate} className="flex-1">Add Rule</Button>
                </div>
              </div>
            ) : selectedType === 'guest_change' ? (
              /* Guest change form */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Date</label>
                  <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} min={startDate} max={endDate} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">How many people join or leave?</label>
                  <div className="flex items-center gap-3">
                    <Select value={String(draftAdditionalGuests)} onValueChange={v => setDraftAdditionalGuests(parseInt(v))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[-3, -2, -1, 1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>
                            {n > 0 ? `+${n}` : n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      {draftAdditionalGuests > 0 ? 'joining' : 'leaving'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Who? <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input value={draftNote} onChange={e => setDraftNote(e.target.value)} placeholder="e.g., My mother arrives from Madrid" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" onClick={addRule} disabled={!draftDate} className="flex-1">Add Rule</Button>
                </div>
              </div>
            ) : selectedType === 'free_text' ? (
              /* Free text form */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">What should we know?</label>
                  <Textarea
                    value={draftFreeText}
                    onChange={e => setDraftFreeText(e.target.value)}
                    placeholder="e.g., We're celebrating our anniversary on March 18 — something special for dinner that night."
                    className="min-h-[80px] resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" onClick={addRule} disabled={!draftFreeText.trim()} className="flex-1">Add Rule</Button>
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Convert structured rules into a prompt section for the AI generation engine */
export function rulesToPrompt(rules: GenerationRule[]): string {
  if (!rules || rules.length === 0) return '';

  const lines: string[] = [];
  lines.push('\n## 🚨 RULES THE ITINERARY MUST FOLLOW\n');
  lines.push('The traveler has set the following constraints. These are NON-NEGOTIABLE. Violations will result in a bad itinerary.\n');

  rules.forEach((rule, i) => {
    const num = i + 1;
    switch (rule.type) {
      case 'blocked_time': {
        const dayMap: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
        const dayNames = (rule.days || []).map(d => dayMap[d] || d).join(', ');
        lines.push(`${num}. BLOCKED TIME: On ${dayNames}, do NOT schedule any activities between ${rule.from} and ${rule.to}.${rule.reason ? ` Reason: ${rule.reason}.` : ''} Leave these hours completely free.`);
        break;
      }
      case 'special_event':
        lines.push(`${num}. SPECIAL EVENT on ${rule.date}: ${rule.description}. Adjust the day's plan accordingly.`);
        break;
      case 'hotel_change':
        lines.push(`${num}. HOTEL CHANGE on ${rule.date}: The traveler is changing hotels${rule.hotelName ? ` to ${rule.hotelName}` : ''}.${rule.note ? ` ${rule.note}.` : ''} Plan check-out from old hotel and check-in at new hotel, and cluster that day's activities near the new hotel's area.`);
        break;
      case 'guest_change': {
        const direction = (rule.additionalGuests || 0) > 0 ? 'joining' : 'leaving';
        const count = Math.abs(rule.additionalGuests || 0);
        lines.push(`${num}. GROUP CHANGE on ${rule.date}: ${count} traveler${count !== 1 ? 's' : ''} ${direction}.${rule.note ? ` (${rule.note})` : ''} From this date onward, plan activities suitable for the new group size.`);
        break;
      }
      case 'free_text':
        lines.push(`${num}. USER CONSTRAINT: ${rule.text}`);
        break;
    }
  });

  lines.push('\nIMPORTANT: If ANY activity conflicts with the above rules, remove or reschedule it. The rules above override default scheduling.\n');
  return lines.join('\n');
}

export default GenerationRules;
