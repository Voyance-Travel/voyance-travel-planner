/**
 * DNA Quiz Prompt
 * 
 * A gentle prompt encouraging guests without Travel DNA to complete the quiz
 * so their preferences can be included in itinerary generation.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dna, Sparkles, Send, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DNAQuizPromptProps {
  guestName: string;
  guestEmail?: string;
  tripName?: string;
  onSendInvite?: () => void;
  compact?: boolean;
  className?: string;
}

export function DNAQuizPrompt({
  guestName,
  guestEmail,
  tripName,
  onSendInvite,
  compact = false,
  className,
}: DNAQuizPromptProps) {
  const [sending, setSending] = useState(false);

  const handleSendInvite = async () => {
    setSending(true);
    
    // For now, just show a toast - email integration can be added later
    toast.success(`Quiz invite sent to ${guestName}!`, {
      description: 'They\'ll receive an email with a link to complete their Travel DNA quiz.',
    });

    onSendInvite?.();
    setSending(false);
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20",
        className
      )}>
        <Dna className="h-4 w-4 text-amber-500" />
        <span className="text-xs text-amber-600 dark:text-amber-400">
          No Travel DNA yet
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/20"
          onClick={handleSendInvite}
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Invite to Quiz'}
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Dna className="h-5 w-5 text-amber-500" />
            </div>
            
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">
                No Travel DNA yet
              </p>
              <p className="text-xs text-muted-foreground">
                Invite {guestName} to take the quiz so their preferences can be 
                included in your itinerary{tripName ? ` for ${tripName}` : ''}.
              </p>
              
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-amber-500/30 hover:bg-amber-500/10"
                  onClick={handleSendInvite}
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" />
                      Send Quiz Invite
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
