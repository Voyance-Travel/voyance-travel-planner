/**
 * NoDnaCompanionPrompt — Inline notice shown when a companion 
 * hasn't taken the Travel DNA quiz, excluding them from blending.
 */

import { Dna, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NoDnaCompanionPromptProps {
  name: string;
  /** If true, the companion is not a Voyance user at all */
  isEmailInvite?: boolean;
  className?: string;
}

export function NoDnaCompanionPrompt({ name, isEmailInvite, className }: NoDnaCompanionPromptProps) {
  const message = isEmailInvite
    ? `Invite ${name} to Voyance so their travel style can be blended into the trip.`
    : `${name} hasn't taken the Travel DNA quiz yet. Their preferences won't be included in the blend.`;

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 border border-border text-xs ${className || ''}`}>
      <Dna className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground">{message}</p>
      </div>
      {isEmailInvite && (
        <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2 shrink-0">
          <ExternalLink className="h-3 w-3" />
          Invite
        </Button>
      )}
    </div>
  );
}
