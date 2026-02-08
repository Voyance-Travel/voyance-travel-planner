/**
 * ProposeReplacementDialog — Modal for proposing a replacement for an itinerary activity.
 * Submits as a trip_suggestion with target_activity context and optional vote deadline.
 * Includes "Browse Alternatives" to search via the AI-powered alternatives drawer.
 */

import { useState, useCallback } from 'react';
import { MessageSquarePlus, Loader2, CalendarClock, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ActivityAlternativesDrawer from '@/components/planner/ActivityAlternativesDrawer';
import type { ItineraryActivity } from '@/types/itinerary';

interface ProposeReplacementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  activityId: string;
  activityTitle: string;
  /** Destination for AI search context */
  destination?: string;
  /** Current activity converted for the alternatives drawer */
  activityForDrawer?: ItineraryActivity | null;
  /** Existing activity names to exclude from suggestions */
  existingActivities?: string[];
}

export function ProposeReplacementDialog({
  isOpen,
  onClose,
  tripId,
  activityId,
  activityTitle,
  destination,
  activityForDrawer,
  existingActivities = [],
}: ProposeReplacementDialogProps) {
  const { user } = useAuth();
  const [replacement, setReplacement] = useState('');
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const displayName = user?.name || user?.email?.split('@')[0] || 'Traveler';

  // Minimum deadline is 1 hour from now
  const minDeadline = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  const handleSubmit = async () => {
    if (!replacement.trim() || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('trip_suggestions')
        .insert({
          trip_id: tripId,
          trip_type: 'consumer',
          user_id: user.id,
          display_name: displayName,
          suggestion_type: 'replacement',
          title: replacement.trim(),
          description: reason.trim() || null,
          target_activity_id: activityId,
          target_activity_title: activityTitle,
          replacement_reason: reason.trim() || null,
          vote_deadline: deadline ? new Date(deadline).toISOString() : null,
        });

      if (error) throw error;

      toast.success('Replacement proposed! Your group can now vote on it.');
      setReplacement('');
      setReason('');
      setDeadline('');
      onClose();
    } catch (err) {
      console.error('Failed to propose replacement:', err);
      toast.error('Failed to submit proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectAlternative = useCallback((selected: ItineraryActivity) => {
    setReplacement(selected.title || '');
    // Auto-fill reason with the AI's recommendation context if available
    if (selected.description && !reason.trim()) {
      setReason(selected.description);
    }
    setShowAlternatives(false);
  }, [reason]);

  return (
    <>
      <Dialog open={isOpen && !showAlternatives} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-primary" />
              Propose Replacement
            </DialogTitle>
            <DialogDescription>
              Suggest replacing <span className="font-medium text-foreground">"{activityTitle}"</span> with something else. Your group can vote on it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="replacement">What should we do instead?</Label>
              <div className="flex gap-2">
                <Input
                  id="replacement"
                  placeholder="e.g. Visit the local market"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  maxLength={200}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                {destination && activityForDrawer && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowAlternatives(true)}
                    title="Browse AI suggestions"
                    className="shrink-0"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {destination && activityForDrawer && (
                <button
                  type="button"
                  onClick={() => setShowAlternatives(true)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  Or browse AI-powered alternatives →
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Why? <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="reason"
                placeholder="e.g. I've been there before and the market has better local food"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline" className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Vote by <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={minDeadline}
                className="w-full"
              />
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline('')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Remove deadline
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !replacement.trim()}
              className="gap-1.5"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              Propose
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Alternatives Drawer - reuses existing swap drawer */}
      <ActivityAlternativesDrawer
        open={showAlternatives}
        onClose={() => setShowAlternatives(false)}
        activity={activityForDrawer || null}
        destination={destination}
        existingActivities={existingActivities}
        onSelectAlternative={handleSelectAlternative}
      />
    </>
  );
}
