/**
 * GenerationRules — Structured constraint rules for trip itinerary generation.
 * Compact, mobile-friendly design with sheet-based rule creation.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Clock, CalendarHeart, Hotel, Users, MessageSquare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface GenerationRule {
  type: 'blocked_time' | 'special_event' | 'hotel_change' | 'guest_change' | 'free_text';
  days?: string[];
  from?: string;
  to?: string;
  reason?: string;
  date?: string;
  description?: string;
  hotelName?: string;
  additionalGuests?: number;
  note?: string;
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
  { type: 'blocked_time' as const, label: 'Blocked time', icon: Clock },
  { type: 'special_event' as const, label: 'Special event', icon: CalendarHeart },
  { type: 'hotel_change' as const, label: 'Hotel change', icon: Hotel },
  { type: 'guest_change' as const, label: 'Group change', icon: Users },
  { type: 'free_text' as const, label: 'Other', icon: MessageSquare },
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

function getRuleSummary(rule: GenerationRule): string {
  switch (rule.type) {
    case 'blocked_time': {
      const dayLabels = (rule.days || []).map(d => DAY_OPTIONS.find(o => o.id === d)?.label || d).join(', ');
      return `${dayLabels} ${rule.from}–${rule.to}${rule.reason ? ` · ${rule.reason}` : ''}`;
    }
    case 'special_event':
      return `${rule.date} · ${rule.description || 'Event'}`;
    case 'hotel_change':
      return `${rule.date}${rule.hotelName ? ` · ${rule.hotelName}` : ''}`;
    case 'guest_change': {
      const n = rule.additionalGuests || 0;
      return `${rule.date} · ${n > 0 ? '+' : ''}${n} traveler${Math.abs(n) !== 1 ? 's' : ''}${rule.note ? ` · ${rule.note}` : ''}`;
    }
    case 'free_text':
      return rule.text || '';
    default:
      return '';
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
    <div className="space-y-2">
      {/* Header — only show label, keep it minimal */}
      <div className="flex items-center justify-between">
        <label className="text-xs tracking-wide uppercase font-medium text-muted-foreground">
          Scheduling rules
        </label>
        <span className="text-xs text-muted-foreground/60">(optional)</span>
      </div>

      {/* Existing rules — compact single-line items */}
      {rules.length > 0 && (
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {rules.map((rule, i) => {
              const Icon = getRuleIcon(rule.type);
              const summary = getRuleSummary(rule);
              return (
                <motion.div
                  key={`${rule.type}-${i}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/40 border border-border text-sm"
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-foreground">{summary}</span>
                  <button
                    type="button"
                    onClick={() => removeRule(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Best-effort warning — compact */}
      {hasComplexRules && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
          Complex rules are best-effort — you may need to adjust manually.
        </p>
      )}

      {/* Add rule — small text link when empty, small button when rules exist */}
      <button
        type="button"
        onClick={() => { resetDraft(); setSheetOpen(true); }}
        className={cn(
          'inline-flex items-center gap-1 text-sm transition-colors',
          rules.length === 0
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-primary hover:text-primary/80'
        )}
      >
        <Plus className="w-3.5 h-3.5" />
        Add a rule
      </button>

      {/* Add Rule Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">
              {selectedType ? RULE_TYPES.find(r => r.type === selectedType)?.label : 'Add a rule'}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-3">
            {!selectedType ? (
              /* Rule type selector — compact select dropdown */
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">What kind of rule?</p>
                <div className="grid grid-cols-2 gap-2">
                  {RULE_TYPES.map(rt => {
                    const Icon = rt.icon;
                    return (
                      <button
                        key={rt.type}
                        type="button"
                        onClick={() => setSelectedType(rt.type)}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors text-left"
                      >
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground">{rt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : selectedType === 'blocked_time' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_OPTIONS.map(day => (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        className={cn(
                          'w-10 h-8 rounded text-xs border transition-colors',
                          draftDays.includes(day.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:border-primary/50'
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-1.5">
                    {[
                      { label: 'Weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
                      { label: 'Weekends', days: ['sat', 'sun'] },
                      { label: 'All', days: DAY_OPTIONS.map(d => d.id) },
                    ].map(preset => (
                      <button key={preset.label} type="button" onClick={() => setDraftDays(preset.days)} className="text-xs text-primary hover:underline">
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">From</label>
                    <Input type="time" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">To</label>
                    <Input type="time" value={draftTo} onChange={e => setDraftTo(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input value={draftReason} onChange={e => setDraftReason(e.target.value)} placeholder="e.g., Work meetings" className="h-9 text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" size="sm" onClick={addRule} disabled={draftDays.length === 0} className="flex-1">Add</Button>
                </div>
              </div>
            ) : selectedType === 'special_event' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Date</label>
                  <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} min={startDate} max={endDate} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">What's happening?</label>
                  <Input value={draftDescription} onChange={e => setDraftDescription(e.target.value)} placeholder="e.g., Anniversary dinner" className="h-9 text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" size="sm" onClick={addRule} disabled={!draftDate || !draftDescription} className="flex-1">Add</Button>
                </div>
              </div>
            ) : selectedType === 'hotel_change' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Date</label>
                  <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} min={startDate} max={endDate} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">New hotel <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input value={draftHotelName} onChange={e => setDraftHotelName(e.target.value)} placeholder="e.g., Hotel Lunetta" className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input value={draftNote} onChange={e => setDraftNote(e.target.value)} placeholder="e.g., Check-in after 3pm" className="h-9 text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" size="sm" onClick={addRule} disabled={!draftDate} className="flex-1">Add</Button>
                </div>
              </div>
            ) : selectedType === 'guest_change' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Date</label>
                  <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} min={startDate} max={endDate} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Change</label>
                  <div className="flex items-center gap-2">
                    <Select value={String(draftAdditionalGuests)} onValueChange={v => setDraftAdditionalGuests(parseInt(v))}>
                      <SelectTrigger className="w-20 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[-3, -2, -1, 1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n > 0 ? `+${n}` : n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">{draftAdditionalGuests > 0 ? 'joining' : 'leaving'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Who? <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input value={draftNote} onChange={e => setDraftNote(e.target.value)} placeholder="e.g., My mother arrives" className="h-9 text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" size="sm" onClick={addRule} disabled={!draftDate} className="flex-1">Add</Button>
                </div>
              </div>
            ) : selectedType === 'free_text' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">What should we know?</label>
                  <Textarea
                    value={draftFreeText}
                    onChange={e => setDraftFreeText(e.target.value)}
                    placeholder="e.g., We're celebrating our anniversary on March 18"
                    className="min-h-[60px] resize-none text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="flex-1">Back</Button>
                  <Button type="button" size="sm" onClick={addRule} disabled={!draftFreeText.trim()} className="flex-1">Add</Button>
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
