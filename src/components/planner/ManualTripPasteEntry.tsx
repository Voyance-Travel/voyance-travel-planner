/**
 * ManualTripPasteEntry — "I'll Build Myself" tab
 * 
 * Lets users paste ChatGPT/Claude research, parses it into a structured
 * itinerary scaffold, and creates a trip in manual builder mode.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardPaste, Loader2, Sparkles, X, Check, ArrowRight, PenLine, AlertCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ParsedTripInput, ParsedPreferences } from '@/types/parsedTrip';
import { createTripFromParsed } from '@/utils/createTripFromParsed';
import { safeUpdatePreferences } from '@/utils/safeDbOperations';
import { sanitizeAIOutput } from '@/utils/textSanitizer';

/** Strip CJK chars and leaked schema field names from a string */
const sanitizeAIField = (s: string): string => sanitizeAIOutput(s);

type Step = 'paste' | 'review' | 'creating';

const PLACEHOLDER = `Paste your trip research here...

Examples of what works:
• AI-generated itinerary output
• Day-by-day plans with activities
• Tables with times, costs, locations
• Your prompt + the AI's response

Day 1 - Arrival
Morning: Visit the local market
Lunch: Try the famous street food ($15)
Afternoon: Walking tour of Old Town
Evening: Dinner at a rooftop restaurant`;

interface ManualTripPasteEntryProps {
  onAuthRequired?: () => void;
}

export function ManualTripPasteEntry({ }: ManualTripPasteEntryProps = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('paste');
  const [pasteText, setPasteText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedTripInput | null>(null);
  const [editedPreferences, setEditedPreferences] = useState<ParsedPreferences | null>(null);
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editedStartDate, setEditedStartDate] = useState('');
  const [editedEndDate, setEditedEndDate] = useState('');

  // Restore draft after auth redirect
  useState(() => {
    try {
      const raw = sessionStorage.getItem('voyance_manual_paste_draft');
      if (raw && user) {
        const draft = JSON.parse(raw);
        if (draft.pasteText) setPasteText(draft.pasteText);
        if (draft.parsed) { setParsed(draft.parsed); setStep('review'); }
        if (draft.editedPreferences) setEditedPreferences(draft.editedPreferences);
        if (draft.saveToProfile) setSaveToProfile(draft.saveToProfile);
        sessionStorage.removeItem('voyance_manual_paste_draft');
      }
    } catch { /* ignore */ }
  });
  const handleParse = async () => {
    if (!pasteText.trim()) {
      toast.error('Please paste your trip research first');
      return;
    }

    if (pasteText.trim().length < 50) {
      toast.error('Please paste more content - we need at least a few activities to organize');
      return;
    }

    setIsParsing(true);

    try {
      const { data, error } = await supabase.functions.invoke('parse-trip-input', {
        body: { text: pasteText },
      });

      if (error) {
        console.error('[ManualPaste] Parse error:', error);
        // Try to extract structured error from FunctionsHttpError context
        let errorMsg = 'Failed to parse your input. Please try again.';
        try {
          if (error && typeof error === 'object' && 'context' in error) {
            const ctx = (error as any).context;
            if (ctx?.body) {
              const body = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
              if (body?.error) errorMsg = body.error;
            }
          }
        } catch { /* use default message */ }
        toast.error(errorMsg);
        setIsParsing(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setIsParsing(false);
        return;
      }

      const result = data as ParsedTripInput;

      if (!result.days || result.days.length === 0) {
        toast.error("We couldn't find any days or activities in your text. Try pasting a day-by-day itinerary.");
        setIsParsing(false);
        return;
      }

      // Client-side sanitization safety net — strip any CJK / schema-leak artifacts
      if (result.destination) {
        result.destination = sanitizeAIField(result.destination)
          .replace(/\s+[A-Z][a-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/g, '').trim();
      }
      if (result.days) {
        for (const day of result.days) {
          if (day.theme) day.theme = sanitizeAIField(day.theme);
          for (const act of day.activities) {
            if (act.name) act.name = sanitizeAIField(act.name);
            if (act.notes) act.notes = sanitizeAIField(act.notes);
            if (act.description) act.description = sanitizeAIField(act.description);
          }
        }
      }
      if (result.accommodationNotes) result.accommodationNotes = result.accommodationNotes.map(sanitizeAIField).filter(Boolean);
      if (result.practicalTips) result.practicalTips = result.practicalTips.map(sanitizeAIField).filter(Boolean);

      setParsed(result);
      setEditedPreferences(result.preferences || null);
      setEditedStartDate(result.dates?.start || '');
      setEditedEndDate(result.dates?.end || '');
      setStep('review');
    } catch (err) {
      console.error('[ManualPaste] Exception:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsed) return;

    if (!user) {
      toast.error('Please sign in to save your trip');
      return;
    }

    setIsCreating(true);
    setStep('creating');

    try {
      // Save preferences to profile if requested
      if (saveToProfile && editedPreferences && user) {
        const prefUpdates: Record<string, unknown> = {};
        if (editedPreferences.dietary?.length) prefUpdates.dietary_restrictions = editedPreferences.dietary;
        if (editedPreferences.pace) prefUpdates.pace_preference = editedPreferences.pace;
        if (editedPreferences.budgetLevel) prefUpdates.budget_preference = editedPreferences.budgetLevel;
        if (editedPreferences.avoid?.length) prefUpdates.avoid_preferences = editedPreferences.avoid;
        if (editedPreferences.focus?.length) prefUpdates.focus_preferences = editedPreferences.focus;

        if (Object.keys(prefUpdates).length > 0) {
          await safeUpdatePreferences(user.id, prefUpdates);
        }
      }

      // Merge edited dates back into parsed before creating trip
      const finalParsed = { ...parsed };
      if (editedStartDate || editedEndDate) {
        finalParsed.dates = {
          start: editedStartDate || parsed.dates?.start || '',
          end: editedEndDate || parsed.dates?.end || '',
        };
      }

      const result = await createTripFromParsed(finalParsed, user.id);

      if ('error' in result) {
        toast.error(result.error);
        setStep('review');
        setIsCreating(false);
        return;
      }

      toast.success('Trip organized! You can now edit and refine it.');
      navigate(`/trip/${result.tripId}`);
    } catch (err) {
      console.error('[ManualPaste] Create error:', err);
      toast.error('Failed to create trip. Please try again.');
      setStep('review');
      setIsCreating(false);
    }
  };

  const removePreference = (key: keyof ParsedPreferences, value?: string) => {
    if (!editedPreferences) return;
    const updated = { ...editedPreferences };
    if (value && Array.isArray(updated[key])) {
      (updated[key] as string[]) = (updated[key] as string[]).filter(v => v !== value);
    } else {
      delete updated[key];
    }
    setEditedPreferences(updated);
  };

  const totalActivities = parsed?.days.reduce((sum, d) => sum + d.activities.length, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-lg mx-auto"
    >
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-serif font-semibold text-foreground mb-1">
          Build It Yourself
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste your research and we'll organize it. No AI generation - you're in full control.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Perfect for travelers who already have their plan and just need a clean organizer.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Paste */}
        {step === 'paste' && (
          <motion.div
            key="paste"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="relative">
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={PLACEHOLDER}
                className="min-h-[280px] sm:min-h-[320px] text-sm resize-none font-mono leading-relaxed"
                disabled={isParsing}
              />
              {pasteText && (
                <button
                  onClick={() => setPasteText('')}
                  className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {pasteText.length > 0 ? `${pasteText.length.toLocaleString()} characters` : 'Free - no credits needed'}
              </span>
              <Button
                onClick={handleParse}
                disabled={isParsing || pasteText.trim().length < 50}
                className="gap-2"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Organizing...
                  </>
                ) : (
                  <>
                    <ClipboardPaste className="h-4 w-4" />
                    Organize My Research
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Review */}
        {step === 'review' && parsed && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Summary */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">
                  {parsed.destination ? `Trip to ${parsed.destination}` : 'Your Trip'}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {parsed.days.length} {parsed.days.length === 1 ? 'day' : 'days'} · {totalActivities} activities
                </Badge>
              </div>

              {/* Editable dates */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                {editedStartDate ? (
                  <input
                    type="date"
                    value={editedStartDate}
                    onChange={(e) => setEditedStartDate(e.target.value)}
                    className="bg-transparent border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                ) : (
                  <button
                    onClick={() => setEditedStartDate(new Date().toISOString().split('T')[0])}
                    className="text-xs text-muted-foreground underline decoration-dashed hover:text-foreground transition-colors"
                  >
                    Add start date
                  </button>
                )}
                <span className="text-muted-foreground">→</span>
                {editedEndDate ? (
                  <input
                    type="date"
                    value={editedEndDate}
                    onChange={(e) => setEditedEndDate(e.target.value)}
                    className="bg-transparent border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                ) : (
                  <button
                    onClick={() => setEditedEndDate(new Date().toISOString().split('T')[0])}
                    className="text-xs text-muted-foreground underline decoration-dashed hover:text-foreground transition-colors"
                  >
                    Add end date
                  </button>
                )}
              </div>
              {!editedStartDate && !editedEndDate && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No dates detected. Add them now or edit later
                </p>
              )}

              {/* Day preview */}
              <div className="space-y-2">
                {parsed.days.map((day) => (
                  <div key={day.dayNumber} className="flex items-baseline gap-2 text-sm">
                    <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">
                      Day {day.dayNumber}
                    </span>
                    <span className="text-foreground truncate">
                      {day.theme || `${day.activities.length} activities`}
                    </span>
                  </div>
                ))}
              </div>

              {(parsed.accommodationNotes?.length || parsed.practicalTips?.length) ? (
                <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                  {parsed.accommodationNotes?.length ? (
                    <span>📋 {parsed.accommodationNotes.length} accommodation notes</span>
                  ) : null}
                  {parsed.accommodationNotes?.length && parsed.practicalTips?.length ? ' · ' : ''}
                  {parsed.practicalTips?.length ? (
                    <span>💡 {parsed.practicalTips.length} practical tips</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Preferences */}
            {editedPreferences && Object.keys(editedPreferences).filter(k => k !== 'rawPreferenceText').some(k => {
              const val = editedPreferences[k as keyof ParsedPreferences];
              return val && (!Array.isArray(val) || val.length > 0);
            }) && (
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium text-foreground">
                    Detected preferences
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {editedPreferences.budgetLevel && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      💰 {editedPreferences.budgetLevel}
                      <button onClick={() => removePreference('budgetLevel')} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {editedPreferences.dietary?.map(d => (
                    <Badge key={d} variant="outline" className="gap-1 text-xs">
                      🥗 {d}
                      <button onClick={() => removePreference('dietary', d)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {editedPreferences.focus?.map(f => (
                    <Badge key={f} variant="outline" className="gap-1 text-xs">
                      🎯 {f}
                      <button onClick={() => removePreference('focus', f)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {editedPreferences.avoid?.map(a => (
                    <Badge key={a} variant="outline" className="gap-1 text-xs">
                      🚫 {a}
                      <button onClick={() => removePreference('avoid', a)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {editedPreferences.pace && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      🏃 {editedPreferences.pace}
                      <button onClick={() => removePreference('pace')} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>

                {user && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <Checkbox
                      checked={saveToProfile}
                      onCheckedChange={(checked) => setSaveToProfile(checked === true)}
                    />
                    <span className="text-xs text-muted-foreground">
                      Save to my profile for future trips
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('paste');
                  setParsed(null);
                }}
              >
                ← Back to edit
              </Button>
              <Button onClick={handleConfirm} className="gap-2">
                <Check className="h-4 w-4" />
                Create Trip
              </Button>
            </div>

            <p className="text-[11px] text-center text-muted-foreground">
              Free - all your content stays unlocked. Want insider tips &amp; route optimization? Try Smart Finish inside.
            </p>
          </motion.div>
        )}

        {/* Step 3: Creating */}
        {step === 'creating' && (
          <motion.div
            key="creating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-12"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Organizing your trip...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
