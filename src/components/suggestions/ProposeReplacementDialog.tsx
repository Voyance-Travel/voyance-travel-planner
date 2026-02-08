/**
 * ProposeReplacementDialog — Modal for proposing a replacement for an itinerary activity.
 * Submits as a trip_suggestion with target_activity context.
 */

import { useState } from 'react';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProposeReplacementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  activityId: string;
  activityTitle: string;
}

export function ProposeReplacementDialog({
  isOpen,
  onClose,
  tripId,
  activityId,
  activityTitle,
}: ProposeReplacementDialogProps) {
  const { user } = useAuth();
  const [replacement, setReplacement] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const displayName = user?.name || user?.email?.split('@')[0] || 'Traveler';

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
        });

      if (error) throw error;

      toast.success('Replacement proposed! Your group can now vote on it.');
      setReplacement('');
      setReason('');
      onClose();
    } catch (err) {
      console.error('Failed to propose replacement:', err);
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
            <Input
              id="replacement"
              placeholder="e.g. Visit the local market"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
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
  );
}
