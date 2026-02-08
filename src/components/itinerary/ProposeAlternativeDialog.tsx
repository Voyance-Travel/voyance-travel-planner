/**
 * ProposeAlternativeDialog
 * 
 * Allows a collaborator to propose an alternative to an existing itinerary activity.
 * The proposal is submitted as a suggestion to the Group voting board.
 */

import { useState } from 'react';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProposeAlternativeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  /** The activity being replaced */
  originalActivity: {
    name: string;
    time?: string;
    dayNumber: number;
    category?: string;
  };
  /** Callback after successful submission — e.g. switch to Group tab */
  onSubmitted?: () => void;
}

export function ProposeAlternativeDialog({
  isOpen,
  onClose,
  tripId,
  originalActivity,
  onSubmitted,
}: ProposeAlternativeDialogProps) {
  const { user } = useAuth();
  const [alternative, setAlternative] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const displayName = user?.name || user?.email?.split('@')[0] || 'Traveler';

  const handleSubmit = async () => {
    if (!alternative.trim() || !user) return;

    setSubmitting(true);
    try {
      const title = `Replace "${originalActivity.name}" → ${alternative.trim()}`;
      const description = [
        `📍 Day ${originalActivity.dayNumber}${originalActivity.time ? ` at ${originalActivity.time}` : ''}`,
        reason.trim() ? `\n💬 Why: ${reason.trim()}` : '',
      ].join('');

      const { error } = await supabase
        .from('trip_suggestions')
        .insert({
          trip_id: tripId,
          trip_type: 'consumer',
          user_id: user.id,
          display_name: displayName,
          suggestion_type: 'activity',
          title,
          description: description || null,
          status: 'open',
        });

      if (error) throw error;

      toast.success('Alternative proposed! Your group can vote on it.');
      setAlternative('');
      setReason('');
      onClose();
      onSubmitted?.();
    } catch (err) {
      console.error('Failed to propose alternative:', err);
      toast.error('Failed to submit proposal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Propose a Change
          </DialogTitle>
          <DialogDescription>
            Suggest an alternative to <span className="font-medium text-foreground">{originalActivity.name}</span> on Day {originalActivity.dayNumber}. Your group will vote on it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current activity (read-only context) */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Current</p>
            <p className="font-medium">{originalActivity.name}</p>
            {originalActivity.time && (
              <p className="text-xs text-muted-foreground">{originalActivity.time} · Day {originalActivity.dayNumber}</p>
            )}
          </div>

          {/* Alternative input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">What would you rather do?</label>
            <Input
              placeholder="e.g. Street food tour in Shibuya"
              value={alternative}
              onChange={(e) => setAlternative(e.target.value)}
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Why this change? <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Textarea
              placeholder="e.g. We had sushi last night, would love something different"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !alternative.trim()} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Send to Vote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
