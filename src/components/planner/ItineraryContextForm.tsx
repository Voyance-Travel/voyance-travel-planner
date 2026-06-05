import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Hotel, Plane, Clock, MapPin, Info, Sparkles, ArrowRight, Globe, CalendarCheck, Star, Plus, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { buildUserAnchors, type UserAnchor } from '@/utils/userAnchors';

const MUST_DO_MAX = 1500;

function formatTimeLabel(hhmm?: string): string | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mins = m[2];
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mins} ${period}`;
}

export interface PreBookedCommitment {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  category: 'show' | 'restaurant' | 'tour' | 'event' | 'meeting' | 'other';
}

export interface ItineraryContextData {
  hotelLocation?: string;
  hotelNeighborhood?: string;
  arrivalTime?: string; // HH:MM format
  departureTime?: string; // HH:MM format
  isFirstTimeVisitor?: boolean; // First time visiting this destination?
  childrenAges?: number[]; // Ages of children if traveling with kids
  preBookedCommitments?: PreBookedCommitment[]; // Fixed events that can't be moved
  mustDoActivities?: string; // User's must-do list as comma-separated string
  perDayActivities?: Array<{ dayNumber: number; activities: string }>; // Per-day structured activities from Just Tell Us
  additionalNotes?: string; // Freeform "Anything else?" - feeds metadata.additionalNotes (prompt TRIP PURPOSE block)
}

interface ItineraryContextFormProps {
  destination: string;
  startDate: string;
  endDate: string;
  onContinue: (data: ItineraryContextData) => void;
  onSkip: () => void;
  isLoading?: boolean;
  // Pre-populated values from Start page (if available)
  initialHotelLocation?: string;
  initialArrivalTime?: string;
  initialDepartureTime?: string;
  // Family trip context
  childrenCount?: number;
  tripType?: string;
}

export default function ItineraryContextForm({
  destination,
  startDate,
  endDate,
  onContinue,
  onSkip,
  isLoading,
  initialHotelLocation,
  initialArrivalTime,
  initialDepartureTime,
  childrenCount = 0,
  tripType,
}: ItineraryContextFormProps) {
  const [hotelLocation, setHotelLocation] = useState(initialHotelLocation || '');
  // Don't auto-fill flight times - let user explicitly enter them
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  // First-time visitor toggle - defaults to true (most common case)
  const [isFirstTimeVisitor, setIsFirstTimeVisitor] = useState(true);
  // Children ages for family trips
  const [childrenAges, setChildrenAges] = useState<number[]>(
    childrenCount > 0 ? Array(childrenCount).fill(5) : []
  );
  // Pre-booked commitments
  const [commitments, setCommitments] = useState<PreBookedCommitment[]>([]);
  const [showCommitmentForm, setShowCommitmentForm] = useState(false);
  const [newCommitment, setNewCommitment] = useState<Partial<PreBookedCommitment>>({
    category: 'event',
  });
  // Must-do activities
  const [mustDoActivities, setMustDoActivities] = useState('');
  const mustDoRef = useRef<HTMLTextAreaElement | null>(null);
  // Freeform "Anything else?" notes (vibes, things to skip, special requests).
  // Separate from mustDoActivities so the prompt treats it as context, not as a venue.
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Live parse preview — debounced, mirrors what backend `buildUserAnchors` will see
  const [debouncedMustDo, setDebouncedMustDo] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMustDo(mustDoActivities), 250);
    return () => clearTimeout(t);
  }, [mustDoActivities]);

  const parsedAnchors = useMemo<UserAnchor[]>(() => {
    if (!debouncedMustDo.trim()) return [];
    try {
      return buildUserAnchors({ mustDoActivities: debouncedMustDo, source: 'manual_paste' });
    } catch {
      return [];
    }
  }, [debouncedMustDo]);

  const unparsedLines = useMemo<string[]>(() => {
    if (!debouncedMustDo.trim()) return [];
    const lines = debouncedMustDo.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (parsedAnchors.length === 0) return lines;
    const matched = new Set(parsedAnchors.map((a) => (a.raw || a.title).trim().toLowerCase()));
    return lines.filter((line) => {
      const lower = line.toLowerCase();
      // Line counts as parsed if any anchor's raw text appears within it (or vice versa)
      for (const m of matched) {
        if (lower.includes(m) || m.includes(lower)) return false;
      }
      return true;
    });
  }, [debouncedMustDo, parsedAnchors]);

  const insertAtCursor = (snippet: string) => {
    const el = mustDoRef.current;
    if (!el) {
      setMustDoActivities((prev) => (prev ? `${prev}${snippet}` : snippet));
      return;
    }
    const start = el.selectionStart ?? mustDoActivities.length;
    const end = el.selectionEnd ?? mustDoActivities.length;
    const next = mustDoActivities.slice(0, start) + snippet + mustDoActivities.slice(end);
    setMustDoActivities(next.slice(0, MUST_DO_MAX));
    // Restore caret after React re-renders
    requestAnimationFrame(() => {
      const pos = Math.min(start + snippet.length, MUST_DO_MAX);
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  // Detect complex constraints in must-do text
  const complexConstraintKeywords = /\b(school|class|work|meeting|hotel change|switching hotel|change hotel|moving hotel|new hotel|joining|my aunt|my mom|my friend|family joining|guest|arrives|leaving early|blocked|not available|unavailable|appointment|conference|seminar|5 hours|half.?day|morning off|afternoon off)\b/i;
  const hasComplexConstraints = complexConstraintKeywords.test(mustDoActivities);

  const hasAnyData = hotelLocation || arrivalTime || departureTime || commitments.length > 0 || mustDoActivities;
  const showChildrenAges = childrenCount > 0 || tripType === 'family';

  const handleChildAgeChange = (index: number, age: number) => {
    const newAges = [...childrenAges];
    newAges[index] = age;
    setChildrenAges(newAges);
  };

  const handleAddCommitment = () => {
    if (newCommitment.title && newCommitment.date && newCommitment.startTime) {
      setCommitments([...commitments, {
        id: `commit_${Date.now()}`,
        title: newCommitment.title,
        date: newCommitment.date,
        startTime: newCommitment.startTime,
        endTime: newCommitment.endTime,
        location: newCommitment.location,
        category: newCommitment.category || 'other',
      }]);
      setNewCommitment({ category: 'event' });
      setShowCommitmentForm(false);
    }
  };

  const handleRemoveCommitment = (id: string) => {
    setCommitments(commitments.filter(c => c.id !== id));
  };

  const handleContinue = () => {
    // Group pinned anchors by dayNumber → perDayActivities mirror (chat-planner parity)
    let perDayActivities: Array<{ dayNumber: number; activities: string }> | undefined;
    // Only items with BOTH a day pin AND an explicit start time become per-day anchors.
    // Free-text lines without time stay in mustDoActivities (string) and feed the prompt
    // as soft requirements so the model can place them with a real time/address/description
    // instead of getting stamped on as locked rows with no detail.
    const pinned = parsedAnchors.filter((a) => a.dayNumber > 0 && !!a.startTime);
    if (pinned.length > 0) {
      const byDay = new Map<number, string[]>();
      for (const a of pinned) {
        const entry = a.startTime
          ? `${formatTimeLabel(a.startTime)} - ${a.title}`
          : a.title;
        const list = byDay.get(a.dayNumber) || [];
        list.push(entry);
        byDay.set(a.dayNumber, list);
      }
      perDayActivities = Array.from(byDay.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([dayNumber, items]) => ({ dayNumber, activities: items.join(', ') }));
    }

    onContinue({
      hotelLocation: hotelLocation || undefined,
      arrivalTime: arrivalTime || undefined,
      departureTime: departureTime || undefined,
      isFirstTimeVisitor,
      childrenAges: showChildrenAges && childrenAges.length > 0 ? childrenAges : undefined,
      preBookedCommitments: commitments.length > 0 ? commitments : undefined,
      mustDoActivities: mustDoActivities || undefined,
      perDayActivities,
      additionalNotes: additionalNotes.trim() || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-xs tracking-[0.2em] uppercase text-primary font-medium mb-3">
          {destination}
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-light text-foreground mb-3">
          Help Us <em className="italic">Personalize</em>
        </h1>
        <p className="text-muted-foreground text-balance">
          Optional details that help us plan around your schedule
        </p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 mb-8">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Why share this?</p>
          <p>
            Your hotel location helps us plan activities nearby. Flight times ensure 
            we don't schedule anything before you land or after you need to leave.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Hotel Location */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Hotel className="w-4 h-4 text-muted-foreground" />
            Where are you staying?
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            value={hotelLocation}
            onChange={(e) => setHotelLocation(e.target.value)}
            placeholder="e.g., Hilton Tower Bridge, Shoreditch area"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Hotel name, neighborhood, or address
          </p>
        </div>

        {/* First-Time Visitor Toggle */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="firstTimeVisitor"
            checked={isFirstTimeVisitor}
            onCheckedChange={(checked) => setIsFirstTimeVisitor(checked === true)}
            className="mt-0.5"
          />
          <div className="flex-1">
            <Label 
              htmlFor="firstTimeVisitor" 
              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
              First time visiting {destination}?
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {isFirstTimeVisitor 
                ? "We'll include iconic landmarks and must-see attractions" 
                : "We'll focus on hidden gems and local favorites"}
            </p>
          </div>
        </div>

        {/* Children Ages - Only show for family trips */}
        {showChildrenAges && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              Children's Ages
              <span className="text-xs text-muted-foreground font-normal">(helps us pick activities)</span>
            </Label>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: childrenCount || 1 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Child {index + 1}:</span>
                  <select
                    value={childrenAges[index] || 5}
                    onChange={(e) => handleChildAgeChange(index, parseInt(e.target.value))}
                    className="h-9 px-2 text-sm rounded-md border border-border bg-background"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(age => (
                      <option key={age} value={age}>
                        {age === 0 ? 'Under 1' : age === 17 ? '17+' : age}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {childrenAges.some(age => age <= 3) 
                ? "👶 Toddler detected - we'll include nap time and early dinners"
                : childrenAges.some(age => age >= 13)
                ? "🎮 Teen detected - we'll include age-appropriate activities"
                : "👦 We'll pick family-friendly activities for all ages"}
            </p>
          </div>
        )}

        {/* Flight Times - Optional Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Flight Times</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Optional</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Skip this if you don't have flights booked yet. We'll plan a full day for arrival and departure.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Plane className="w-3.5 h-3.5 rotate-[-45deg]" />
                Arrival
              </Label>
              <Input
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="h-11"
                placeholder="--:--"
              />
              <p className="text-xs text-muted-foreground">
                {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Plane className="w-3.5 h-3.5 rotate-45" />
                Departure
              </Label>
              <Input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="h-11"
                placeholder="--:--"
              />
              <p className="text-xs text-muted-foreground">
                {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Must-Do Activities — free-text with live parse preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Star className="w-4 h-4 text-muted-foreground" />
              Must-Do Activities
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => insertAtCursor(mustDoActivities && !mustDoActivities.endsWith('\n') ? '\nDay 2: ' : 'Day 2: ')}
              >
                + Day N
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => insertAtCursor('7:30 PM ')}
              >
                + Time
              </Button>
            </div>
          </div>
          <Textarea
            ref={mustDoRef}
            value={mustDoActivities}
            onChange={(e) => setMustDoActivities(e.target.value.slice(0, MUST_DO_MAX))}
            maxLength={MUST_DO_MAX}
            placeholder={'e.g.\nDay 1: Colosseum 9am\nDay 2: Dinner at Roscioli 7:30 PM\nDay trip to Tivoli'}
            className="min-h-[110px] resize-none font-sans"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>Tell us what you can't miss. Add "Day 2" or a time to pin it.</p>
            <span className={cn(mustDoActivities.length > MUST_DO_MAX * 0.9 && 'text-amber-600')}>
              {mustDoActivities.length} / {MUST_DO_MAX}
            </span>
          </div>

          {/* Live parse preview */}
          {parsedAnchors.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                We understood {parsedAnchors.length} item{parsedAnchors.length === 1 ? '' : 's'}:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parsedAnchors.map((a, i) => {
                  const pinned = a.dayNumber > 0;
                  const timeLabel = formatTimeLabel(a.startTime);
                  return (
                    <span
                      key={i}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                        pinned
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-muted text-muted-foreground border border-border'
                      )}
                      title={pinned ? undefined : 'Tip: add "Day 2" to pin this to a specific day'}
                    >
                      <span className="font-medium">
                        {pinned ? `Day ${a.dayNumber}` : 'Any day'}
                      </span>
                      {timeLabel && <span>· {timeLabel}</span>}
                      <span>· {a.title}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {unparsedLines.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                Couldn't parse - please reword:
              </div>
              <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside">
                {unparsedLines.slice(0, 5).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Anything else? — freeform context (vibe, things to skip, special requests) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            Anything else?
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value.slice(0, 1000))}
            maxLength={1000}
            placeholder="Tell us what to optimize for - vibes, things to skip, special requests, or context we should know."
            className="min-h-[80px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            We'll weave this into how the trip feels - not as a separate activity.
          </p>
        </div>

        {/* Pre-Booked Commitments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <CalendarCheck className="w-4 h-4 text-muted-foreground" />
              Pre-Booked Events
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            {!showCommitmentForm && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCommitmentForm(true)}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Event
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground -mt-1">
            Tickets, reservations, or events you've already booked. We'll plan around them.
          </p>

          {/* Existing commitments */}
          {commitments.length > 0 && (
            <div className="space-y-2">
              {commitments.map((c) => (
                <div 
                  key={c.id} 
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {c.startTime}
                      {c.location && ` · ${c.location}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCommitment(c.id)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add commitment form */}
          {showCommitmentForm && (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Input
                    placeholder="Event name (e.g., Hamilton tickets)"
                    value={newCommitment.title || ''}
                    onChange={(e) => setNewCommitment({ ...newCommitment, title: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
                  <Input
                    type="date"
                    min={startDate}
                    max={endDate}
                    value={newCommitment.date || ''}
                    onChange={(e) => setNewCommitment({ ...newCommitment, date: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Start Time</Label>
                  <Input
                    type="time"
                    value={newCommitment.startTime || ''}
                    onChange={(e) => setNewCommitment({ ...newCommitment, startTime: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    placeholder="Location (optional)"
                    value={newCommitment.location || ''}
                    onChange={(e) => setNewCommitment({ ...newCommitment, location: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCommitmentForm(false);
                    setNewCommitment({ category: 'event' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCommitment}
                  disabled={!newCommitment.title || !newCommitment.date || !newCommitment.startTime}
                >
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 mt-10">
        <Button
          onClick={handleContinue}
          disabled={isLoading}
          className="h-12 gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {hasAnyData ? 'Continue with Details' : 'Build My Itinerary'}
          <ArrowRight className="w-4 h-4" />
        </Button>
        
        {!hasAnyData && (
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isLoading}
            className="text-muted-foreground"
          >
            Skip for now, I'll add these later
          </Button>
        )}
      </div>
    </motion.div>
  );
}
